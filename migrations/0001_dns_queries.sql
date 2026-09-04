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
);

CREATE INDEX IF NOT EXISTS idx_dns_queries_ts ON dns_queries(ts DESC);
CREATE INDEX IF NOT EXISTS idx_dns_queries_domain ON dns_queries(domain);
CREATE INDEX IF NOT EXISTS idx_dns_queries_action_ts ON dns_queries(action, ts DESC);
