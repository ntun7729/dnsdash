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
        return new Response(dashboardPage(), {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
            'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
            ...SECURITY_HEADERS
          }
        });
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
