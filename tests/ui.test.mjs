import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { recordRuntime } from '../src/analytics.js';
import { dashboardPage } from '../src/ui.js';
import { adminPage, dashboardHomePage, queryLogPage } from '../src/pages.js';

function profilePayload() {
  const dns = (type, answers, inspection = { serviceBindings: [], echAvailable: false, echConfigs: [] }) => ({
    query: { name: 'cloudflare-ech.com', type }, resolver: 'cloudflare-dns.com', elapsedMs: 8,
    status: 0, statusName: 'NOERROR', dnssec: { authenticatedData: true }, bytes: { response: 96 }, answers, inspection
  });
  const inspection = {
    echAvailable: true,
    serviceBindings: [{ mode: 'service', priority: 1, target: '.', params: { alpn: ['h3','h2'], ipv4hint: ['104.16.1.2'], ipv6hint: ['2606:4700::1'], ech: { base64: 'AAECAwQ=' } } }],
    echConfigs: [{ versionHex: '0xfe0d', supportedVersion: true, configId: 7, publicName: 'cloudflare-ech.com', kem: 'DHKEM(X25519, HKDF-SHA256)', publicKeyBytes: 32, maximumNameLength: 0, extensions: [], cipherSuites: [{ kdf: 'HKDF-SHA256', aead: 'AES-128-GCM' }] }]
  };
  return {
    name: 'cloudflare-ech.com', elapsedMs: 17, dnssecRequested: true, errors: {},
    records: {
      A: dns('A', [{ name: 'cloudflare-ech.com', type: 1, typeName: 'A', ttl: 120, parsed: { address: '104.16.1.2' } }]),
      AAAA: dns('AAAA', [{ name: 'cloudflare-ech.com', type: 28, typeName: 'AAAA', ttl: 120, parsed: { address: '2606:4700::1' } }]),
      HTTPS: dns('HTTPS', [{ name: 'cloudflare-ech.com', type: 65, typeName: 'HTTPS', ttl: 120, parsed: { priority: 1, target: '.' } }], inspection)
    },
    summary: { ipv4: ['104.16.1.2'], ipv6: ['2606:4700::1'], alpn: ['h3','h2'], echAvailable: true, echConfigs: inspection.echConfigs }
  };
}

test('inspector core navigation and inspection work without JavaScript', () => {
  const html = dashboardPage({
    origin: 'https://dnsdash.example', mode: 'profile', name: 'cloudflare-ech.com', type: 'HTTPS',
    health: { upstreams: ['cloudflare-dns.com','dns.google','dns.quad9.net'] }
  });
  assert.match(html, /<form class="query" method="get" action="\/inspect">/);
  assert.match(html, /name="run" value="1"/);
  assert.match(html, /href="\/inspect\?run=1&amp;mode=profile&amp;name=google\.com/);
  assert.match(html, />Google<\/a>/);
  assert.match(html, /Inspector ready/);
  assert.match(html, /href="\/">Dashboard<\/a>/);
  assert.match(html, /https:\/\/dnsdash\.example\/dns-query/);
  assert.match(html, /Query history is written only when optional D1 logging is configured/);
});

test('inspector renders DNS records and ECH completely on the server', () => {
  const html = dashboardPage({
    origin: 'https://dnsdash.example', mode: 'profile', name: 'cloudflare-ech.com', type: 'HTTPS',
    health: { upstreams: ['cloudflare-dns.com'] }, result: profilePayload()
  });
  assert.match(html, /17 ms/);
  assert.match(html, /NOERROR/);
  assert.match(html, /104\.16\.1\.2/);
  assert.match(html, /2606:4700::1/);
  assert.match(html, /h3, h2/);
  assert.match(html, /ECH advertised/);
  assert.match(html, /DHKEM\(X25519, HKDF-SHA256\)/);
  assert.match(html, /Server rendered/);
});

test('Pi-hole home dashboard exposes firewall metrics and setup state', () => {
  const html = dashboardHomePage({
    authenticated: false, kvConfigured: false, d1Configured: false,
    firewall: { enabled: true, blockMode: 'nxdomain', allowCount: 1, denyCount: 2, sourceCount: 1, enabledSources: 1, gravity: { domains: 123 } },
    stats: { persistent: null, runtime: { total: 10, blocked: 4, allowed: 6, errors: 0, blockedPercent: 40, byType: [{ name:'A', count:8 }], topDomains: [], topBlocked: [] } }
  });
  assert.match(html, /DNS firewall/);
  assert.match(html, /Blocking enabled/);
  assert.match(html, />123</);
  assert.match(html, /Pi-hole storage is not fully configured/);
  assert.match(html, /href="\/admin"/);
  assert.match(html, /href="\/inspect"/);
});

test('admin page exposes Pi-hole controls after authentication', () => {
  const html = adminPage({
    configured: true, authenticated: true, kvConfigured: true, d1Configured: true,
    firewall: { enabled: true, configuredEnabled: true, paused: false, blockMode: 'nxdomain', gravity: { domains: 55 } },
    config: { allow: ['good.example'], deny: ['ads.example'], sources: [{ id:'s1', name:'List', url:'https://list.example/hosts', enabled:true }] }
  });
  assert.match(html, /Blocklist subscriptions/);
  assert.match(html, /Allowlist/);
  assert.match(html, /Denylist/);
  assert.match(html, /Refresh & compile lists/);
  assert.match(html, /Pause 30 sec/);
  assert.match(html, /Pause 5 min/);
  assert.match(html, /Pause 1 hour/);
  assert.match(html, /ads\.example/);
  assert.match(html, /clear-log/);
});

test('query page hides history without admin login', () => {
  const html = queryLogPage({ configured: true, authenticated: false, log: { configured: true, rows: [] } });
  assert.match(html, /Admin login is required/);
  assert.doesNotMatch(html, /Recent DNS queries/);
});

test('public stats redact domain names while admin bearer auth can see them', async () => {
  recordRuntime({ domain: 'private-history.example', qtype: 'A', action: 'blocked' });
  const env = { DNSDASH_ADMIN_TOKEN: 'test-secret' };

  const publicResponse = await worker.fetch(new Request('https://dnsdash.example/api/stats'), env, { waitUntil(){} });
  assert.equal(publicResponse.status, 200);
  const publicStats = await publicResponse.json();
  assert.deepEqual(publicStats.runtime.topDomains, []);
  assert.deepEqual(publicStats.runtime.topBlocked, []);
  assert.doesNotMatch(JSON.stringify(publicStats), /private-history\.example/);

  const adminResponse = await worker.fetch(new Request('https://dnsdash.example/api/stats', {
    headers: { Authorization: 'Bearer test-secret' }
  }), env, { waitUntil(){} });
  assert.equal(adminResponse.status, 200);
  const adminStats = await adminResponse.json();
  assert.match(JSON.stringify(adminStats.runtime.topDomains), /private-history\.example/);
  assert.match(JSON.stringify(adminStats.runtime.topBlocked), /private-history\.example/);
});

test('Worker root serves firewall dashboard and endpoint helpers', async () => {
  const env = { UPSTREAM_DOH: 'https://cloudflare-dns.com/dns-query', UPSTREAM_DOH_FALLBACKS: 'https://dns.google/dns-query,https://dns.quad9.net/dns-query', DNS_TIMEOUT_MS: '6000' };
  const root = await worker.fetch(new Request('https://dnsdash.example/'), env, { waitUntil(){} });
  assert.equal(root.status, 200);
  const html = await root.text();
  assert.match(html, /Manage firewall/);
  assert.match(html, /Gravity/);
  assert.match(html, /KV not connected/);

  const old = await worker.fetch(new Request('https://dnsdash.example/?run=1&mode=record&name=example.com&type=A'), env, { waitUntil(){} });
  assert.equal(old.status, 302);
  assert.match(old.headers.get('Location'), /^\/inspect\?/);

  const doh = await worker.fetch(new Request('https://dnsdash.example/doh.txt'), env, { waitUntil(){} });
  assert.equal(await doh.text(), 'https://dnsdash.example/dns-query\n');
  const ech = await worker.fetch(new Request('https://dnsdash.example/ech-helper.txt'), env, { waitUntil(){} });
  assert.equal(await ech.text(), 'cloudflare-ech.com+https://dnsdash.example/dns-query\n');
});
