import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { dashboardApp } from '../src/app.js';
import { dashboardPage } from '../src/ui.js';

const APP_SCRIPT = `(${dashboardApp.toString()})();`;

function profilePayload() {
  const dns = (type, answers, inspection = { serviceBindings: [], echAvailable: false, echConfigs: [] }) => ({
    query: { name: 'cloudflare-ech.com', type },
    resolver: 'cloudflare-dns.com',
    elapsedMs: 8,
    status: 0,
    statusName: 'NOERROR',
    dnssec: { authenticatedData: true },
    bytes: { response: 96 },
    answers,
    inspection
  });

  const echInspection = {
    echAvailable: true,
    serviceBindings: [{
      mode: 'service',
      priority: 1,
      target: '.',
      params: {
        alpn: ['h3', 'h2'],
        ipv4hint: ['104.16.1.2'],
        ipv6hint: ['2606:4700::1'],
        ech: { base64: 'AAECAwQ=' }
      }
    }],
    echConfigs: [{
      versionHex: '0xfe0d',
      supportedVersion: true,
      configId: 7,
      publicName: 'cloudflare-ech.com',
      kem: 'DHKEM(X25519, HKDF-SHA256)',
      publicKeyBytes: 32,
      maximumNameLength: 0,
      extensions: [],
      cipherSuites: [{ kdf: 'HKDF-SHA256', aead: 'AES-128-GCM' }]
    }]
  };

  return {
    name: 'cloudflare-ech.com',
    elapsedMs: 17,
    dnssecRequested: true,
    records: {
      A: dns('A', [{ name: 'cloudflare-ech.com', type: 1, typeName: 'A', ttl: 120, parsed: { address: '104.16.1.2' } }]),
      AAAA: dns('AAAA', [{ name: 'cloudflare-ech.com', type: 28, typeName: 'AAAA', ttl: 120, parsed: { address: '2606:4700::1' } }]),
      HTTPS: dns('HTTPS', [{ name: 'cloudflare-ech.com', type: 65, typeName: 'HTTPS', ttl: 120, parsed: { priority: 1, target: '.' } }], echInspection)
    },
    errors: {},
    summary: {
      ipv4: ['104.16.1.2'],
      ipv6: ['2606:4700::1'],
      alpn: ['h3', 'h2'],
      echAvailable: true,
      echConfigs: echInspection.echConfigs
    }
  };
}

async function waitFor(predicate, timeoutMs = 800) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('condition did not become true');
}

test('dashboard runtime is inline, nonce protected and independent of /app.js loading', () => {
  assert.doesNotThrow(() => new Function(APP_SCRIPT));
  const html = dashboardPage(APP_SCRIPT, 'testnonce123');
  assert.match(html, /<script nonce="testnonce123" data-cfasync="false">/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.match(html, /Resolver ready/);
});

test('final HTML document boots, resolves health/profile, renders DNS cards and ECH', async () => {
  const dom = new JSDOM(dashboardPage(APP_SCRIPT, 'testnonce123'), {
    url: 'https://dnsdash.example/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = async (input) => {
        const url = new URL(String(input), 'https://dnsdash.example/');
        if (url.pathname === '/health') {
          return { ok: true, json: async () => ({ ok: true, upstreams: ['cloudflare-dns.com'] }) };
        }
        if (url.pathname === '/api/profile') {
          return { ok: true, json: async () => profilePayload() };
        }
        throw new Error('unexpected fetch ' + url.pathname);
      };
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => {} }
      });
    }
  });

  try {
    await waitFor(() => dom.window.document.getElementById('healthText').textContent === 'Resolver ready');
    await waitFor(() => dom.window.document.getElementById('latency').textContent === '17 ms');

    assert.equal(dom.window.document.getElementById('healthText').textContent, 'Resolver ready');
    assert.match(dom.window.document.getElementById('resolverList').textContent, /primary · cloudflare-dns\.com/);
    assert.equal(dom.window.document.getElementById('rcode').textContent, 'NOERROR');
    assert.equal(dom.window.document.getElementById('dnssec').textContent, 'AD');
    assert.equal(dom.window.document.getElementById('answersCount').textContent, '3');
    assert.match(dom.window.document.getElementById('answerCards').textContent, /104\.16\.1\.2/);
    assert.match(dom.window.document.getElementById('answerCards').textContent, /HTTPS/);
    assert.match(dom.window.document.getElementById('echArea').textContent, /ECH advertised/);
    assert.match(dom.window.document.getElementById('echArea').textContent, /cloudflare-ech\.com/);
    assert.doesNotMatch(dom.window.document.body.textContent, /Loading…/);

    const googleButton = [...dom.window.document.querySelectorAll('.chip')].find(el => el.textContent === 'Google');
    googleButton.click();
    assert.equal(dom.window.document.getElementById('name').value, 'google.com');
  } finally {
    dom.window.close();
  }
});
