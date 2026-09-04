import { DNS_TYPES } from './wire.js';

const CONFIG_KEY = 'firewall:config:v1';
const META_KEY = 'firewall:gravity:meta:v1';
const SHARD_PREFIX = 'firewall:gravity:shard:v1:';
const SHARDS = 64;
const CONFIG_CACHE_MS = 15000;
const SHARD_CACHE_MS = 60000;
const MAX_SOURCES = 8;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_GRAVITY_DOMAINS = 300000;
const MAX_PAUSE_SECONDS = 24 * 3600;

let configCache = { at: 0, value: null };
const shardCache = new Map();

export function hasKv(env = {}) {
  return Boolean(env.DNSDASH_KV && typeof env.DNSDASH_KV.get === 'function' && typeof env.DNSDASH_KV.put === 'function');
}

export function defaultFirewallConfig(env = {}) {
  return {
    enabled: String(env.DNSDASH_BLOCKING ?? '1') !== '0',
    disabledUntil: 0,
    blockMode: normalizeBlockMode(env.DNSDASH_BLOCK_MODE || 'nxdomain'),
    allow: parseRuleList(env.DNSDASH_ALLOW || ''),
    deny: parseRuleList(env.DNSDASH_DENY || ''),
    sources: []
  };
}

export async function getFirewallConfig(env = {}, { fresh = false } = {}) {
  const base = defaultFirewallConfig(env);
  if (!hasKv(env)) return base;
  if (!fresh && configCache.value && Date.now() - configCache.at < CONFIG_CACHE_MS) return configCache.value;
  try {
    const raw = await env.DNSDASH_KV.get(CONFIG_KEY, 'json');
    const value = sanitizeConfig(raw, base);
    configCache = { at: Date.now(), value };
    return value;
  } catch {
    return base;
  }
}

export async function saveFirewallConfig(env, next) {
  if (!hasKv(env)) throw new Error('DNSDASH_KV binding is required for persistent firewall settings');
  const value = sanitizeConfig(next, defaultFirewallConfig(env));
  await env.DNSDASH_KV.put(CONFIG_KEY, JSON.stringify(value));
  configCache = { at: Date.now(), value };
  return value;
}

export async function getFirewallStatus(env = {}) {
  const config = await getFirewallConfig(env);
  let gravity = { domains: 0, shards: SHARDS, lastUpdated: 0, sources: [], errors: [] };
  if (hasKv(env)) {
    try {
      const meta = await env.DNSDASH_KV.get(META_KEY, 'json');
      if (meta && typeof meta === 'object') gravity = { ...gravity, ...meta };
    } catch {}
  }
  const paused = config.enabled && config.disabledUntil > Date.now();
  return {
    enabled: config.enabled && !paused,
    configuredEnabled: config.enabled,
    paused,
    disabledUntil: paused ? config.disabledUntil : 0,
    blockMode: config.blockMode,
    allowCount: config.allow.length,
    denyCount: config.deny.length,
    sourceCount: config.sources.length,
    enabledSources: config.sources.filter(x => x.enabled).length,
    kvConfigured: hasKv(env),
    gravity
  };
}

export async function evaluateFirewall(parsedQuery, env = {}) {
  const question = parsedQuery?.question?.[0];
  if (!question) return { blocked: false, action: 'allowed', source: 'no-question', domain: '', qtype: '' };
  const domain = normalizeDomain(question.name);
  const qtype = question.typeName || String(question.type || '');
  const config = await getFirewallConfig(env);

  const allowedRule = matchRules(domain, config.allow);
  if (allowedRule) return { blocked: false, action: 'allowed', source: `allow:${allowedRule}`, domain, qtype };
  if (!config.enabled) return { blocked: false, action: 'allowed', source: 'blocking-disabled', domain, qtype };
  if (config.disabledUntil > Date.now()) return { blocked: false, action: 'allowed', source: 'blocking-paused', domain, qtype };

  const deniedRule = matchRules(domain, config.deny);
  if (deniedRule) return { blocked: true, action: 'blocked', source: `deny:${deniedRule}`, domain, qtype, blockMode: config.blockMode };

  if (hasKv(env) && domain) {
    const hit = await gravityHasDomain(env, domain);
    if (hit) return { blocked: true, action: 'blocked', source: 'gravity', domain, qtype, blockMode: config.blockMode };
  }
  return { blocked: false, action: 'allowed', source: 'upstream', domain, qtype };
}

export function buildBlockedResponse(queryBytes, parsedQuery, mode = 'nxdomain') {
  const q = parsedQuery?.question?.[0];
  if (!q) throw new Error('Cannot build blocked response without a DNS question');
  const qname = encodeName(q.name);
  const question = new Uint8Array(qname.length + 4);
  question.set(qname, 0);
  const qv = new DataView(question.buffer);
  qv.setUint16(qname.length, q.type);
  qv.setUint16(qname.length + 2, q.class || 1);

  const normalizedMode = normalizeBlockMode(mode);
  const canZero = normalizedMode === 'zero' && (q.type === DNS_TYPES.A || q.type === DNS_TYPES.AAAA);
  const answerLength = canZero ? 12 + (q.type === DNS_TYPES.A ? 4 : 16) : 0;
  const out = new Uint8Array(12 + question.length + answerLength);
  const view = new DataView(out.buffer);
  view.setUint16(0, parsedQuery.id & 0xffff);
  let flags = 0x8000 | 0x0080;
  if (parsedQuery.flags?.rd) flags |= 0x0100;
  if (parsedQuery.flags?.cd) flags |= 0x0010;
  if (normalizedMode === 'nxdomain') flags |= 0x0003;
  else if (normalizedMode === 'refused') flags |= 0x0005;
  view.setUint16(2, flags);
  view.setUint16(4, 1);
  view.setUint16(6, canZero ? 1 : 0);
  view.setUint16(8, 0);
  view.setUint16(10, 0);
  out.set(question, 12);

  if (canZero) {
    let p = 12 + question.length;
    out[p++] = 0xc0; out[p++] = 0x0c;
    view.setUint16(p, q.type); p += 2;
    view.setUint16(p, q.class || 1); p += 2;
    view.setUint32(p, 60); p += 4;
    const rdlength = q.type === DNS_TYPES.A ? 4 : 16;
    view.setUint16(p, rdlength); p += 2;
    out.fill(0, p, p + rdlength);
  }
  return out;
}

export async function mutateFirewall(env, action, payload = {}) {
  const config = await getFirewallConfig(env, { fresh: true });
  if (action === 'set-enabled') {
    config.enabled = payload.enabled === true || payload.enabled === '1' || payload.enabled === 'true';
    if (!config.enabled) config.disabledUntil = 0;
  }
  else if (action === 'set-mode') config.blockMode = normalizeBlockMode(payload.blockMode);
  else if (action === 'pause') {
    const seconds = Math.max(1, Math.min(MAX_PAUSE_SECONDS, Math.trunc(Number(payload.seconds) || 0)));
    config.disabledUntil = Date.now() + seconds * 1000;
  }
  else if (action === 'resume') config.disabledUntil = 0;
  else if (action === 'add-allow') config.allow = addRule(config.allow, payload.rule);
  else if (action === 'remove-allow') config.allow = removeRule(config.allow, payload.rule);
  else if (action === 'add-deny') config.deny = addRule(config.deny, payload.rule);
  else if (action === 'remove-deny') config.deny = removeRule(config.deny, payload.rule);
  else if (action === 'add-source') config.sources = addSource(config.sources, payload.name, payload.url);
  else if (action === 'toggle-source') config.sources = config.sources.map(s => s.id === payload.id ? { ...s, enabled: payload.enabled === '1' || payload.enabled === true } : s);
  else if (action === 'remove-source') config.sources = config.sources.filter(s => s.id !== payload.id);
  else throw new Error('Unsupported firewall action');
  return saveFirewallConfig(env, config);
}

export async function refreshBlocklists(env = {}, fetcher = fetch) {
  if (!hasKv(env)) throw new Error('DNSDASH_KV binding is required to compile blocklists');
  const config = await getFirewallConfig(env, { fresh: true });
  const sources = config.sources.filter(s => s.enabled).slice(0, MAX_SOURCES);
  const domains = new Set();
  const results = [];
  const errors = [];

  for (const source of sources) {
    try {
      const response = await fetcher(source.url, {
        headers: { Accept: 'text/plain,*/*;q=0.5', 'User-Agent': 'DNS-Dash/3.0 blocklist compiler' },
        redirect: 'follow'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const length = Number(response.headers.get('content-length') || 0);
      if (length > MAX_SOURCE_BYTES) throw new Error(`source exceeds ${MAX_SOURCE_BYTES} bytes`);
      const text = await response.text();
      if (text.length > MAX_SOURCE_BYTES) throw new Error(`source exceeds ${MAX_SOURCE_BYTES} bytes`);
      const parsed = parseBlocklist(text, MAX_GRAVITY_DOMAINS - domains.size);
      for (const d of parsed) {
        domains.add(d);
        if (domains.size >= MAX_GRAVITY_DOMAINS) break;
      }
      results.push({ id: source.id, name: source.name, url: source.url, domains: parsed.length, ok: true });
      if (domains.size >= MAX_GRAVITY_DOMAINS) break;
    } catch (error) {
      const item = { id: source.id, name: source.name, url: source.url, ok: false, error: error?.message || 'fetch failed' };
      results.push(item); errors.push(item);
    }
  }

  const buckets = Array.from({ length: SHARDS }, () => []);
  for (const domain of domains) buckets[shardFor(domain)].push(domain);
  await Promise.all(buckets.map((list, i) => env.DNSDASH_KV.put(SHARD_PREFIX + i, list.sort().join('\n'))));
  const meta = {
    domains: domains.size,
    shards: SHARDS,
    lastUpdated: Date.now(),
    sources: results,
    errors,
    capped: domains.size >= MAX_GRAVITY_DOMAINS
  };
  await env.DNSDASH_KV.put(META_KEY, JSON.stringify(meta));
  shardCache.clear();
  return meta;
}

export function parseBlocklist(text, limit = MAX_GRAVITY_DOMAINS) {
  const out = [];
  const seen = new Set();
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    if (out.length >= Math.max(0, limit)) break;
    let line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('!') || line.startsWith('@@')) continue;
    let domain = '';
    const adblock = line.match(/^\|\|([^\^/$*|]+)\^/);
    if (adblock) domain = adblock[1];
    else {
      line = line.split('#', 1)[0].trim();
      const parts = line.split(/\s+/);
      if (parts.length >= 2 && /^(?:0\.0\.0\.0|127\.0\.0\.1|::1?)$/.test(parts[0])) domain = parts[1];
      else if (parts.length === 1) domain = parts[0];
    }
    domain = normalizeDomain(domain);
    if (!isDomain(domain) || seen.has(domain)) continue;
    seen.add(domain); out.push(domain);
  }
  return out;
}

export function normalizeDomain(value) {
  return String(value || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
}

export function matchRules(domain, rules = []) {
  const d = normalizeDomain(domain);
  for (const raw of rules) {
    const rule = normalizeRule(raw);
    if (!rule) continue;
    if (rule.startsWith('*.')) {
      const suffix = rule.slice(2);
      if (d !== suffix && d.endsWith('.' + suffix)) return rule;
    } else if (d === rule) return rule;
  }
  return '';
}

function sanitizeConfig(raw, base) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: source.enabled == null ? base.enabled : Boolean(source.enabled),
    disabledUntil: sanitizeDisabledUntil(source.disabledUntil),
    blockMode: normalizeBlockMode(source.blockMode || base.blockMode),
    allow: uniqueRules([...(base.allow || []), ...asArray(source.allow)]).slice(0, 2000),
    deny: uniqueRules([...(base.deny || []), ...asArray(source.deny)]).slice(0, 5000),
    sources: asArray(source.sources).map(sanitizeSource).filter(Boolean).slice(0, MAX_SOURCES)
  };
}

function sanitizeDisabledUntil(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= Date.now()) return 0;
  return Math.min(n, Date.now() + MAX_PAUSE_SECONDS * 1000);
}

function sanitizeSource(source) {
  if (!source || typeof source !== 'object') return null;
  try {
    const url = validateSourceUrl(source.url);
    return {
      id: String(source.id || sourceId(url)).slice(0, 64),
      name: String(source.name || new URL(url).hostname).trim().slice(0, 80),
      url,
      enabled: source.enabled !== false
    };
  } catch { return null; }
}

function addSource(sources, name, rawUrl) {
  if (sources.length >= MAX_SOURCES) throw new Error(`A maximum of ${MAX_SOURCES} blocklist sources is supported`);
  const url = validateSourceUrl(rawUrl);
  if (sources.some(s => s.url === url)) return sources;
  return [...sources, { id: sourceId(url), name: String(name || new URL(url).hostname).trim().slice(0, 80), url, enabled: true }];
}

function validateSourceUrl(raw) {
  const u = new URL(String(raw || '').trim());
  if (u.protocol !== 'https:') throw new Error('Blocklist source must use HTTPS');
  const host = u.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) throw new Error('Blocklist source must use a public hostname');
  return u.href;
}

function sourceId(url) {
  return 'src-' + fnv1a(url).toString(16).padStart(8, '0');
}

function parseRuleList(value) {
  return uniqueRules(String(value || '').split(/[\s,]+/));
}

function uniqueRules(values) {
  return [...new Set(values.map(normalizeRule).filter(Boolean))];
}

function normalizeRule(value) {
  let v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  const wildcard = v.startsWith('*.');
  if (wildcard) v = v.slice(2);
  v = normalizeDomain(v);
  if (!isDomain(v)) return '';
  return wildcard ? '*.' + v : v;
}

function addRule(list, raw) {
  const rule = normalizeRule(raw);
  if (!rule) throw new Error('Invalid domain rule');
  return [...new Set([...list, rule])];
}

function removeRule(list, raw) {
  const rule = normalizeRule(raw);
  return list.filter(x => normalizeRule(x) !== rule);
}

function isDomain(domain) {
  if (!domain || domain.length > 253 || !domain.includes('.')) return false;
  return domain.split('.').every(label => label && label.length <= 63 && /^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$/.test(label));
}

async function gravityHasDomain(env, domain) {
  const shard = shardFor(domain);
  const set = await getShard(env, shard);
  return set.has(domain);
}

async function getShard(env, shard) {
  const cached = shardCache.get(shard);
  if (cached && Date.now() - cached.at < SHARD_CACHE_MS) return cached.set;
  let text = '';
  try { text = await env.DNSDASH_KV.get(SHARD_PREFIX + shard) || ''; } catch {}
  const set = new Set(String(text).split('\n').map(normalizeDomain).filter(Boolean));
  shardCache.set(shard, { at: Date.now(), set });
  return set;
}

function shardFor(domain) {
  return fnv1a(domain) % SHARDS;
}

function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function normalizeBlockMode(value) {
  const v = String(value || '').toLowerCase();
  return ['nxdomain', 'nodata', 'zero', 'refused'].includes(v) ? v : 'nxdomain';
}

function asArray(value) { return Array.isArray(value) ? value : []; }

function encodeName(name) {
  const domain = normalizeDomain(name);
  const bytes = [];
  for (const label of domain.split('.')) {
    const encoded = new TextEncoder().encode(label);
    if (!encoded.length || encoded.length > 63) throw new Error('Invalid DNS label');
    bytes.push(encoded.length, ...encoded);
  }
  bytes.push(0);
  return Uint8Array.from(bytes);
}
