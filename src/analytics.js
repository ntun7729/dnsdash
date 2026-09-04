const RETENTION_DAYS_DEFAULT = 7;
const MAX_RECENT = 200;
let schemaReady = false;

const runtime = {
  startedAt: Date.now(),
  total: 0,
  blocked: 0,
  allowed: 0,
  errors: 0,
  byType: new Map(),
  top: new Map(),
  blockedTop: new Map()
};

export function hasD1(env = {}) {
  return Boolean(env.DNSDASH_DB && typeof env.DNSDASH_DB.prepare === 'function');
}

export function recordRuntime(entry = {}) {
  runtime.total++;
  const action = entry.action || 'allowed';
  if (action === 'blocked') runtime.blocked++;
  else if (action === 'error') runtime.errors++;
  else runtime.allowed++;
  if (entry.qtype) bump(runtime.byType, entry.qtype);
  if (entry.domain) bump(runtime.top, entry.domain);
  if (entry.domain && action === 'blocked') bump(runtime.blockedTop, entry.domain);
}

export function runtimeStats() {
  const total = runtime.total;
  return {
    startedAt: runtime.startedAt,
    total,
    blocked: runtime.blocked,
    allowed: runtime.allowed,
    errors: runtime.errors,
    blockedPercent: total ? Math.round((runtime.blocked / total) * 1000) / 10 : 0,
    byType: topMap(runtime.byType, 8),
    topDomains: topMap(runtime.top, 8),
    topBlocked: topMap(runtime.blockedTop, 8)
  };
}

export async function logQuery(env, entry = {}) {
  recordRuntime(entry);
  if (!hasD1(env)) return;
  try {
    await ensureDatabase(env);
    const now = Date.now();
    await env.DNSDASH_DB.prepare(`
      INSERT INTO dns_queries (ts, domain, qtype, action, source, resolver, latency_ms, rcode, client_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      now,
      String(entry.domain || '').slice(0, 253),
      String(entry.qtype || '').slice(0, 24),
      String(entry.action || 'allowed').slice(0, 16),
      String(entry.source || '').slice(0, 300),
      String(entry.resolver || '').slice(0, 120),
      Number.isFinite(entry.latencyMs) ? Math.max(0, Math.round(entry.latencyMs)) : null,
      String(entry.rcode || '').slice(0, 32),
      String(entry.clientHash || '').slice(0, 64)
    ).run();
  } catch (error) {
    console.error('[dnsdash analytics]', error?.message || error);
  }
}

export async function getDashboardStats(env, { hours = 24 } = {}) {
  const memory = runtimeStats();
  if (!hasD1(env)) return { configured: false, persistent: null, runtime: memory };
  try {
    await ensureDatabase(env);
    const since = Date.now() - clamp(hours, 1, 168) * 3600000;
    const summary = await first(env, `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN action='blocked' THEN 1 ELSE 0 END) AS blocked,
        SUM(CASE WHEN action='allowed' THEN 1 ELSE 0 END) AS allowed,
        SUM(CASE WHEN action='error' THEN 1 ELSE 0 END) AS errors,
        AVG(CASE WHEN latency_ms IS NOT NULL THEN latency_ms END) AS avg_latency
      FROM dns_queries WHERE ts >= ?
    `, [since]);
    const topDomains = await rows(env, `SELECT domain, COUNT(*) AS count FROM dns_queries WHERE ts >= ? GROUP BY domain ORDER BY count DESC LIMIT 10`, [since]);
    const topBlocked = await rows(env, `SELECT domain, COUNT(*) AS count FROM dns_queries WHERE ts >= ? AND action='blocked' GROUP BY domain ORDER BY count DESC LIMIT 10`, [since]);
    const byType = await rows(env, `SELECT qtype AS name, COUNT(*) AS count FROM dns_queries WHERE ts >= ? GROUP BY qtype ORDER BY count DESC LIMIT 12`, [since]);
    const total = Number(summary?.total || 0);
    const blocked = Number(summary?.blocked || 0);
    return {
      configured: true,
      persistent: {
        hours: clamp(hours, 1, 168),
        total,
        blocked,
        allowed: Number(summary?.allowed || 0),
        errors: Number(summary?.errors || 0),
        blockedPercent: total ? Math.round((blocked / total) * 1000) / 10 : 0,
        avgLatencyMs: summary?.avg_latency == null ? null : Math.round(Number(summary.avg_latency) * 10) / 10,
        topDomains,
        topBlocked,
        byType
      },
      runtime: memory
    };
  } catch (error) {
    return { configured: true, error: error?.message || 'D1 unavailable', persistent: null, runtime: memory };
  }
}

export async function getRecentQueries(env, limit = 50) {
  if (!hasD1(env)) return { configured: false, rows: [] };
  try {
    await ensureDatabase(env);
    const data = await rows(env, `
      SELECT ts, domain, qtype, action, source, resolver, latency_ms, rcode, client_hash
      FROM dns_queries ORDER BY ts DESC LIMIT ?
    `, [clamp(limit, 1, MAX_RECENT)]);
    return { configured: true, rows: data };
  } catch (error) {
    return { configured: true, error: error?.message || 'D1 unavailable', rows: [] };
  }
}

export async function clearQueryLog(env) {
  if (!hasD1(env)) throw new Error('DNSDASH_DB binding is required');
  await ensureDatabase(env);
  await env.DNSDASH_DB.prepare('DELETE FROM dns_queries').run();
}

export async function cleanupOldQueries(env) {
  if (!hasD1(env)) return;
  await ensureDatabase(env);
  const days = clamp(Number(env.DNSDASH_RETENTION_DAYS || RETENTION_DAYS_DEFAULT), 1, 90);
  const cutoff = Date.now() - days * 86400000;
  await env.DNSDASH_DB.prepare('DELETE FROM dns_queries WHERE ts < ?').bind(cutoff).run();
}

export async function ensureDatabase(env) {
  if (!hasD1(env) || schemaReady) return;
  await env.DNSDASH_DB.prepare(`
    CREATE TABLE IF NOT EXISTS dns_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      domain TEXT NOT NULL,
      qtype TEXT NOT NULL,
      action TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      resolver TEXT NOT NULL DEFAULT '',
      latency_ms INTEGER,
      rcode TEXT NOT NULL DEFAULT '',
      client_hash TEXT NOT NULL DEFAULT ''
    )
  `).run();
  await env.DNSDASH_DB.prepare('CREATE INDEX IF NOT EXISTS idx_dns_queries_ts ON dns_queries(ts DESC)').run();
  await env.DNSDASH_DB.prepare('CREATE INDEX IF NOT EXISTS idx_dns_queries_domain ON dns_queries(domain)').run();
  await env.DNSDASH_DB.prepare('CREATE INDEX IF NOT EXISTS idx_dns_queries_action_ts ON dns_queries(action, ts DESC)').run();
  schemaReady = true;
}

export async function hashClient(request, env = {}) {
  const salt = String(env.DNSDASH_LOG_SALT || '');
  if (!salt || !request) return '';
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '';
  if (!ip) return '';
  try {
    const bytes = new TextEncoder().encode(`${salt}|${ip}`);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(digest.slice(0, 8)).map(x => x.toString(16).padStart(2, '0')).join('');
  } catch { return ''; }
}

async function first(env, sql, bindings = []) {
  const stmt = env.DNSDASH_DB.prepare(sql).bind(...bindings);
  if (typeof stmt.first === 'function') return stmt.first();
  const result = await stmt.all();
  return result?.results?.[0] || null;
}

async function rows(env, sql, bindings = []) {
  const result = await env.DNSDASH_DB.prepare(sql).bind(...bindings).all();
  return Array.isArray(result?.results) ? result.results : [];
}

function bump(map, key) { map.set(key, (map.get(key) || 0) + 1); }
function topMap(map, limit) { return [...map.entries()].sort((a,b) => b[1] - a[1]).slice(0, limit).map(([name,count]) => ({ name, count })); }
function clamp(value, min, max) { const n = Number(value); return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min)); }
