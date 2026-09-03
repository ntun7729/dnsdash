# DNS Dash

DNS Dash is a focused Cloudflare Worker project with two jobs only:

- provide a standards-based DNS-over-HTTPS endpoint at `/dns-query`;
- provide a small DNS inspection dashboard at `/`.

There are no tunnel, proxy, subscription, or unrelated features in this repository.

## Routes

| Route | Purpose |
|---|---|
| `/` | DNS Dash web interface |
| `/dns-query` | RFC 8484 DNS-over-HTTPS wire-format endpoint |
| `/api/resolve?name=example.com&type=A` | JSON API used by the dashboard |

Unknown routes return `404`.

## DNS-over-HTTPS

The Worker supports the two RFC 8484 wire-format styles commonly used by DoH clients.

### GET

```text
GET /dns-query?dns=<base64url-dns-message>
Accept: application/dns-message
```

### POST

```text
POST /dns-query
Content-Type: application/dns-message
Accept: application/dns-message

<raw DNS wire message>
```

The Worker forwards the request to the configured upstream resolver and returns `application/dns-message` to the client.

The default upstream is Cloudflare:

```text
https://cloudflare-dns.com/dns-query
```

Cloudflare documents both GET and POST DNS wire format at this endpoint. The dashboard separately uses the provider's JSON representation for human-readable inspection, while the actual `/dns-query` endpoint remains wire-format DNS.

## Dashboard

The root page lets you query:

- A
- AAAA
- HTTPS
- SVCB
- CNAME
- MX
- TXT
- NS
- SOA
- CAA

For HTTPS/SVCB records it extracts useful service-binding parameters, including:

- ALPN
- IPv4 hints
- IPv6 hints
- port
- ECHConfig
- approximate ECHConfig byte size

The default dashboard query is:

```text
cloudflare-ech.com / HTTPS
```

This makes it easy to see whether the resolver currently returns an `ech=` HTTPS-record parameter.

## v2rayNG / Xray ECH use

After deployment, your Worker DoH URL is:

```text
https://YOUR-WORKER/dns-query
```

For Xray configurations that accept a DoH URL in ECH configuration lookup, the useful form is:

```text
cloudflare-ech.com+https://YOUR-WORKER/dns-query
```

The dashboard shows both values and provides copy buttons.

The `/dns-query` endpoint is the part intended for clients. The dashboard does not invent or hardcode an ECH key; it lets DNS HTTPS type 65 carry the current ECHConfig normally.

## Configuration

`wrangler.toml` includes:

```toml
[vars]
UPSTREAM_DOH = "https://cloudflare-dns.com/dns-query"
DNS_TIMEOUT_MS = "6000"
```

### `UPSTREAM_DOH`

Must be an HTTPS DoH endpoint. DNS Dash sends standard wire-format DoH to it. The dashboard JSON API expects a Cloudflare/Google-style `application/dns-json` response from the same endpoint.

For the most predictable dashboard behavior, leave the default Cloudflare resolver unless the alternate resolver explicitly supports that JSON schema.

### `DNS_TIMEOUT_MS`

Resolver request timeout. Values are clamped between 1000 and 15000 ms.

## Deploy

```bash
npm install
npx wrangler deploy
```

Or connect the repository to Cloudflare Workers Builds and use the repository's `wrangler.toml`.

## Verify locally

```bash
npm install
npm run check
```

`npm run check` performs:

1. unit tests;
2. standalone Worker bundling;
3. Wrangler deployment dry-run.

The generated standalone Worker is:

```text
dist/_worker.js
```

## Design choices

- Module Worker syntax only.
- No third-party runtime packages.
- No DNS query logging or analytics in application code.
- No custom ECH key storage.
- No arbitrary HTTP proxy behavior.
- Wire-format DoH is kept separate from the dashboard's JSON inspection API.
- DNS queries are bounded to the DNS protocol maximum size and malformed requests are rejected before an upstream fetch.
- CORS is enabled for the DoH/API surfaces so browser and cross-origin DNS tools can use them.
- The dashboard ships as self-contained HTML/CSS/JavaScript with no external assets.
