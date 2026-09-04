# DNS Dash

DNS Dash 3 is a Cloudflare Worker DNS firewall and DNS-over-HTTPS resolver with a Pi-hole-style dashboard.

It keeps the wire-format DNS, DNSSEC, HTTPS/SVCB and ECH inspection from DNS Dash 2, then adds filtering, blocklists, allow/deny rules, statistics, query history and an admin panel.

There are no tunnel, VPN, VLESS or unrelated proxy features in this repository.

## What DNS Dash 3 does

DNS requests flow through:

```text
DNS client
   |
   v
/dns-query
   |
   +--> allowlist
   |
   +--> blocking enabled?
   |
   +--> manual denylist
   |
   +--> compiled blocklist / gravity
   |        |
   |        +--> blocked locally (no upstream request)
   |
   v
Cloudflare DoH -> Google DoH -> Quad9 DoH
```

The allowlist has the highest filtering priority. A blocked request is answered directly by the Worker and never sent to the configured recursive resolver.

## Web routes

| Route | Purpose |
|---|---|
| `/` | Pi-hole-style firewall dashboard |
| `/inspect` | DNS / DNSSEC / HTTPS / SVCB / ECH inspector |
| `/admin` | Protected firewall and blocklist controls |
| `/queries` | Protected recent query log |
| `/dns-query` | RFC 8484 DNS-over-HTTPS endpoint |
| `/api/resolve?name=example.com&type=HTTPS` | One normalized DNS lookup |
| `/api/profile?name=example.com` | Parallel A + AAAA + HTTPS profile |
| `/api/stats` | Runtime/persistent aggregate statistics |
| `/health` | Resolver, firewall and capability status |
| `/doh.txt` | Plain-text deployed DoH URL |
| `/ech-helper.txt` | Plain-text Xray/v2rayNG ECH helper |

The dashboard and admin controls are server rendered. DNS filtering does not depend on browser JavaScript.

## Pi-hole-style features

### Blocking controls

- global blocking enable/disable;
- local block reply modes: `NXDOMAIN`, `NODATA`, `0.0.0.0`/`::`, or `REFUSED`;
- exact allow rules;
- exact deny rules;
- wildcard rules using `*.example.com`;
- allowlist precedence over denylist and subscription lists.

### Blocklist subscriptions

The Admin page accepts HTTPS blocklist URLs and compiles enabled sources into Workers KV.

Supported input styles include:

```text
ads.example.com
0.0.0.0 ads.example.com
127.0.0.1 ads.example.com
||ads.example.com^
```

Comment lines and Adblock allow rules (`@@`) are ignored by the blocklist compiler.

The compiler currently supports up to 8 configured sources, limits an individual source to 8 MiB, caps a compiled gravity set at 300,000 unique domains, and stores the result across 64 KV shards. A normal DNS lookup therefore reads only the shard needed for the queried domain rather than retrieving the entire gravity database.

Blocklists can be refreshed from Admin. The Worker also exposes a scheduled handler and `wrangler.toml` configures daily maintenance at `03:17 UTC`.

### Query statistics

Without D1, DNS Dash still keeps per-isolate runtime counters for:

- total queries;
- blocked/allowed/error counts;
- blocked percentage;
- query-type distribution;
- top requested domains;
- top blocked domains.

Runtime counters reset when the Worker isolate is recycled.

With a D1 binding, DNS Dash adds persistent history and 24-hour statistics.

### Query log privacy

Persistent D1 rows contain:

- timestamp;
- domain;
- DNS type;
- allowed / blocked / error action;
- matching rule/source;
- upstream resolver;
- latency;
- DNS response code.

Client IP addresses are not stored directly. If you configure `DNSDASH_LOG_SALT`, DNS Dash stores only a short SHA-256-derived client label. Without that secret, the client field stays empty.

The default D1 retention setting is 7 days and is configurable with `DNSDASH_RETENTION_DAYS`.

## Persistent storage setup

DNS Dash deliberately deploys without hard-coded account-specific KV/D1 IDs. The resolver continues to work before storage is connected.

For the Pi-hole features, add these Cloudflare Worker bindings:

### 1. Workers KV

Create a KV namespace and bind it as:

```text
DNSDASH_KV
```

KV stores:

- firewall settings;
- allowlist;
- denylist;
- blocklist subscription definitions;
- compiled gravity shards and metadata.

Without this binding, static environment rules still work, but Admin changes and subscription lists cannot persist.

### 2. D1 database

Create a D1 database and bind it as:

```text
DNSDASH_DB
```

DNS Dash automatically creates its query-log table and indexes when D1 is first used. The same schema is also included at:

```text
migrations/0001_dns_queries.sql
```

### 3. Admin token

Create an encrypted Worker secret named:

```text
DNSDASH_ADMIN_TOKEN
```

Do not place the token directly in `wrangler.toml`.

The Admin login exchanges the token for a `Secure`, `HttpOnly`, `SameSite=Strict` session cookie. Query-history pages are also protected by this login.

Optional client anonymization secret:

```text
DNSDASH_LOG_SALT
```

## Static filtering through environment variables

These work even without KV:

```toml
[vars]
DNSDASH_BLOCKING = "1"
DNSDASH_BLOCK_MODE = "nxdomain"
DNSDASH_ALLOW = "good.example,*.trusted.example"
DNSDASH_DENY = "ads.example,*.tracker.example"
```

`DNSDASH_ALLOW` and `DNSDASH_DENY` accept comma-, whitespace-, or newline-separated rules.

## DNS-over-HTTPS

Client GET form:

```text
GET /dns-query?dns=<base64url-dns-message>
Accept: application/dns-message
```

Client POST form:

```text
POST /dns-query
Content-Type: application/dns-message
Accept: application/dns-message

<raw DNS wire message>
```

DNS Dash validates DNS packet structure before filtering. Allowed queries are relayed upstream as POST `application/dns-message`.

Before accepting an upstream response it verifies:

- DNS response bit;
- transaction ID;
- first question name/type/class;
- packet integrity.

The response headers expose filtering state:

```text
X-DNS-Blocked: 0 | 1
X-DNS-Upstream: resolver-hostname | local-firewall
X-DNS-Rule: matching-rule       # only for blocked requests
```

## Resolver chain

Defaults:

```toml
UPSTREAM_DOH = "https://cloudflare-dns.com/dns-query"
UPSTREAM_DOH_FALLBACKS = "https://dns.google/dns-query,https://dns.quad9.net/dns-query"
DNS_TIMEOUT_MS = "6000"
```

The Worker uses up to four HTTPS DoH upstreams. It falls through on transport failure, timeout, HTTP failure, bad media type, malformed DNS, transaction-ID mismatch, or question mismatch.

## DNSSEC, HTTPS/SVCB and ECH

The inspector still provides DNS Dash 2's protocol-aware features:

- DNSSEC DO-bit queries and AD inspection;
- native A, AAAA, NS, CNAME, SOA, PTR, MX, TXT, SRV, CAA, SVCB, HTTPS and OPT parsing;
- compressed DNS name parsing;
- RFC 9460 HTTPS/SVCB decoding;
- `alpn`, `port`, `ipv4hint`, `ipv6hint`, `ech` and mandatory SvcParam handling;
- RFC 9849 ECHConfigList parsing;
- ECH version/config ID/KEM/public name/cipher-suite inspection.

For v2rayNG/Xray the deployed resolver is:

```text
https://YOUR-WORKER/dns-query
```

and the helper shown by DNS Dash is:

```text
cloudflare-ech.com+https://YOUR-WORKER/dns-query
```

## Deploy

```bash
npm install
npx wrangler deploy
```

Or connect this repository to Cloudflare Workers Builds.

After deployment, verify:

```text
https://YOUR-DOMAIN/health
https://YOUR-DOMAIN/doh.txt
https://YOUR-DOMAIN/admin
```

If you bind KV/D1 through the Cloudflare dashboard, keep the binding names exactly `DNSDASH_KV` and `DNSDASH_DB`.

## Verify locally / CI

```bash
npm install
npm run check
```

CI verifies:

1. JavaScript syntax;
2. DNS wire codec tests;
3. firewall precedence and local blocking;
4. wildcard rules;
5. blocklist parsing and KV gravity compilation;
6. server-rendered dashboard/admin pages;
7. Worker bundling;
8. Wrangler dry run;
9. local `workerd` route smoke tests;
10. live upstream binary DoH and inspector queries;
11. production custom-domain probes after pushes to `main`.

The generated standalone Worker is:

```text
dist/_worker.js
```

## Limits and tradeoffs

DNS Dash is not a full Linux Pi-hole clone. Cloudflare Workers do not provide local UDP port 53, dnsmasq/FTL, DHCP, or a persistent local filesystem. DNS Dash provides equivalent filtering semantics over DoH using Worker-native storage.

Large blocklists are intentionally bounded to protect Worker memory, CPU and KV-write usage. For very large multi-million-domain deployments, a dedicated resolver or a different persistent indexing architecture is more appropriate.

## Protocol references

- RFC 8484 — DNS Queries over HTTPS
- RFC 9460 — SVCB and HTTPS DNS resource records
- RFC 9849 — TLS Encrypted Client Hello
