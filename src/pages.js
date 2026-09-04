const BASE_CSS = `
:root{--bg:#050912;--panel:#0c1524;--panel2:#07111d;--line:#21334d;--line2:#31516f;--text:#eff6ff;--muted:#91a6c3;--accent:#59cef7;--green:#76e0a9;--yellow:#ffd166;--red:#ff8097;--shadow:0 18px 55px rgba(0,0,0,.27)}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text)}body{background:radial-gradient(circle at 12% -8%,rgba(38,105,178,.28),transparent 31%),radial-gradient(circle at 100% 2%,rgba(81,46,146,.16),transparent 30%),linear-gradient(180deg,#08111e,#050912 62%);font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{width:min(1180px,100%);margin:auto;padding:18px 12px 50px}.top{display:flex;flex-direction:column;gap:13px;margin-bottom:15px}.brand{display:flex;gap:12px;align-items:center}.logo{width:46px;height:46px;flex:0 0 46px;border:1px solid #2d5f82;border-radius:14px;background:linear-gradient(145deg,#123653,#101d31);display:grid;place-items:center;font-size:23px}.brand h1{margin:0;font-size:28px;line-height:1.05;letter-spacing:-.035em}.brand p{margin:4px 0 0;color:var(--muted);font-size:12px}.nav{display:flex;gap:7px;flex-wrap:wrap}.nav a{color:#b9cbe0;text-decoration:none;padding:7px 10px;border:1px solid var(--line);border-radius:999px;background:#081522}.nav a.active{background:#12304b;border-color:#3b769a;color:#effaff}.grid{display:grid;grid-template-columns:1fr;gap:12px}.card{background:linear-gradient(180deg,rgba(14,24,41,.98),rgba(8,15,28,.98));border:1px solid var(--line);border-radius:17px;box-shadow:var(--shadow);overflow:hidden;min-width:0}.pad{padding:15px}.card h2,.card h3{margin:0}.sub{color:var(--muted);font-size:12px;margin-top:3px}.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.metric{background:#06101b;border:1px solid var(--line);border-radius:13px;padding:12px;min-width:0}.metric strong{display:block;font-size:22px;line-height:1.15;overflow:hidden;text-overflow:ellipsis}.metric span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-top:5px}.metric.good strong{color:var(--green)}.metric.bad strong{color:var(--red)}.metric.warn strong{color:var(--yellow)}.split{display:grid;gap:12px}.statusline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pill{display:inline-flex;align-items:center;border:1px solid #2b405b;background:#0a1928;border-radius:999px;padding:5px 8px;font-size:11px;color:#c0d1e5}.pill.good{border-color:#2b5e50;background:#0c231d;color:#9cf0cc}.pill.bad{border-color:#693344;background:#28131c;color:#ffc2ce}.pill.warn{border-color:#66572f;background:#251f0e;color:#ffe49a}.list{display:grid;gap:7px;margin-top:11px}.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;background:#06101b;border:1px solid var(--line);border-radius:11px;padding:9px 10px}.row .name{overflow-wrap:anywhere}.row small{color:var(--muted)}.bar{height:7px;background:#071827;border-radius:999px;overflow:hidden;margin-top:5px}.bar>i{display:block;height:100%;background:linear-gradient(90deg,#3fb4dc,#6fe6cb);border-radius:999px}.notice{border:1px solid #6a5830;background:#231e0d;color:#ffe59c;border-radius:11px;padding:11px 12px;margin-top:10px}.error{border-color:#713348;background:#2b131d;color:#ffc2cf}.ok{border-color:#2b604f;background:#0d241e;color:#a3f2d0}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.btn,.linkbtn,input,select{font:inherit}.btn,.linkbtn{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line2);border-radius:10px;padding:9px 11px;text-decoration:none;background:#102238;color:#eef7ff;cursor:pointer}.btn.primary{background:linear-gradient(180deg,#70d9ff,#3ab0db);border-color:#62cdf4;color:#04151f;font-weight:800}.btn.danger{background:#32151e;border-color:#74364a;color:#ffc3cf}.btn.good{background:#0f2b22;border-color:#326b59;color:#a9f2d3}.form{display:grid;gap:9px;margin-top:12px}.formrow{display:grid;grid-template-columns:1fr;gap:8px}.field{display:grid;gap:5px}.field label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}.field input,.field select{width:100%;height:43px;border:1px solid var(--line);border-radius:10px;background:#06101b;color:var(--text);padding:0 10px;min-width:0}.section{margin-top:12px}.rules{display:grid;gap:7px;margin-top:10px}.rule{display:flex;gap:8px;align-items:center;justify-content:space-between;background:#06101b;border:1px solid var(--line);border-radius:10px;padding:8px 9px}.rule code{font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.inline{display:inline}.muted{color:var(--muted)}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid rgba(33,51,77,.72);vertical-align:top}th{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);background:#071321}.tablewrap{overflow:auto}.tablewrap table{min-width:760px}.mono{font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.empty{color:var(--muted);padding:24px;text-align:center}.footer{margin-top:16px;text-align:center;color:#657d98;font-size:11px}@media(min-width:600px){.metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.formrow{grid-template-columns:1fr 1fr}.split{grid-template-columns:1fr 1fr}}@media(min-width:900px){.wrap{padding:28px 20px 58px}.top{flex-direction:row;align-items:flex-start;justify-content:space-between}.metrics{grid-template-columns:repeat(6,minmax(0,1fr))}.dashboardGrid{grid-template-columns:1.1fr .9fr}.adminGrid{grid-template-columns:1fr 1fr}.brand h1{font-size:34px}}
`;

export function dashboardHomePage(model = {}) {
  const stats = model.stats?.persistent || model.stats?.runtime || emptyStats();
  const persistent = Boolean(model.stats?.persistent);
  const fw = model.firewall || {};
  const topDomains = persistent ? (stats.topDomains || []) : (model.stats?.runtime?.topDomains || []);
  const topBlocked = persistent ? (stats.topBlocked || []) : (model.stats?.runtime?.topBlocked || []);
  const byType = persistent ? (stats.byType || []) : (model.stats?.runtime?.byType || []);
  return shell('Dashboard', `
    <div class="statusline">
      ${fw.enabled?pill('Blocking enabled','good'):pill('Blocking disabled','warn')}
      ${model.kvConfigured?pill('KV connected','good'):pill('KV not connected','warn')}
      ${model.d1Configured?pill('D1 logging connected','good'):pill('D1 not connected','warn')}
      ${persistent?pill('24h persistent stats','good'):pill('Cold-start runtime stats','warn')}
    </div>
    <div class="metrics section">
      ${metric('Queries', stats.total || 0)}
      ${metric('Blocked', stats.blocked || 0,'bad')}
      ${metric('Blocked %', `${num(stats.blockedPercent)}%`,'warn')}
      ${metric('Allowed', stats.allowed || 0,'good')}
      ${metric('Errors', stats.errors || 0)}
      ${metric('Gravity', fw.gravity?.domains || 0)}
    </div>
    ${!model.kvConfigured || !model.d1Configured ? `<div class="notice"><strong>Pi-hole storage is not fully configured.</strong><br>${!model.kvConfigured?'Bind a KV namespace as <code>DNSDASH_KV</code> for persistent rules and compiled blocklists. ':''}${!model.d1Configured?'Bind a D1 database as <code>DNSDASH_DB</code> for persistent query history and statistics.':''}</div>`:''}
    <div class="grid dashboardGrid section">
      <section class="card pad"><h2>Firewall</h2><div class="sub">Local filtering happens before upstream DoH.</div>
        <div class="list">
          ${kv('Status',fw.enabled?'Enabled':'Disabled')}${kv('Block mode',fw.blockMode||'nxdomain')}${kv('Allow rules',fw.allowCount||0)}${kv('Deny rules',fw.denyCount||0)}${kv('Enabled lists',`${fw.enabledSources||0}/${fw.sourceCount||0}`)}${kv('Compiled domains',fw.gravity?.domains||0)}
        </div>
        <div class="actions"><a class="linkbtn primary" href="/admin">Manage firewall</a><a class="linkbtn" href="/inspect">DNS inspector</a></div>
      </section>
      <section class="card pad"><h2>Query types</h2><div class="sub">${persistent?'Last 24 hours':'Since this Worker isolate started'}.</div>${barList(byType,'name')}</section>
      <section class="card pad"><h2>Top requested domains</h2><div class="sub">${model.authenticated?'Visible because you are logged in.':'Domain names are hidden until admin login.'}</div>${model.authenticated?barList(topDomains,'domain'):'<div class="empty">Login in Admin to view domain history.</div>'}</section>
      <section class="card pad"><h2>Top blocked domains</h2><div class="sub">Most frequently filtered names.</div>${model.authenticated?barList(topBlocked,'domain'):'<div class="empty">Login in Admin to view blocked-domain history.</div>'}</section>
    </div>
  `, 'dashboard');
}

export function adminPage(model = {}) {
  const fw = model.firewall || {};
  const cfg = model.config || { allow:[],deny:[],sources:[] };
  let body = '';
  if (model.message) body += `<div class="notice ok">${h(model.message)}</div>`;
  if (model.error) body += `<div class="notice error">${h(model.error)}</div>`;
  if (!model.configured) {
    body += `<div class="notice"><strong>Admin login is not configured.</strong><br>Add a secret Worker variable named <code>DNSDASH_ADMIN_TOKEN</code>. Until then DNS Dash keeps admin mutations locked.</div>`;
  } else if (!model.authenticated) {
    body += `<section class="card pad"><h2>Admin login</h2><div class="sub">The token is sent only by POST and exchanged for an HttpOnly session cookie.</div><form class="form" method="post" action="/admin/login"><div class="field"><label>Admin token</label><input name="token" type="password" autocomplete="current-password" required></div><button class="btn primary" type="submit">Login</button></form></section>`;
  } else {
    body += `<div class="actions"><form method="post" action="/admin/logout"><button class="btn" type="submit">Logout</button></form></div>`;
    if (!model.kvConfigured) body += `<div class="notice"><strong>KV required for persistent filtering controls.</strong><br>Create/bind a Workers KV namespace with binding name <code>DNSDASH_KV</code>. Environment rules still work through <code>DNSDASH_ALLOW</code> and <code>DNSDASH_DENY</code>.</div>`;
    if (!model.d1Configured) body += `<div class="notice"><strong>D1 not connected.</strong><br>Bind a D1 database as <code>DNSDASH_DB</code> to enable persistent query logs and dashboard history.</div>`;
    body += `<div class="grid adminGrid section">
      <section class="card pad"><h2>Blocking</h2><div class="sub">Firewall state and reply mode.</div>
        <div class="statusline section">${fw.enabled?pill('Enabled','good'):pill('Disabled','warn')}${pill(`${fw.gravity?.domains||0} gravity domains`)}</div>
        <form class="form" method="post" action="/admin/action"><input type="hidden" name="action" value="set-enabled"><input type="hidden" name="enabled" value="${fw.enabled?'0':'1'}"><button class="btn ${fw.enabled?'danger':'good'}" type="submit" ${model.kvConfigured?'':'disabled'}>${fw.enabled?'Disable blocking':'Enable blocking'}</button></form>
        <form class="form" method="post" action="/admin/action"><input type="hidden" name="action" value="set-mode"><div class="field"><label>Block response</label><select name="blockMode">${['nxdomain','nodata','zero','refused'].map(x=>`<option${x===fw.blockMode?' selected':''}>${x}</option>`).join('')}</select></div><button class="btn" type="submit" ${model.kvConfigured?'':'disabled'}>Save mode</button></form>
      </section>
      <section class="card pad"><h2>Blocklist subscriptions</h2><div class="sub">HTTPS hosts/adblock/plain-domain lists. Refresh compiles them into 64 KV shards.</div>
        <form class="form" method="post" action="/admin/action"><input type="hidden" name="action" value="add-source"><div class="formrow"><div class="field"><label>Name</label><input name="name" placeholder="OISD small"></div><div class="field"><label>HTTPS list URL</label><input name="url" type="url" placeholder="https://example.com/blocklist.txt" required></div></div><button class="btn" type="submit" ${model.kvConfigured?'':'disabled'}>Add source</button></form>
        <div class="rules">${cfg.sources?.length?cfg.sources.map(sourceRow).join(''):'<div class="empty">No subscription lists yet.</div>'}</div>
        <form class="form" method="post" action="/admin/action"><input type="hidden" name="action" value="refresh-sources"><button class="btn primary" type="submit" ${model.kvConfigured?'':'disabled'}>Refresh & compile lists</button></form>
        ${fw.gravity?.lastUpdated?`<div class="sub">Last compile: ${date(fw.gravity.lastUpdated)} · ${h(fw.gravity.domains||0)} domains${fw.gravity.capped?' · capped':''}</div>`:''}
      </section>
      ${rulesCard('Allowlist','allow',cfg.allow||[],model.kvConfigured)}
      ${rulesCard('Denylist','deny',cfg.deny||[],model.kvConfigured)}
      <section class="card pad"><h2>Query history</h2><div class="sub">D1 retention and maintenance.</div><div class="list">${kv('D1 binding',model.d1Configured?'Connected':'Missing')}${kv('Default retention','7 days')}</div><div class="actions"><a class="linkbtn" href="/queries">Open query log</a><form method="post" action="/admin/action"><input type="hidden" name="action" value="cleanup-log"><button class="btn" type="submit" ${model.d1Configured?'':'disabled'}>Cleanup old rows</button></form><form method="post" action="/admin/action"><input type="hidden" name="action" value="clear-log"><button class="btn danger" type="submit" ${model.d1Configured?'':'disabled'}>Clear query log</button></form></div></section>
      <section class="card pad"><h2>Bindings</h2><div class="sub">Expected Cloudflare bindings.</div><div class="list">${kv('DNSDASH_KV',model.kvConfigured?'Connected':'Not configured')}${kv('DNSDASH_DB',model.d1Configured?'Connected':'Not configured')}${kv('DNSDASH_ADMIN_TOKEN','Configured')}</div></section>
    </div>`;
  }
  return shell('Admin', body, 'admin');
}

export function queryLogPage(model = {}) {
  let body = '';
  if (!model.configured) body = `<div class="notice">Configure <code>DNSDASH_ADMIN_TOKEN</code> before exposing query history.</div>`;
  else if (!model.authenticated) body = `<div class="notice">Admin login is required to view DNS query history. <a href="/admin">Open Admin</a>.</div>`;
  else if (!model.log?.configured) body = `<div class="notice">Bind a D1 database as <code>DNSDASH_DB</code> to persist query history.</div>`;
  else if (model.log.error) body = `<div class="notice error">${h(model.log.error)}</div>`;
  else {
    const rows = model.log.rows || [];
    body = `<section class="card"><div class="pad"><h2>Recent DNS queries</h2><div class="sub">Newest 100 persistent D1 records.</div></div><div class="tablewrap"><table><thead><tr><th>Time</th><th>Domain</th><th>Type</th><th>Action</th><th>Rule / source</th><th>Resolver</th><th>Latency</th><th>Rcode</th></tr></thead><tbody>${rows.length?rows.map(queryRow).join(''):'<tr><td colspan="8" class="empty">No queries logged yet.</td></tr>'}</tbody></table></div></section>`;
  }
  return shell('Query log', body, 'queries');
}

function rulesCard(title,kind,rules,enabled){
  return `<section class="card pad"><h2>${h(title)}</h2><div class="sub">Exact domains and <code>*.example.com</code> wildcard rules.</div><form class="form" method="post" action="/admin/action"><input type="hidden" name="action" value="add-${kind}"><div class="field"><label>Domain rule</label><input name="rule" placeholder="${kind==='allow'?'example.com':'ads.example.com'}" required></div><button class="btn" type="submit" ${enabled?'':'disabled'}>Add rule</button></form><div class="rules">${rules.length?rules.map(r=>`<div class="rule"><code>${h(r)}</code><form class="inline" method="post" action="/admin/action"><input type="hidden" name="action" value="remove-${kind}"><input type="hidden" name="rule" value="${h(r)}"><button class="btn danger" type="submit">Remove</button></form></div>`).join(''):'<div class="empty">No rules.</div>'}</div></section>`;
}
function sourceRow(s){return `<div class="rule"><div><strong>${h(s.name)}</strong><br><small>${h(s.url)}</small></div><div class="actions"><form method="post" action="/admin/action"><input type="hidden" name="action" value="toggle-source"><input type="hidden" name="id" value="${h(s.id)}"><input type="hidden" name="enabled" value="${s.enabled?'0':'1'}"><button class="btn" type="submit">${s.enabled?'Disable':'Enable'}</button></form><form method="post" action="/admin/action"><input type="hidden" name="action" value="remove-source"><input type="hidden" name="id" value="${h(s.id)}"><button class="btn danger" type="submit">Remove</button></form></div></div>`}
function queryRow(r){return `<tr><td>${h(date(r.ts))}</td><td class="mono">${h(r.domain)}</td><td>${h(r.qtype)}</td><td>${r.action==='blocked'?pill('blocked','bad'):r.action==='error'?pill('error','warn'):pill('allowed','good')}</td><td class="mono">${h(r.source||'')}</td><td>${h(r.resolver||'')}</td><td>${r.latency_ms==null?'—':h(r.latency_ms+' ms')}</td><td>${h(r.rcode||'')}</td></tr>`}
function barList(rows,key){if(!rows?.length)return '<div class="empty">No data yet.</div>';const max=Math.max(...rows.map(x=>Number(x.count)||0),1);return `<div class="list">${rows.map(x=>`<div class="row"><div class="name"><span class="mono">${h(x[key]||x.name||'')}</span><div class="bar"><i style="width:${Math.max(3,Math.round((Number(x.count)||0)/max*100))}%"></i></div></div><strong>${h(x.count||0)}</strong></div>`).join('')}</div>`}
function metric(label,value,kind=''){return `<div class="metric ${kind}"><strong>${h(value)}</strong><span>${h(label)}</span></div>`}
function kv(label,value){return `<div class="row"><span>${h(label)}</span><strong>${h(value)}</strong></div>`}
function pill(text,kind=''){return `<span class="pill ${kind}">${h(text)}</span>`}
function num(v){return Number.isFinite(Number(v))?Number(v):0}
function date(ts){const d=new Date(Number(ts)||Date.now());return d.toISOString().replace('T',' ').replace(/\.\d{3}Z$/,' UTC')}
function emptyStats(){return{total:0,blocked:0,allowed:0,errors:0,blockedPercent:0,topDomains:[],topBlocked:[],byType:[]}}
function shell(title,body,active){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="dark"><title>${h(title)} · DNS Dash</title><style>${BASE_CSS}</style></head><body><div class="wrap"><header class="top"><div class="brand"><div class="logo">◉</div><div><h1>DNS Dash</h1><p>Cloudflare Worker DNS firewall, DoH resolver and ECH inspector.</p></div></div><nav class="nav"><a class="${active==='dashboard'?'active':''}" href="/">Dashboard</a><a class="${active==='inspect'?'active':''}" href="/inspect">Inspector</a><a class="${active==='queries'?'active':''}" href="/queries">Queries</a><a class="${active==='admin'?'active':''}" href="/admin">Admin</a></nav></header>${body}<div class="footer">DNS Dash 3.0 · Filtering before upstream DoH · Server-rendered controls</div></div></body></html>`}
function h(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
