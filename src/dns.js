const DEFAULT_DOH = 'https://cloudflare-dns.com/dns-query';
const MAX_DNS_MESSAGE = 65535;
const MIN_DNS_MESSAGE = 12;
const DEFAULT_TIMEOUT_MS = 6000;

export const DNS_TYPES = Object.freeze({
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  PTR: 12,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  SRV: 33,
  SVCB: 64,
  HTTPS: 65,
  CAA: 257
});

const TYPE_NAMES = Object.freeze(Object.fromEntries(
  Object.entries(DNS_TYPES).map(([name, value]) => [String(value), name])
));

export async function handleDoh(request, env = {}, fetcher = fetch) {
  if (request.method === 'OPTIONS') return corsPreflight('GET, POST, OPTIONS');
  if (request.method !== 'GET' && request.method !== 'POST') {
    return textResponse('Method Not Allowed', 405, { Allow: 'GET, POST, OPTIONS' });
  }

  const upstream = getUpstream(env);
  let upstreamUrl = upstream;
  let init;

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const encoded = url.searchParams.get('dns');
      if (!encoded) return textResponse('Missing dns query parameter', 400);
      validateWireMessage(decodeBase64Url(encoded));
      upstreamUrl = upstream + '?dns=' + encodeURIComponent(encoded);
      init = {
        method: 'GET',
        headers: { Accept: 'application/dns-message' }
      };
    } else {
      const contentType = (request.headers.get('Content-Type') || '').split(';', 1)[0].trim().toLowerCase();
      if (contentType !== 'application/dns-message') {
        return textResponse('Content-Type must be application/dns-message', 415);
      }
      const body = new Uint8Array(await request.arrayBuffer());
      validateWireMessage(body);
      init = {
        method: 'POST',
        headers: {
          Accept: 'application/dns-message',
          'Content-Type': 'application/dns-message'
        },
        body
      };
    }
  } catch (error) {
    return textResponse(error?.message || 'Invalid DNS query', error?.status || 400);
  }

  try {
    const response = await fetchWithTimeout(fetcher, upstreamUrl, init, timeoutFromEnv(env));
    const headers = dohHeaders();
    headers.set('Content-Type', 'application/dns-message');
    headers.set('Cache-Control', response.headers.get('Cache-Control') || 'no-store');
    if (!response.ok) {
      return textResponse('Upstream resolver error', response.status >= 400 ? response.status : 502);
    }
    return new Response(response.body, { status: 200, headers });
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return textResponse(timedOut ? 'Resolver timeout' : 'Resolver unavailable', timedOut ? 504 : 502);
  }
}

export async function handleResolveApi(request, env = {}, fetcher = fetch) {
  if (request.method === 'OPTIONS') return corsPreflight('GET, OPTIONS');
  if (request.method !== 'GET') return jsonResponse({ error: 'Method Not Allowed' }, 405, { Allow: 'GET, OPTIONS' });

  const url = new URL(request.url);
  const name = normalizeName(url.searchParams.get('name') || '');
  if (!isValidDnsName(name)) return jsonResponse({ error: 'Invalid DNS name' }, 400);

  const type = normalizeType(url.searchParams.get('type') || 'A');
  if (!type) return jsonResponse({ error: 'Unsupported DNS type' }, 400);

  const upstream = getUpstream(env);
  const query = new URL(upstream);
  query.searchParams.set('name', name);
  query.searchParams.set('type', type.name);

  const started = Date.now();
  try {
    const response = await fetchWithTimeout(fetcher, query.toString(), {
      method: 'GET',
      headers: { Accept: 'application/dns-json' }
    }, timeoutFromEnv(env));

    if (!response.ok) {
      return jsonResponse({ error: 'Upstream resolver error', upstreamStatus: response.status }, 502);
    }

    const data = await response.json();
    const answers = Array.isArray(data?.Answer) ? data.Answer : [];
    return jsonResponse({
      query: { name, type: type.name, code: type.code },
      resolver: new URL(upstream).hostname,
      elapsedMs: Date.now() - started,
      status: Number(data?.Status ?? 0),
      flags: {
        tc: Boolean(data?.TC),
        rd: Boolean(data?.RD),
        ra: Boolean(data?.RA),
        ad: Boolean(data?.AD),
        cd: Boolean(data?.CD)
      },
      question: Array.isArray(data?.Question) ? data.Question : [],
      answers: answers.map(answer => ({
        name: String(answer?.name || ''),
        type: Number(answer?.type || 0),
        typeName: typeName(answer?.type),
        ttl: Number(answer?.TTL || 0),
        data: String(answer?.data || '')
      })),
      authority: Array.isArray(data?.Authority) ? data.Authority : [],
      inspection: inspectServiceBindingAnswers(answers)
    });
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return jsonResponse({ error: timedOut ? 'Resolver timeout' : 'Resolver unavailable' }, timedOut ? 504 : 502);
  }
}

export function inspectServiceBindingAnswers(answers = []) {
  const records = [];
  for (const answer of answers) {
    const type = Number(answer?.type);
    if (type !== DNS_TYPES.HTTPS && type !== DNS_TYPES.SVCB) continue;
    const parsed = parseServiceBindingData(String(answer?.data || ''));
    if (!parsed) continue;
    records.push({
      type: typeName(type),
      ttl: Number(answer?.TTL || 0),
      priority: parsed.priority,
      target: parsed.target,
      alpn: splitCsv(parsed.params.alpn),
      ipv4hint: splitCsv(parsed.params.ipv4hint),
      ipv6hint: splitCsv(parsed.params.ipv6hint),
      port: parsed.params.port ? Number(parsed.params.port) || null : null,
      ech: parsed.params.ech || '',
      echBytesApprox: parsed.params.ech ? Math.floor(parsed.params.ech.replace(/=+$/, '').length * 3 / 4) : 0,
      params: parsed.params
    });
  }
  return { serviceBindings: records, echAvailable: records.some(record => Boolean(record.ech)) };
}

export function parseServiceBindingData(value) {
  const input = String(value || '').trim();
  if (!input) return null;
  const tokens = tokenizeRecord(input);
  if (tokens.length < 2) return null;
  const priority = Number(tokens.shift());
  if (!Number.isInteger(priority) || priority < 0 || priority > 65535) return null;
  const target = tokens.shift();
  const params = {};
  for (const token of tokens) {
    const eq = token.indexOf('=');
    if (eq < 0) {
      params[token.toLowerCase()] = true;
      continue;
    }
    const key = token.slice(0, eq).toLowerCase();
    params[key] = unquote(token.slice(eq + 1));
  }
  return { priority, target, params };
}

export function decodeBase64Url(value) {
  const text = String(value || '').trim();
  if (!text || !/^[A-Za-z0-9_-]+={0,2}$/.test(text)) throw badRequest('Invalid base64url DNS query');
  const raw = text.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = raw + '='.repeat((4 - raw.length % 4) % 4);
  let binary;
  try {
    binary = atob(padded);
  } catch {
    throw badRequest('Invalid base64url DNS query');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function typeName(code) {
  return TYPE_NAMES[String(Number(code))] || String(Number(code) || 0);
}

function validateWireMessage(bytes) {
  if (!(bytes instanceof Uint8Array)) throw badRequest('Invalid DNS message');
  if (bytes.byteLength < MIN_DNS_MESSAGE) throw badRequest('DNS query is too small');
  if (bytes.byteLength > MAX_DNS_MESSAGE) {
    const error = new Error('DNS query is too large');
    error.status = 413;
    throw error;
  }
}

function normalizeType(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (DNS_TYPES[raw]) return { name: raw, code: DNS_TYPES[raw] };
  if (/^\d+$/.test(raw)) {
    const code = Number(raw);
    if (TYPE_NAMES[String(code)]) return { name: TYPE_NAMES[String(code)], code };
  }
  return null;
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/, 1)[0].replace(/\.$/, '');
}

function isValidDnsName(name) {
  if (!name || name.length > 253) return false;
  const labels = name.split('.');
  return labels.every((label, index) => {
    if (!label || label.length > 63) return false;
    if (index === 0 && label === '*') return true;
    return /^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$/i.test(label);
  });
}

function getUpstream(env) {
  const candidate = String(env?.UPSTREAM_DOH || DEFAULT_DOH).trim();
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') throw new Error();
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_DOH;
  }
}

function timeoutFromEnv(env) {
  const value = Number(env?.DNS_TIMEOUT_MS);
  return Number.isFinite(value) ? Math.max(1000, Math.min(15000, Math.trunc(value))) : DEFAULT_TIMEOUT_MS;
}

async function fetchWithTimeout(fetcher, input, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function tokenizeRecord(input) {
  const tokens = [];
  let current = '';
  let quoted = false;
  let escaped = false;
  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      current += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      current += char;
      continue;
    }
    if (/\s/.test(char) && !quoted) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function unquote(value) {
  const text = String(value || '');
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return text;
}

function splitCsv(value) {
  if (!value || value === true) return [];
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function corsPreflight(methods) {
  return new Response(null, { status: 204, headers: baseHeaders({ Allow: methods }) });
}

function dohHeaders(extra = {}) {
  return baseHeaders(extra);
}

function baseHeaders(extra = {}) {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    ...extra
  });
  return headers;
}

function textResponse(message, status = 200, extra = {}) {
  const headers = baseHeaders({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  return new Response(message, { status, headers });
}

function jsonResponse(value, status = 200, extra = {}) {
  const headers = baseHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  return new Response(JSON.stringify(value, null, 2), { status, headers });
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}
