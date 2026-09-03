import { handleDoh, handleProfileApi, handleResolveApi, healthPayload } from './dns.js';
import { dashboardPage } from './ui.js';

const SECURITY_HEADERS = {
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
};

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/') {
        if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET' } });
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
          const apiRequest = new Request(new URL(apiPath, url.origin), {
            method: 'GET',
            headers: { Accept: 'application/json' }
          });
          const apiResponse = mode === 'record'
            ? await handleResolveApi(apiRequest, env)
            : await handleProfileApi(apiRequest, env);
          let payload = null;
          try { payload = await apiResponse.json(); } catch {}
          if (apiResponse.ok) result = payload;
          else error = payload?.detail || payload?.error || `DNS query failed with HTTP ${apiResponse.status}`;
        }

        return new Response(dashboardPage({
          origin: url.origin,
          mode,
          name,
          type,
          health: healthPayload(env),
          result,
          error
        }), {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            ...SECURITY_HEADERS
          }
        });
      }

      if (url.pathname === '/doh.txt' && request.method === 'GET') {
        return new Response(`${url.origin}/dns-query\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS } });
      }
      if (url.pathname === '/ech-helper.txt' && request.method === 'GET') {
        return new Response(`cloudflare-ech.com+${url.origin}/dns-query\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS } });
      }

      if (url.pathname === '/dns-query') return handleDoh(request, env);
      if (url.pathname === '/api/resolve') return handleResolveApi(request, env);
      if (url.pathname === '/api/profile') return handleProfileApi(request, env);
      if (url.pathname === '/health' && request.method === 'GET') {
        return Response.json(healthPayload(env), { headers: { 'Cache-Control': 'no-store', ...SECURITY_HEADERS } });
      }

      return new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS }
      });
    } catch (error) {
      console.error('[dnsdash]', error?.stack || error);
      return new Response('Internal Server Error', { status: 500, headers: { 'Cache-Control': 'no-store', ...SECURITY_HEADERS } });
    }
  }
};
