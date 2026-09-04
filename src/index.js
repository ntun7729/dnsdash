import { handleDoh, handleProfileApi, handleResolveApi, healthPayload } from './dns.js';
import { dashboardPage as inspectorPage } from './ui.js';
import { adminPage, dashboardHomePage, queryLogPage } from './pages.js';
import {
  adminModel,
  dashboardModel,
  handleAdminAction,
  handleAdminLogin,
  handleAdminLogout,
  queryLogModel
} from './admin.js';
import { cleanupOldQueries, getDashboardStats } from './analytics.js';
import { refreshBlocklists } from './firewall.js';

const SECURITY_HEADERS = {
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
};

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/') {
        if (request.method !== 'GET') return methodNotAllowed('GET');
        if (url.searchParams.has('run') || url.searchParams.has('mode') || url.searchParams.has('name')) {
          return new Response(null, { status: 302, headers: { Location: `/inspect${url.search}`, 'Cache-Control': 'no-store' } });
        }
        const model = await dashboardModel(request, env);
        return html(dashboardHomePage(model));
      }

      if (url.pathname === '/inspect') {
        if (request.method !== 'GET') return methodNotAllowed('GET');
        return renderInspector(url, env);
      }

      if (url.pathname === '/admin') {
        if (request.method !== 'GET') return methodNotAllowed('GET');
        return html(adminPage(await adminModel(request, env)));
      }
      if (url.pathname === '/admin/login') return handleAdminLogin(request, env);
      if (url.pathname === '/admin/logout') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        return handleAdminLogout();
      }
      if (url.pathname === '/admin/action') return handleAdminAction(request, env, ctx);

      if (url.pathname === '/queries') {
        if (request.method !== 'GET') return methodNotAllowed('GET');
        return html(queryLogPage(await queryLogModel(request, env)));
      }

      if (url.pathname === '/doh.txt' && request.method === 'GET') {
        return plain(`${url.origin}/dns-query\n`);
      }
      if (url.pathname === '/ech-helper.txt' && request.method === 'GET') {
        return plain(`cloudflare-ech.com+${url.origin}/dns-query\n`);
      }

      if (url.pathname === '/dns-query') return handleDoh(request, env, fetch, ctx);
      if (url.pathname === '/api/resolve') return handleResolveApi(request, env);
      if (url.pathname === '/api/profile') return handleProfileApi(request, env);
      if (url.pathname === '/api/stats' && request.method === 'GET') {
        return Response.json(await getDashboardStats(env, { hours: Number(url.searchParams.get('hours') || 24) }), { headers: { 'Cache-Control': 'no-store', ...SECURITY_HEADERS } });
      }
      if (url.pathname === '/health' && request.method === 'GET') {
        return Response.json(await healthPayload(env), { headers: { 'Cache-Control': 'no-store', ...SECURITY_HEADERS } });
      }

      return new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS }
      });
    } catch (error) {
      console.error('[dnsdash]', error?.stack || error);
      return new Response('Internal Server Error', { status: 500, headers: { 'Cache-Control': 'no-store', ...SECURITY_HEADERS } });
    }
  },

  async scheduled(_event, env, ctx) {
    if (env.DNSDASH_KV) ctx.waitUntil(refreshBlocklists(env).catch(error => console.error('[dnsdash scheduled blocklist]', error?.message || error)));
    if (env.DNSDASH_DB) ctx.waitUntil(cleanupOldQueries(env).catch(error => console.error('[dnsdash scheduled cleanup]', error?.message || error)));
  }
};

async function renderInspector(url, env) {
  const mode = url.searchParams.get('mode') === 'record' ? 'record' : 'profile';
  const name = url.searchParams.get('name') || 'cloudflare-ech.com';
  const type = (url.searchParams.get('type') || 'HTTPS').toUpperCase();
  const shouldRun = url.searchParams.get('run') === '1';
  let result = null;
  let error = '';

  if (shouldRun) {
    const apiPath = mode === 'record'
      ? `/api/resolve?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}&dnssec=1`
      : `/api/profile?name=${encodeURIComponent(name)}&dnssec=1`;
    const apiRequest = new Request(new URL(apiPath, url.origin), { method: 'GET', headers: { Accept: 'application/json' } });
    const apiResponse = mode === 'record' ? await handleResolveApi(apiRequest, env) : await handleProfileApi(apiRequest, env);
    let payload = null;
    try { payload = await apiResponse.json(); } catch {}
    if (apiResponse.ok) result = payload;
    else error = payload?.detail || payload?.error || `DNS query failed with HTTP ${apiResponse.status}`;
  }

  return html(inspectorPage({
    origin: url.origin,
    mode,
    name,
    type,
    health: await healthPayload(env),
    result,
    error
  }));
}

function html(body) {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS } });
}
function plain(body) {
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS } });
}
function methodNotAllowed(allow) {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: allow, 'Cache-Control': 'no-store', ...SECURITY_HEADERS } });
}
