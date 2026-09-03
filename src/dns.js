import {
  DNS_TYPES,
  buildDnsQuery,
  parseDnsMessage,
  rcodeName,
  serviceBindingInspection,
  typeName,
  validateDnsQuery,
  validateDnsResponse
} from './wire.js';

const DEFAULT_DOH = 'https://cloudflare-dns.com/dns-query';
const MAX_DNS_MESSAGE = 65535;
const MIN_DNS_MESSAGE = 12;
const DEFAULT_TIMEOUT_MS = 6000;
const MAX_UPSTREAMS = 4;

export { DNS_TYPES, parseDnsMessage, serviceBindingInspection, typeName } from './wire.js';

export async function handleDoh(request, env = {}, fetcher = fetch) {
  if (request.method === 'OPTIONS') return corsPreflight('GET, POST, OPTIONS');
  if (request.method !== 'GET' && request.method !== 'POST') {
    return textResponse('Method Not Allowed', 405, { Allow: 'GET, POST, OPTIONS' });
  }

  let queryBytes;
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const encoded = url.searchParams.get('dns');
      if (!encoded) return textResponse('Missing dns query parameter', 400);
      queryBytes = decodeBase64Url(encoded);
    } else {
      const contentType = mediaType(request.headers.get('Content-Type'));
      if (contentType !== 'application/dns-message') return textResponse('Content-Type must be application/dns-message', 415);
      const contentLength = Number(request.headers.get('Content-Length') || 0);
      if (contentLength > MAX_DNS_MESSAGE) return textResponse('DNS query is too large', 413);
      queryBytes = new Uint8Array(await request.arrayBuffer());
    }
    validateWireSize(queryBytes);
    validateDnsQuery(queryBytes);
  } catch (error) {
    return textResponse(error?.message || 'Invalid DNS query', statusFromError(error, 400));
  }

  try {
    const result = await resolveWire(queryBytes, env, fetcher);
    const headers = baseHeaders({
      'Content-Type': 'application/dns-message',
      'Cache-Control': result.cacheControl || cacheControlFromDns(result.parsed),
      'Server-Timing': `dns;dur=${result.elapsedMs}`,
      'X-DNS-Upstream': safeHostname(result.upstream)
    });
    return new Response(result.bytes, { status: 200, headers });
  } catch (error) {
    return resolverFailure(error);
  }
}

export async function handleResolveApi(request, env = {}, fetcher = fetch) {
  if (request.method === 'OPTIONS') return corsPreflight('GET, OPTIONS');
  if (request.method !== 'GET') return jsonResponse({ error: 'Method Not Allowed' }, 405, { Allow: 'GET, OPTIONS' });

  const url = new URL(request.url);
  const name = normalizeQueryName(url.searchParams.get('name') || '');
  if (!isValidDnsName(name)) return jsonResponse({ error: 'Invalid DNS name' }, 400);
  const type = normalizeType(url.searchParams.get('type') || 'A');
  if (!type) return jsonResponse({ error: 'Unsupported DNS type' }, 400);
  const dnssec = url.searchParams.get('dnssec') !== '0';
  const checkingDisabled = url.searchParams.get('cd') === '1';

  try {
    const result = await resolveName({ name, type, dnssec, checkingDisabled }, env, fetcher);
    return jsonResponse(result);
  } catch (error) {
    return resolverFailure(error, true);
  }
}

export async function handleProfileApi(request, env = {}, fetcher = fetch) {
  if (request.method === 'OPTIONS') return corsPreflight('GET, OPTIONS');
  if (request.method !== 'GET') return jsonResponse({ error: 'Method Not Allowed' }, 405, { Allow: 'GET, OPTIONS' });
  const url = new URL(request.url);
  const name = normalizeQueryName(url.searchParams.get('name') || '');
  if (!isValidDnsName(name)) return jsonResponse({ error: 'Invalid DNS name' }, 400);
  const dnssec = url.searchParams.get('dnssec') !== '0';
  const started = Date.now();
  const types = ['A', 'AAAA', 'HTTPS'];
  const settled = await Promise.allSettled(types.map(type => resolveName({ name, type: normalizeType(type), dnssec, checkingDisabled: false }, env, fetcher)));
  const records = {};
  const errors = {};
  for (let i = 0; i < types.length; i++) {
    const entry = settled[i];
    if (entry.status === 'fulfilled') records[types[i]] = entry.value;
    else errors[types[i]] = entry.reason?.message || 'Resolver unavailable';
  }
  const httpsInspection = records.HTTPS?.inspection || { serviceBindings: [], echAvailable: false, echConfigs: [] };
  return jsonResponse({
    name,
    elapsedMs: Date.now() - started,
    dnssecRequested: dnssec,
    records,
    errors,
    summary: {
      ipv4: (records.A?.answers || []).filter(rr => rr.type === DNS_TYPES.A).map(rr => rr.parsed?.address).filter(Boolean),
      ipv6: (records.AAAA?.answers || []).filter(rr => rr.type === DNS_TYPES.AAAA).map(rr => rr.parsed?.address).filter(Boolean),
      echAvailable: httpsInspection.echAvailable,
      echConfigs: httpsInspection.echConfigs,
      alpn: unique((httpsInspection.serviceBindings || []).flatMap(record => record.params?.alpn || []))
    }
  }, Object.keys(records).length ? 200 : 502);
}

export function healthPayload(env = {}) {
  const upstreams = getUpstreams(env);
  return {
    ok: true,
    service: 'dnsdash',
    version: '2.0.0',
    protocol: 'RFC 8484 DNS-over-HTTPS',
    upstreams: upstreams.map(safeHostname),
    timeoutMs: timeoutFromEnv(env),
    features: ['wire-doh', 'dnssec-do', 'https-svcb', 'ech-rfc9849', 'profile']
  };
}

export async function resolveName({ name, type, dnssec = true, checkingDisabled = false }, env = {}, fetcher = fetch) {
  const normalizedType = typeof type === 'object' ? type : normalizeType(type);
  if (!normalizedType) throw httpError('Unsupported DNS type', 400);
  const queryBytes = buildDnsQuery(name, normalizedType.code, { dnssec, checkingDisabled });
  const result = await resolveWire(queryBytes, env, fetcher);
  const parsed = result.parsed;
  return {
    query: { name, type: normalizedType.name, code: normalizedType.code, dnssec, checkingDisabled },
    resolver: safeHostname(result.upstream),
    upstreamIndex: result.upstreamIndex,
    elapsedMs: result.elapsedMs,
    status: parsed.flags.rcode,
    statusName: rcodeName(parsed.flags.rcode),
    flags: parsed.flags,
    counts: parsed.counts,
    minTtl: parsed.minTtl,
    bytes: { query: queryBytes.length, response: result.bytes.length },
    question: parsed.question,
    answers: parsed.answer.map(recordForJson),
    authority: parsed.authority.map(recordForJson),
    additional: parsed.additional.map(recordForJson),
    inspection: serviceBindingInspection(parsed.answer),
    dnssec: {
      requested: dnssec,
      authenticatedData: parsed.flags.ad,
      checkingDisabled: parsed.flags.cd
    }
  };
}

export async function resolveWire(queryBytes, env = {}, fetcher = fetch) {
  validateWireSize(queryBytes);
  const query = validateDnsQuery(queryBytes);
  const upstreams = getUpstreams(env);
  const timeoutMs = timeoutFromEnv(env);
  const errors = [];
  for (let i = 0; i < upstreams.length; i++) {
    const upstream = upstreams[i];
    const started = Date.now();
    try {
      const response = await fetchWithTimeout(fetcher, upstream, {
        method: 'POST',
        headers: {
          Accept: 'application/dns-message',
          'Content-Type': 'application/dns-message'
        },
        body: queryBytes
      }, timeoutMs);
      if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
      const contentType = mediaType(response.headers.get('Content-Type'));
      if (contentType && contentType !== 'application/dns-message') throw new Error(`unexpected content type ${contentType}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      validateWireSize(bytes);
      const parsed = validateDnsResponse(bytes, query);
      return {
        bytes,
        parsed,
        upstream,
        upstreamIndex: i,
        elapsedMs: Date.now() - started,
        cacheControl: response.headers.get('Cache-Control') || ''
      };
    } catch (error) {
      errors.push(`${safeHostname(upstream)}: ${error?.name === 'AbortError' ? 'timeout' : error?.message || error}`);
    }
  }
  const error = new Error(`All DNS upstreams failed (${errors.join(' | ')})`);
  error.status = errors.some(item => item.includes('timeout')) ? 504 : 502;
  throw error;
}

export function decodeBase64Url(value) {
  const text = String(value || '').trim();
  if (!text || !/^[A-Za-z0-9_-]+={0,2}$/.test(text)) throw httpError('Invalid base64url DNS query', 400);
  const raw = text.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = raw + '='.repeat((4 - raw.length % 4) % 4);
  let binary;
  try {
    binary = atob(padded);
  } catch {
    throw httpError('Invalid base64url DNS query', 400);
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function getUpstreams(env = {}) {
  const raw = [env?.UPSTREAM_DOH, env?.UPSTREAM_DOH_FALLBACKS].filter(Boolean).join(',');
  const candidates = raw ? raw.split(/[\n,]+/) : [DEFAULT_DOH];
  const result = [];
  for (const candidate of candidates) {
    const normalized = normalizeUpstream(candidate);
    if (normalized && !result.includes(normalized)) result.push(normalized);
    if (result.length >= MAX_UPSTREAMS) break;
  }
  return result.length ? result : [DEFAULT_DOH];
}

function normalizeUpstream(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function normalizeType(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (DNS_TYPES[raw] && raw !== 'OPT') return { name: raw, code: DNS_TYPES[raw] };
  if (/^\d+$/.test(raw)) {
    const code = Number(raw);
    const name = typeName(code);
    if (code >= 1 && code <= 65535 && code !== DNS_TYPES.OPT) return { name, code };
  }
  return null;
}

function normalizeQueryName(value) {
  let raw = String(value || '').trim();
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = new URL(raw).hostname;
  } catch {}
  raw = raw.split(/[/?#]/, 1)[0].replace(/\.$/, '').toLowerCase();
  if (/[^\x00-\x7f]/.test(raw) && !raw.includes('_')) {
    try { raw = new URL(`https://${raw}`).hostname; } catch {}
  }
  return raw;
}

function isValidDnsName(name) {
  if (!name || name.length > 253 || /\s/.test(name)) return false;
  const labels = name.split('.');
  return labels.every(label => label.length > 0 && label.length <= 63 && /^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$/i.test(label));
}

function recordForJson(rr) {
  return {
    name: rr.name,
    type: rr.type,
    typeName: rr.typeName,
    class: rr.class,
    ttl: rr.ttl,
    rdlength: rr.rdlength,
    data: rr.data,
    parsed: rr.parsed
  };
}

function validateWireSize(bytes) {
  if (!(bytes instanceof Uint8Array)) throw httpError('Invalid DNS message', 400);
  if (bytes.byteLength < MIN_DNS_MESSAGE) throw httpError('DNS message is too small', 400);
  if (bytes.byteLength > MAX_DNS_MESSAGE) throw httpError('DNS message is too large', 413);
}

function cacheControlFromDns(parsed) {
  const ttl = Math.max(0, Math.min(86400, Number(parsed?.minTtl || 0)));
  return ttl ? `public, max-age=${ttl}` : 'no-store';
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

function mediaType(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

function safeHostname(value) {
  try { return new URL(value).hostname; } catch { return 'resolver'; }
}

function statusFromError(error, fallback) {
  const value = Number(error?.status);
  return Number.isInteger(value) && value >= 400 && value <= 599 ? value : fallback;
}

function resolverFailure(error, json = false) {
  const status = statusFromError(error, error?.name === 'AbortError' ? 504 : 502);
  const message = status === 504 ? 'Resolver timeout' : 'Resolver unavailable';
  return json ? jsonResponse({ error: message, detail: error?.message || '' }, status) : textResponse(message, status);
}

function corsPreflight(methods) {
  return new Response(null, { status: 204, headers: baseHeaders({ Allow: methods }) });
}

function baseHeaders(extra = {}) {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Expose-Headers': 'Server-Timing, X-DNS-Upstream',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    ...extra
  });
}

function textResponse(message, status = 200, extra = {}) {
  return new Response(message, { status, headers: baseHeaders({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...extra }) });
}

function jsonResponse(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value, null, 2), { status, headers: baseHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }) });
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
