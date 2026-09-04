import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDoh } from '../src/dns.js';
import { buildDnsQuery, parseDnsMessage, validateDnsQuery } from '../src/wire.js';
import {
  buildBlockedResponse,
  evaluateFirewall,
  getFirewallStatus,
  mutateFirewall,
  parseBlocklist,
  refreshBlocklists
} from '../src/firewall.js';

class MemoryKv {
  constructor() { this.map = new Map(); }
  async get(key, type) {
    const value = this.map.get(key);
    if (value == null) return null;
    return type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) { this.map.set(key, String(value)); }
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

test('manual deny rule blocks locally without contacting upstream', async () => {
  const query = buildDnsQuery('ads.example.com', 'A', { id: 0x3131, dnssec: false });
  let upstreamCalls = 0;
  const fetcher = async () => { upstreamCalls++; throw new Error('must not be called'); };
  const env = { DNSDASH_DENY: 'ads.example.com', DNSDASH_BLOCK_MODE: 'nxdomain' };
  const res = await handleDoh(new Request('https://dns.example/dns-query?dns=' + b64url(query)), env, fetcher);
  assert.equal(res.status, 200);
  assert.equal(upstreamCalls, 0);
  assert.equal(res.headers.get('X-DNS-Blocked'), '1');
  assert.match(res.headers.get('X-DNS-Rule'), /deny:ads\.example\.com/);
  const parsed = parseDnsMessage(new Uint8Array(await res.arrayBuffer()));
  assert.equal(parsed.flags.rcodeName, 'NXDOMAIN');
  assert.equal(parsed.question[0].name, 'ads.example.com');
});

test('allowlist takes precedence over denylist', async () => {
  const query = buildDnsQuery('safe.example.com', 'A', { id: 2, dnssec: false });
  const decision = await evaluateFirewall(validateDnsQuery(query), {
    DNSDASH_ALLOW: 'safe.example.com',
    DNSDASH_DENY: 'safe.example.com'
  });
  assert.equal(decision.blocked, false);
  assert.match(decision.source, /^allow:/);
});

test('wildcard rules match subdomains but not the apex', async () => {
  let query = buildDnsQuery('x.tracker.example', 'A', { id: 3, dnssec: false });
  let d = await evaluateFirewall(validateDnsQuery(query), { DNSDASH_DENY: '*.tracker.example' });
  assert.equal(d.blocked, true);
  query = buildDnsQuery('tracker.example', 'A', { id: 4, dnssec: false });
  d = await evaluateFirewall(validateDnsQuery(query), { DNSDASH_DENY: '*.tracker.example' });
  assert.equal(d.blocked, false);
});

test('zero blocking returns 0.0.0.0 for A queries', () => {
  const query = buildDnsQuery('ads.example.com', 'A', { id: 5, dnssec: false });
  const parsedQuery = validateDnsQuery(query);
  const blocked = parseDnsMessage(buildBlockedResponse(query, parsedQuery, 'zero'));
  assert.equal(blocked.flags.rcodeName, 'NOERROR');
  assert.equal(blocked.answer.length, 1);
  assert.equal(blocked.answer[0].parsed.address, '0.0.0.0');
});

test('temporary pause bypasses deny rules and resume restores blocking', async () => {
  const kv = new MemoryKv();
  await kv.put('firewall:config:v1', JSON.stringify({ enabled: true, blockMode: 'nxdomain', allow: [], deny: ['ads.pause.example'], sources: [] }));
  const env = { DNSDASH_KV: kv };
  const query = buildDnsQuery('ads.pause.example', 'A', { id: 6, dnssec: false });
  let decision = await evaluateFirewall(validateDnsQuery(query), env);
  assert.equal(decision.blocked, true);

  await mutateFirewall(env, 'pause', { seconds: '300' });
  decision = await evaluateFirewall(validateDnsQuery(query), env);
  assert.equal(decision.blocked, false);
  assert.equal(decision.source, 'blocking-paused');
  let status = await getFirewallStatus(env);
  assert.equal(status.paused, true);
  assert.equal(status.enabled, false);
  assert.equal(status.configuredEnabled, true);

  await mutateFirewall(env, 'resume', {});
  decision = await evaluateFirewall(validateDnsQuery(query), env);
  assert.equal(decision.blocked, true);
  status = await getFirewallStatus(env);
  assert.equal(status.paused, false);
  assert.equal(status.enabled, true);
});

test('blocklist parser accepts hosts, domain and Adblock syntax', () => {
  const domains = parseBlocklist(`
# comment
0.0.0.0 ads.one.example
127.0.0.1 tracker.two.example
plain.three.example
||four.example^
@@||allowed.example^
! comment
`);
  assert.deepEqual(domains.sort(), ['ads.one.example','four.example','plain.three.example','tracker.two.example'].sort());
});

test('blocklist refresh compiles gravity shards and blocks a compiled domain', async () => {
  const kv = new MemoryKv();
  await kv.put('firewall:config:v1', JSON.stringify({
    enabled: true,
    blockMode: 'nxdomain',
    allow: [],
    deny: [],
    sources: [{ id: 'src-test', name: 'Test list', url: 'https://list.example/hosts.txt', enabled: true }]
  }));
  const env = { DNSDASH_KV: kv };
  const meta = await refreshBlocklists(env, async () => new Response('0.0.0.0 gravity.example\ntracker.gravity.example\n', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  }));
  assert.equal(meta.domains, 2);
  const query = buildDnsQuery('gravity.example', 'AAAA', { id: 7, dnssec: false });
  const decision = await evaluateFirewall(validateDnsQuery(query), env);
  assert.equal(decision.blocked, true);
  assert.equal(decision.source, 'gravity');
  const status = await getFirewallStatus(env);
  assert.equal(status.gravity.domains, 2);
});
