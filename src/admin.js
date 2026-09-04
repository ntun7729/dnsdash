import { clearQueryLog, cleanupOldQueries, getDashboardStats, getRecentQueries, hasD1 } from './analytics.js';
import { getFirewallConfig, getFirewallStatus, hasKv, mutateFirewall, refreshBlocklists } from './firewall.js';

const COOKIE = 'dnsdash_admin';

export function adminConfigured(env = {}) {
  return Boolean(String(env.DNSDASH_ADMIN_TOKEN || '').trim());
}

export async function isAdmin(request, env = {}) {
  const token = String(env.DNSDASH_ADMIN_TOKEN || '').trim();
  if (!token) return false;
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ') && await secureEqual(auth.slice(7), token)) return true;
  const cookie = parseCookies(request.headers.get('Cookie') || '')[COOKIE] || '';
  if (!cookie) return false;
  return secureEqual(cookie, await tokenDigest(token));
}

export async function handleAdminLogin(request, env = {}) {
  if (request.method !== 'POST') return text('Method Not Allowed', 405);
  if (!adminConfigured(env)) return text('Set DNSDASH_ADMIN_TOKEN first', 503);
  const form = await request.formData();
  const token = String(form.get('token') || '');
  if (!await secureEqual(token, String(env.DNSDASH_ADMIN_TOKEN))) return text('Invalid admin token', 401);
  const digest = await tokenDigest(String(env.DNSDASH_ADMIN_TOKEN));
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin',
      'Set-Cookie': `${COOKIE}=${digest}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict`,
      'Cache-Control': 'no-store'
    }
  });
}

export function handleAdminLogout() {
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin',
      'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
      'Cache-Control': 'no-store'
    }
  });
}

export async function handleAdminAction(request, env = {}, ctx = null) {
  if (request.method !== 'POST') return text('Method Not Allowed', 405);
  if (!await isAdmin(request, env)) return text('Admin authentication required', 401);
  const form = await request.formData();
  const action = String(form.get('action') || '');
  let message = 'Saved';
  try {
    if (['set-enabled','set-mode','pause','resume','add-allow','remove-allow','add-deny','remove-deny','add-source','toggle-source','remove-source'].includes(action)) {
      const payload = Object.fromEntries(form.entries());
      await mutateFirewall(env, action, payload);
      if (action === 'pause') message = `Blocking paused for ${Math.max(1, Math.trunc(Number(payload.seconds) || 0))} seconds`;
      else if (action === 'resume') message = 'Blocking resumed';
      else message = action.replace(/-/g, ' ');
    } else if (action === 'refresh-sources') {
      const meta = await refreshBlocklists(env);
      message = `Blocklists refreshed: ${meta.domains} domains`;
    } else if (action === 'clear-log') {
      await clearQueryLog(env);
      message = 'Query log cleared';
    } else if (action === 'cleanup-log') {
      await cleanupOldQueries(env);
      message = 'Old query rows removed';
    } else {
      throw new Error('Unsupported admin action');
    }
    return redirectAdmin(message);
  } catch (error) {
    return redirectAdmin('', error?.message || 'Action failed');
  }
}

export async function adminModel(request, env = {}) {
  const authenticated = await isAdmin(request, env);
  const configured = adminConfigured(env);
  const firewall = await getFirewallStatus(env);
  const config = await getFirewallConfig(env, { fresh: true });
  const url = new URL(request.url);
  return {
    configured,
    authenticated,
    kvConfigured: hasKv(env),
    d1Configured: hasD1(env),
    firewall,
    config,
    message: url.searchParams.get('ok') || '',
    error: url.searchParams.get('error') || ''
  };
}

export async function dashboardModel(request, env = {}) {
  const authenticated = await isAdmin(request, env);
  const [firewall, stats] = await Promise.all([
    getFirewallStatus(env),
    getDashboardStats(env, { hours: 24 })
  ]);
  return {
    authenticated,
    adminConfigured: adminConfigured(env),
    kvConfigured: hasKv(env),
    d1Configured: hasD1(env),
    firewall,
    stats
  };
}

export async function queryLogModel(request, env = {}) {
  const configured = adminConfigured(env);
  const authenticated = await isAdmin(request, env);
  if (!configured || !authenticated) return { configured, authenticated, log: { configured: hasD1(env), rows: [] } };
  return { configured, authenticated, log: await getRecentQueries(env, 100) };
}

function redirectAdmin(ok = '', error = '') {
  const qs = new URLSearchParams();
  if (ok) qs.set('ok', ok);
  if (error) qs.set('error', error);
  const suffix = qs.toString() ? '?' + qs.toString() : '';
  return new Response(null, { status: 303, headers: { Location: '/admin' + suffix, 'Cache-Control': 'no-store' } });
}

function parseCookies(value) {
  const out = {};
  for (const part of String(value || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

async function tokenDigest(token) {
  const data = new TextEncoder().encode('dnsdash-admin-v1|' + token);
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(bytes).map(x => x.toString(16).padStart(2, '0')).join('');
}

async function secureEqual(a, b) {
  const aa = new TextEncoder().encode(String(a || ''));
  const bb = new TextEncoder().encode(String(b || ''));
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

function text(message, status) {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
