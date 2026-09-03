import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeBase64Url,
  handleDoh,
  handleResolveApi,
  inspectServiceBindingAnswers,
  parseServiceBindingData
} from '../src/dns.js';

function dnsQueryBytes() {
  return new Uint8Array([0x12,0x34,0x01,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00]);
}

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function wireFetcher(expectedMethod = 'GET') {
  return async (url, init = {}) => {
    assert.equal(init.method, expectedMethod);
    assert.match(String(url), /^https:\/\/cloudflare-dns\.com\/dns-query/);
    return new Response(new Uint8Array([1,2,3,4]), {
      status: 200,
      headers: { 'Content-Type': 'application/dns-message', 'Cache-Control': 'max-age=60' }
    });
  };
}

test('decodeBase64Url decodes unpadded DNS query data', () => {
  assert.deepEqual([...decodeBase64Url(base64url(dnsQueryBytes()))], [...dnsQueryBytes()]);
});

test('DoH GET validates and forwards wire-format queries', async () => {
  const encoded = base64url(dnsQueryBytes());
  const request = new Request('https://dns.example/dns-query?dns=' + encoded, {
    headers: { Accept: 'application/dns-message' }
  });
  const response = await handleDoh(request, {}, wireFetcher('GET'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/dns-message');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1,2,3,4]);
});

test('DoH POST forwards binary request body unchanged', async () => {
  let seenBody = null;
  const fetcher = async (url, init) => {
    seenBody = new Uint8Array(init.body);
    return new Response(new Uint8Array([9,8,7]), { status: 200, headers: { 'Content-Type': 'application/dns-message' } });
  };
  const body = dnsQueryBytes();
  const request = new Request('https://dns.example/dns-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/dns-message' },
    body
  });
  const response = await handleDoh(request, {}, fetcher);
  assert.equal(response.status, 200);
  assert.deepEqual([...seenBody], [...body]);
});

test('DoH rejects missing GET query and wrong POST media type', async () => {
  let response = await handleDoh(new Request('https://dns.example/dns-query'), {}, async () => { throw new Error('should not run'); });
  assert.equal(response.status, 400);

  response = await handleDoh(new Request('https://dns.example/dns-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  }), {}, async () => { throw new Error('should not run'); });
  assert.equal(response.status, 415);
});

test('service binding parser extracts quoted ECH and address hints', () => {
  const parsed = parseServiceBindingData('1 . alpn="h3,h2" ipv4hint="104.16.1.2,104.16.1.3" ech="AEX+example==" ipv6hint="2606:4700::1"');
  assert.equal(parsed.priority, 1);
  assert.equal(parsed.target, '.');
  assert.equal(parsed.params.alpn, 'h3,h2');
  assert.equal(parsed.params.ech, 'AEX+example==');

  const inspected = inspectServiceBindingAnswers([{ type: 65, TTL: 300, data: '1 . alpn="h3,h2" ech="AEX+example==" ipv4hint="104.16.1.2"' }]);
  assert.equal(inspected.echAvailable, true);
  assert.deepEqual(inspected.serviceBindings[0].alpn, ['h3', 'h2']);
  assert.deepEqual(inspected.serviceBindings[0].ipv4hint, ['104.16.1.2']);
});

test('resolve API normalizes Cloudflare JSON and reports ECH inspection', async () => {
  const fetcher = async (url, init) => {
    assert.match(String(url), /name=cloudflare-ech\.com/);
    assert.match(String(url), /type=HTTPS/);
    assert.equal(init.headers.Accept, 'application/dns-json');
    return Response.json({
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [{ name: 'cloudflare-ech.com.', type: 65 }],
      Answer: [{ name: 'cloudflare-ech.com.', type: 65, TTL: 120, data: '1 . alpn="h3,h2" ech="AEX+example=="' }]
    });
  };
  const request = new Request('https://dns.example/api/resolve?name=cloudflare-ech.com&type=HTTPS');
  const response = await handleResolveApi(request, {}, fetcher);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.query.type, 'HTTPS');
  assert.equal(data.answers[0].typeName, 'HTTPS');
  assert.equal(data.flags.ad, true);
  assert.equal(data.inspection.echAvailable, true);
});

test('resolve API rejects unsupported types and invalid names', async () => {
  let response = await handleResolveApi(new Request('https://dns.example/api/resolve?name=example.com&type=BOGUS'), {}, async () => { throw new Error('should not run'); });
  assert.equal(response.status, 400);
  response = await handleResolveApi(new Request('https://dns.example/api/resolve?name=bad%20name&type=A'), {}, async () => { throw new Error('should not run'); });
  assert.equal(response.status, 400);
});
