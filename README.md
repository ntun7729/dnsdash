# DNS Dash

DNS Dash is a focused Cloudflare Worker DNS project. It does two things:

- serves standards-based DNS-over-HTTPS at `/dns-query`;
- serves a self-contained DNS inspection dashboard at `/`.

There are no tunnel, VLESS, proxy, subscription, VPN, or unrelated features in this repository.

## DNS Dash 2

Version 2 replaces the original dashboard's provider-specific JSON parsing with its own DNS wire codec.

DNS Dash now builds DNS packets itself, sends wire-format DoH, validates the returned transaction and question, follows DNS compression pointers safely, decodes resource records, parses HTTPS/SVCB SvcParams from binary RDATA, and decodes RFC 9849 ECHConfigList structures.

The dashboard and the public DoH endpoint therefore use the same DNS protocol core.

## Routes

| Route | Purpose |
|---|---|
| `/` | DNS Dash web interface |
| `/dns-query` | RFC 8484 DNS-over-HTTPS endpoint |
| `/api/resolve?name=example.com&type=HTTPS` | One wire-format DNS lookup, normalized to JSON for the UI |
| `/api/profile?name=example.com` | Parallel A + AAAA + HTTPS connection profile |
| `/health` | Resolver-chain and capability status |

Unknown routes return `404`.

## DNS-over-HTTPS

### GET from clients

```text
GET /dns-query?dns=<base64url-dns-message>
Accept: application/dns-message
```

### POST from clients

```text
POST /dns-query
Content-Type: application/dns-message
Accept: application/dns-message

<raw DNS wire message>
```

DNS Dash accepts both RFC 8484 forms. Internally it relays valid client requests upstream as POST `application/dns-message`, including when the client used GET. This keeps the DNS wire message out of the upstream URL.

Before accepting an upstream answer DNS Dash verifies that it is a DNS response and that its transaction ID and first question match the original request. A bad upstream response is not returned to the client.

The default resolver is:

```text
https://cloudflare-dns.com/dns-query
```

## Resolver fallback chain

The Worker can use up to four HTTPS DoH upstreams in order.

```toml
[vars]
UPSTREAM_DOH = "https://cloudflare-dns.com/dns-query"
UPSTREAM_DOH_FALLBACKS = ""
DNS_TIMEOUT_MS = "6000"
```

`UPSTREAM_DOH_FALLBACKS` is optional. It accepts comma- or newline-separated DoH URLs.

Example:

```text
https://dns.google/dns-query,https://dns.quad9.net/dns-query
```

Fallback is triggered by transport failure, timeout, non-success HTTP status, an unexpected media type, a malformed DNS reply, a transaction-ID mismatch, or a question mismatch.

Only HTTPS resolver URLs are accepted. Duplicate upstreams are removed and the list is bounded to four entries.

## DNSSEC

Dashboard queries request DNSSEC data by default with an EDNS OPT record and the DO bit set.

The dashboard shows the returned AD flag so you can see whether the recursive resolver authenticated the answer. It also exposes the DNS header flags and normalized response in the raw details panel.

The public `/dns-query` endpoint does not rewrite a client's DNS flags or EDNS options; it forwards the validated DNS packet as supplied.

## Wire decoder

DNS Dash understands these records natively:

- A
- AAAA
- NS
- CNAME
- SOA
- PTR
- MX
- TXT
- SRV
- CAA
- SVCB
- HTTPS
- OPT

Unknown RDATA is retained as Base64/hex instead of being silently discarded.

The parser supports compressed DNS owner names and rejects invalid compression loops and truncated packets.

## HTTPS / SVCB inspection

DNS Dash implements the RFC 9460 SVCB/HTTPS wire layout. It decodes:

- `mandatory`
- `alpn`
- `no-default-alpn`
- `port`
- `ipv4hint`
- `ech`
- `ipv6hint`
- unknown SvcParam keys as raw Base64/hex

SvcParam keys are checked for strict numeric ordering as required by the wire format.

The dashboard's connection-profile mode resolves A, AAAA and HTTPS in parallel, then summarizes IP addresses, ALPN values and ECH availability.

## ECH inspector

When an HTTPS/SVCB record contains SvcParamKey 5 (`ech`), DNS Dash decodes the binary ECHConfigList according to RFC 9849.

For ECH version `0xfe0d` it displays:

- ECH version
- configuration ID
- HPKE KEM ID/name
- public-key size
- HPKE KDF + AEAD suites
- maximum name length
- ECH public name
- ECH extensions
- exact Base64 ECHConfigList

The Worker never generates or stores an ECH private key. It only displays public ECH configuration obtained from DNS.

The default dashboard target is:

```text
cloudflare-ech.com
```

## v2rayNG / Xray

After deployment your DoH endpoint is:

```text
https://YOUR-WORKER/dns-query
```

The dashboard also shows the ECH lookup helper form:

```text
cloudflare-ech.com+https://YOUR-WORKER/dns-query
```

The important service for clients is `/dns-query`; DNS Dash does not need a separate `/ech` endpoint because a compatible client can request HTTPS type 65 through DoH and obtain the current ECHConfigList from DNS.

## Privacy and security choices

- no application-level DNS query logging or analytics;
- no third-party JavaScript, fonts, or assets in the dashboard;
- no arbitrary HTTP proxy behavior;
- no ECH private-key storage;
- strict packet-size bounds;
- query/response DNS transaction validation;
- HTTPS-only configurable upstreams;
- bounded resolver fallback list;
- security headers and restrictive Content Security Policy on the dashboard;
- CORS on the DoH/API surfaces for clients and browser tools.

DNS Dash does not claim to hide queries from the configured upstream recursive resolver. The Worker is a DoH relay and inspector, not an oblivious-DoH implementation.

## Deploy

```bash
npm install
npx wrangler deploy
```

Or connect the repository to Cloudflare Workers Builds and use `wrangler.toml`.

## Verify

```bash
npm install
npm run check
```

The CI pipeline performs:

1. JavaScript syntax checks;
2. packet-level unit tests;
3. standalone Worker bundling;
4. Wrangler deployment dry-run;
5. local `workerd` smoke testing;
6. artifact upload.

The generated standalone Worker is:

```text
dist/_worker.js
```

## Protocol references

- RFC 8484 — DNS Queries over HTTPS
- RFC 9460 — SVCB and HTTPS DNS resource records
- RFC 9849 — TLS Encrypted Client Hello
