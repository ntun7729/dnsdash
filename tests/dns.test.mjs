import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeBase64Url,
  getUpstreams,
  handleDoh,
  handleProfileApi,
  handleResolveApi,
  healthPayload,
  resolveWire
} from '../src/dns.js';
import {
  DNS_TYPES,
  buildDnsQuery,
  parseDnsMessage,
  parseEchConfigList,
  serviceBindingInspection,
  validateDnsQuery
} from '../src/wire.js';

const te = new TextEncoder();

function u16(n) { return new Uint8Array([(n >>> 8) & 255, n & 255]); }
function u32(n) { return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]); }
function cat(...parts) { const n = parts.reduce((s, p) => s + p.length, 0); const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
function lp(bytes) { return cat(new Uint8Array([bytes.length]), bytes); }
function vec16(bytes) { return cat(u16(bytes.length), bytes); }
function base64url(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

function questionEnd(query) {
  let p = 12;
  while (query[p] !== 0) p += 1 + query[p];
  return p + 1 + 4;
}

function rr(type, rdata, ttl = 120) {
  return cat(new Uint8Array([0xc0, 0x0c]), u16(type), u16(1), u32(ttl), u16(rdata.length), rdata);
}

function responseFor(query, records = [], { flags = 0x81a0, idDelta = 0 } = {}) {
  const qEnd = questionEnd(query);
  const id = (((query[0] << 8) | query[1]) + idDelta) & 0xffff;
  const header = cat(u16(id), u16(flags), u16(1), u16(records.length), u16(0), u16(0));
  return cat(header, query.subarray(12, qEnd), ...records);
}

function echConfigList(publicName = 'cloudflare-ech.com') {
  const publicKey = new Uint8Array(32).fill(0x11);
  const suites = cat(u16(0x0001), u16(0x0001));
  const name = te.encode(publicName);
  const contents = cat(
    new Uint8Array([7]),
    u16(0x0020),
    vec16(publicKey),
    vec16(suites),
    new Uint8Array([0, name.length]),
    name,
    u16(0)
  );
  const config = cat(u16(0xfe0d), u16(contents.length), contents);
  return vec16(config);
}

function svcParam(key, value) { return cat(u16(key), u16(value.length), value); }
function httpsRdata() {
  const alpn = cat(lp(te.encode('h3')), lp(te.encode('h2')));
  const ip4 = new Uint8Array([104, 16, 1, 2]);
  const ech = echConfigList();
  return cat(u16(1), new Uint8Array([0]), svcParam(1, alpn), svcParam(4, ip4), svcParam(5, ech));
}

function answerForType(query) {
  const parsed = parseDnsMessage(query);
  const type = parsed.question[0].type;
  if (type === DNS_TYPES.A) return responseFor(query, [rr(DNS_TYPES.A, new Uint8Array([1, 2, 3, 4]), 60)]);
  if (type === DNS_TYPES.AAAA) return responseFor(query, [rr(DNS_TYPES.AAAA, new Uint8Array([0x26,0x06,0x47,0x00,0,0,0,0,0,0,0,0,0,0,0,1]), 60)]);
  if (type === DNS_TYPES.HTTPS) return responseFor(query, [rr(DNS_TYPES.HTTPS, httpsRdata(), 300)]);
  return responseFor(query, []);
}

function goodFetcher() {
  return async (_url, init) => new Response(answerForType(new Uint8Array(init.body)), {
    status: 200,
    headers: { 'Content-Type': 'application/dns-message', 'Cache-Control': 'max-age=42' }
  });
}

test('buildDnsQuery creates a standard query with EDNS DO for DNSSEC', () => {
  const query = buildDnsQuery('example.com', 'HTTPS', { id: 0x1234, dnssec: true });
  const parsed = parseDnsMessage(query);
  assert.equal(parsed.id, 0x1234);
  assert.equal(parsed.flags.qr, false);
  assert.equal(parsed.flags.rd, true);
  assert.equal(parsed.question[0].name, 'example.com');
  assert.equal(parsed.question[0].typeName, 'HTTPS');
  assert.equal(parsed.additional[0].typeName, 'OPT');
  assert.equal(parsed.additional[0].parsed.dnssecOk, true);
});

test('wire parser decodes compressed owner names and A/AAAA records', () => {
  const aQuery = buildDnsQuery('example.com', 'A', { id: 1, dnssec: false });
  const a = parseDnsMessage(answerForType(aQuery));
  assert.equal(a.answer[0].name, 'example.com');
  assert.equal(a.answer[0].parsed.address, '1.2.3.4');

  const aaaaQuery = buildDnsQuery('example.com', 'AAAA', { id: 2, dnssec: false });
  const aaaa = parseDnsMessage(answerForType(aaaaQuery));
  assert.equal(aaaa.answer[0].parsed.address, '2606:4700::1');
});

test('HTTPS wire parser decodes ALPN, hints, ECH and RFC 9849 config contents', () => {
  const query = buildDnsQuery('cloudflare-ech.com', 'HTTPS', { id: 3, dnssec: false });
  const parsed = parseDnsMessage(answerForType(query));
  const inspection = serviceBindingInspection(parsed.answer);
  assert.equal(inspection.echAvailable, true);
  assert.deepEqual(inspection.serviceBindings[0].params.alpn, ['h3', 'h2']);
  assert.deepEqual(inspection.serviceBindings[0].params.ipv4hint, ['104.16.1.2']);
  assert.equal(inspection.echConfigs.length, 1);
  assert.equal(inspection.echConfigs[0].versionHex, '0xfe0d');
  assert.equal(inspection.echConfigs[0].configId, 7);
  assert.equal(inspection.echConfigs[0].publicName, 'cloudflare-ech.com');
  assert.match(inspection.echConfigs[0].kem, /X25519/);
  assert.equal(inspection.echConfigs[0].cipherSuites[0].kdf, 'HKDF-SHA256');
  assert.equal(inspection.echConfigs[0].cipherSuites[0].aead, 'AES-128-GCM');
});

test('ECH parser rejects truncated vectors without throwing to callers', () => {
  const result = parseEchConfigList(new Uint8Array([0, 20, 0xfe, 0x0d, 0, 4, 1]));
  assert.equal(result.valid, false);
  assert.match(result.error, /length|Truncated/);
});

test('decodeBase64Url accepts RFC 8484 unpadded query encoding', () => {
  const query = buildDnsQuery('example.com', 'A', { id: 4, dnssec: false });
  assert.deepEqual([...decodeBase64Url(base64url(query))], [...query]);
});

test('DoH GET accepts wire query but relays upstream as POST', async () => {
  const query = buildDnsQuery('example.com', 'A', { id: 0x4567, dnssec: false });
  let seen;
  const fetcher = async (url, init) => {
    seen = { url: String(url), method: init.method, body: new Uint8Array(init.body) };
    return new Response(answerForType(seen.body), { status: 200, headers: { 'Content-Type': 'application/dns-message' } });
  };
  const req = new Request('https://dns.example/dns-query?dns=' + base64url(query), { headers: { Accept: 'application/dns-message' } });
  const res = await handleDoh(req, {}, fetcher);
  assert.equal(res.status, 200);
  assert.equal(seen.method, 'POST');
  assert.equal(seen.url, 'https://cloudflare-dns.com/dns-query');
  assert.deepEqual([...seen.body], [...query]);
  assert.equal(res.headers.get('X-DNS-Upstream'), 'cloudflare-dns.com');
});

test('DoH POST validates media type and DNS packet structure', async () => {
  let res = await handleDoh(new Request('https://dns.example/dns-query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), {}, goodFetcher());
  assert.equal(res.status, 415);
  res = await handleDoh(new Request('https://dns.example/dns-query', { method: 'POST', headers: { 'Content-Type': 'application/dns-message' }, body: new Uint8Array(12) }), {}, goodFetcher());
  assert.equal(res.status, 400);
});

test('resolver rejects upstream transaction mismatch and falls through to fallback', async () => {
  const query = buildDnsQuery('example.com', 'A', { id: 0x2222, dnssec: false });
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push(String(url));
    const bytes = new Uint8Array(init.body);
    const bad = String(url).includes('primary');
    return new Response(responseFor(bytes, [rr(DNS_TYPES.A, new Uint8Array([9,9,9,9]))], { idDelta: bad ? 1 : 0 }), { status: 200, headers: { 'Content-Type': 'application/dns-message' } });
  };
  const result = await resolveWire(query, { UPSTREAM_DOH: 'https://primary.example/dns-query', UPSTREAM_DOH_FALLBACKS: 'https://backup.example/dns-query' }, fetcher);
  assert.equal(result.upstreamIndex, 1);
  assert.equal(result.parsed.answer[0].parsed.address, '9.9.9.9');
  assert.equal(calls.length, 2);
});

test('resolve API is wire based and returns decoded ECH configuration', async () => {
  const res = await handleResolveApi(new Request('https://dns.example/api/resolve?name=cloudflare-ech.com&type=HTTPS&dnssec=1'), {}, goodFetcher());
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.query.type, 'HTTPS');
  assert.equal(data.statusName, 'NOERROR');
  assert.equal(data.inspection.echAvailable, true);
  assert.equal(data.inspection.echConfigs[0].publicName, 'cloudflare-ech.com');
  assert.equal(data.answers[0].parsed.params.ech.valid, true);
});

test('profile API resolves A, AAAA and HTTPS concurrently into a connection summary', async () => {
  const res = await handleProfileApi(new Request('https://dns.example/api/profile?name=cloudflare-ech.com'), {}, goodFetcher());
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.summary.ipv4, ['1.2.3.4']);
  assert.deepEqual(data.summary.ipv6, ['2606:4700::1']);
  assert.deepEqual(data.summary.alpn, ['h3', 'h2']);
  assert.equal(data.summary.echAvailable, true);
  assert.equal(data.summary.echConfigs[0].configId, 7);
});

test('upstream configuration is HTTPS-only, deduplicated and bounded', () => {
  const list = getUpstreams({
    UPSTREAM_DOH: 'https://one.example/dns-query, http://bad.example/dns-query, https://one.example/dns-query',
    UPSTREAM_DOH_FALLBACKS: 'https://two.example/dns-query,https://three.example/dns-query,https://four.example/dns-query,https://five.example/dns-query'
  });
  assert.deepEqual(list.map(x => new URL(x).hostname), ['one.example', 'two.example', 'three.example', 'four.example']);
});

test('query validator rejects messages with QR set', () => {
  const query = buildDnsQuery('example.com', 'A', { id: 9, dnssec: false });
  query[2] |= 0x80;
  assert.throws(() => validateDnsQuery(query), /response bit/);
});

test('health payload exposes capabilities without leaking full upstream URLs', () => {
  const health = healthPayload({ UPSTREAM_DOH: 'https://resolver.example/private/path?x=1' });
  assert.equal(health.ok, true);
  assert.deepEqual(health.upstreams, ['resolver.example']);
  assert.ok(health.features.includes('ech-rfc9849'));
});
