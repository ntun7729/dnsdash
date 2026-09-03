import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { dashboardApp } from '../src/app.js';
import { dashboardPage } from '../src/ui.js';

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

async function waitFor(predicate, timeoutMs = 500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('condition did not become true');
}

test('dashboard client source is syntactically valid and loaded as an external script', () => {
  assert.doesNotThrow(() => new Function('(' + dashboardApp.toString() + ');'));
  const html = dashboardPage();
  assert.match(html, /<script src="\/app\.js\?v=2\.1\.0" defer><\/script>/);
  assert.doesNotMatch(html, /<script>\s*\(function/);
});

test('dashboard boots, resolves health/profile, renders DNS cards and ECH', async () => {
  const dom = new JSDOM(dashboardPage(), {
    url: 'https://dnsdash.example/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });

  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
    location: globalThis.location,
    fetch: globalThis.fetch
  };

  Object.defineProperties(globalThis, {
    window: { value: dom.window, configurable: true, writable: true },
    document: { value: dom.window.document, configurable: true, writable: true },
    navigator: { value: dom.window.navigator, configurable: true, writable: true },
    location: { value: dom.window.location, configurable: true, writable: true }
  });

  globalThis.fetch = async (input) => {
    const url = new URL(String(input), 'https://dnsdash.example/');
    if (url.pathname === '/health') {
      return Response.json({ ok: true, upstreams: ['cloudflare-dns.com'] });
    }
    if (url.pathname === '/api/profile') {
      return Response.json(profilePayload());
    }
    throw new Error('unexpected fetch ' + url.pathname);
  };

  try {
    dashboardApp();
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
  } finally {
    dom.window.close();
    Object.defineProperties(globalThis, {
      window: { value: previous.window, configurable: true, writable: true },
      document: { value: previous.document, configurable: true, writable: true },
      navigator: { value: previous.navigator, configurable: true, writable: true },
      location: { value: previous.location, configurable: true, writable: true }
    });
    globalThis.fetch = previous.fetch;
  }
});
