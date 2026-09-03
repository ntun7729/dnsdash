export function dashboardPage(appScript = '', nonce = '') {
  const safeNonce = String(nonce || '').replace(/[^A-Za-z0-9_-]/g, '');
  const embeddedScript = String(appScript || '').replace(/<\/script/gi, '<\\/script');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>DNS Dash</title>
<style>
:root{--bg:#050912;--panel:#0b1321;--panel2:#07111d;--line:#1f3048;--line2:#2a425e;--text:#eef5ff;--muted:#91a6c2;--blue:#58c9f7;--cyan:#69ebcf;--ok:#75e0aa;--warn:#ffd166;--bad:#ff8097;--shadow:0 18px 60px rgba(0,0,0,.28)}*{box-sizing:border-box}html{background:var(--bg);overflow-x:hidden}body{margin:0;min-height:100vh;overflow-x:hidden;color:var(--text);background:radial-gradient(circle at 15% -10%,rgba(36,103,174,.28),transparent 32%),radial-gradient(circle at 100% 5%,rgba(78,47,150,.17),transparent 30%),linear-gradient(180deg,#08111d 0,#050912 64%);font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{width:min(1180px,100%);margin:auto;padding:22px 12px 46px}.top{display:flex;flex-direction:column;gap:14px;margin-bottom:16px}.brand{display:flex;gap:12px;min-width:0}.logo{flex:0 0 44px;width:44px;height:44px;border:1px solid #2d5c7e;border-radius:14px;background:linear-gradient(145deg,#11334f,#101b30);display:grid;place-items:center}.logo svg{width:26px;height:26px}.brandText{min-width:0}.brand h1{font-size:30px;line-height:1.05;letter-spacing:-.04em;margin:0 0 7px}.brand p{margin:0;color:var(--muted);font-size:13px}.health{display:inline-flex;align-items:center;align-self:flex-start;gap:8px;border:1px solid var(--line);background:#091422;padding:8px 11px;border-radius:999px;color:#bed0e6}.dot{width:8px;height:8px;border-radius:50%;background:var(--warn);box-shadow:0 0 0 4px rgba(255,209,102,.09)}.dot.ok{background:var(--ok);box-shadow:0 0 0 4px rgba(117,224,170,.09)}.grid{display:grid;grid-template-columns:1fr;gap:14px}.card{min-width:0;background:linear-gradient(180deg,rgba(14,24,41,.97),rgba(8,15,28,.97));border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);overflow:hidden}.pad{padding:16px}.section{margin-top:14px}.sectionHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.sectionHead h2,.card h2,.echHeader h2{margin:0;font-size:16px;letter-spacing:-.01em}.sub{color:var(--muted);font-size:12px;margin-top:3px}.modebar{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.mode,.btn,.input,.select,.chip,.copy{font:inherit}.mode{height:42px;border-radius:11px;border:1px solid var(--line);background:#081522;color:#a6b9d0}.mode.active{background:#10263c;border-color:#347094;color:#e6f7ff}.queryrow{display:grid;grid-template-columns:1fr;gap:9px;margin-top:12px}.input,.select,.btn{width:100%;height:46px;border-radius:12px;border:1px solid var(--line)}.input,.select{background:#06101c;color:var(--text);padding:0 12px;outline:none;min-width:0}.input:focus,.select:focus{border-color:#3d88b3;box-shadow:0 0 0 3px rgba(88,201,247,.08)}.select:disabled{opacity:.55}.btn{cursor:pointer;background:linear-gradient(180deg,#71d8ff,#3bb1dc);border-color:#60cff7;color:#04151f;font-weight:800}.btn:disabled{opacity:.58;cursor:wait}.quick{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.chip{border:1px solid var(--line);background:#091522;color:#bdcee1;border-radius:999px;padding:7px 10px;cursor:pointer}.error{margin-top:12px;padding:11px 12px;border:1px solid #723548;background:#2a131c;color:#ffc3ce;border-radius:11px}.error[hidden]{display:none}.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:14px}.stat{min-width:0;background:#06101c;border:1px solid var(--line);border-radius:12px;padding:11px}.stat strong{display:block;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.stat span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.07em;margin-top:3px}.endpointBlock+.endpointBlock{margin-top:18px;padding-top:18px;border-top:1px solid var(--line)}.endpoint,.copyRow{display:flex;flex-direction:column;gap:8px;margin-top:9px}.code{min-width:0;width:100%;background:#05101a;border:1px solid var(--line);padding:10px 11px;border-radius:10px;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#bce9ff;overflow:auto;white-space:nowrap}.copy{border:1px solid var(--line2);background:#0f2135;color:#edf6ff;border-radius:10px;padding:9px 11px;cursor:pointer}.resolverList{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.pill{display:inline-flex;align-items:center;border:1px solid #2a3d58;background:#0a1928;border-radius:999px;padding:5px 8px;font-size:11px;color:#bfd0e5;max-width:100%;overflow:hidden;text-overflow:ellipsis}.pill.good{border-color:#295d50;background:#0c231d;color:#9cf0cc}.pill.warn{border-color:#67572f;background:#241f0e;color:#ffe49a}.profileGrid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:12px}.profileBox{min-width:0;border:1px solid var(--line);background:#06101c;border-radius:12px;padding:11px}.profileBox small,.kv small{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px}.mono{font:11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.desktopTable{display:none}.answerCards{display:grid;gap:8px;padding:0 14px 14px}.answerCard{min-width:0;background:#07111e;border:1px solid var(--line);border-radius:12px;padding:11px}.answerTop{display:flex;justify-content:space-between;gap:10px;align-items:center}.answerTop strong{font-size:12px}.answerTop span{color:var(--muted);font-size:11px}.answerName{margin-top:7px;color:#b7c9df;overflow-wrap:anywhere}.answerData{margin-top:6px;font:11.5px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e7f4ff;overflow-wrap:anywhere;word-break:break-word}.emptyCard,.empty{text-align:center;color:var(--muted);padding:28px 16px}.echArea{padding:15px;border-top:1px solid var(--line)}.echHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.echHeader>div{min-width:0}.echGrid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}.kv{min-width:0;background:#06101c;border:1px solid var(--line);border-radius:11px;padding:10px;overflow-wrap:anywhere}.config{margin-top:10px;border:1px solid #33486c;background:#0a1426;border-radius:13px;padding:11px}.configTop{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.config h3{margin:0;font-size:13px}.suite{margin-top:7px;padding:8px;background:#06101c;border:1px solid var(--line);border-radius:9px;font-size:11px;color:#cbd9ea;overflow-wrap:anywhere}.raw{margin-top:10px}.raw summary{cursor:pointer;color:#afc3da}.raw pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto;background:#05101a;border:1px solid var(--line);border-radius:10px;padding:10px;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#bad1ea}.footer{margin-top:17px;text-align:center;color:#687f9b;font-size:11px;padding:0 8px}
@media(min-width:560px){.queryrow{grid-template-columns:minmax(0,1fr) 130px}.queryrow .btn{grid-column:1/-1}.stats{grid-template-columns:repeat(3,minmax(0,1fr))}.profileGrid,.echGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.endpoint,.copyRow{flex-direction:row;align-items:center}.code{flex:1}.copy{flex:0 0 auto}}
@media(min-width:760px){.wrap{padding:30px 20px 58px}.top{flex-direction:row;justify-content:space-between;align-items:flex-start}.health{align-self:auto}.brand h1{font-size:34px}.queryrow{grid-template-columns:minmax(0,1fr) 135px 112px}.queryrow .btn{grid-column:auto}.stats{grid-template-columns:repeat(5,minmax(0,1fr))}.profileGrid{grid-template-columns:repeat(3,minmax(0,1fr))}.answerCards{display:none}.desktopTable{display:block;overflow:auto;border-top:1px solid var(--line)}table{width:100%;border-collapse:collapse;min-width:700px}th,td{text-align:left;padding:10px 13px;border-bottom:1px solid rgba(31,48,72,.72);vertical-align:top}th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);background:#071321}td.data{font:11.5px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-word}}
@media(min-width:960px){.grid{grid-template-columns:minmax(0,1.2fr) minmax(330px,.8fr)}.echGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="brand">
      <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#69ebcf" stroke-width="1.5"><circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4M12 3.8c2.4 2.2 3.5 4.9 3.5 8.2S14.4 18 12 20.2C9.6 18 8.5 15.3 8.5 12S9.6 6 12 3.8Z"/></svg></div>
      <div class="brandText"><h1>DNS Dash</h1><p>Wire-format DNS over HTTPS with DNSSEC, HTTPS/SVCB and RFC 9849 ECH inspection.</p></div>
    </div>
    <div class="health"><span id="healthDot" class="dot"></span><span id="healthText">Checking resolver</span></div>
  </header>

  <div class="grid">
    <section class="card pad">
      <div class="sectionHead"><div><h2>DNS inspector</h2><div class="sub">Build a connection profile or query one DNS record.</div></div></div>
      <div class="modebar"><button id="profileMode" class="mode active" type="button">Connection profile</button><button id="recordMode" class="mode" type="button">Single record</button></div>
      <div class="queryrow">
        <input id="name" class="input" value="cloudflare-ech.com" autocomplete="off" spellcheck="false" aria-label="DNS name">
        <select id="type" class="select" aria-label="DNS type"><option>A</option><option>AAAA</option><option selected>HTTPS</option><option>SVCB</option><option>CNAME</option><option>NS</option><option>MX</option><option>TXT</option><option>SOA</option><option>PTR</option><option>SRV</option><option>CAA</option></select>
        <button id="go" class="btn" type="button">Inspect</button>
      </div>
      <div class="quick"><button class="chip" data-name="cloudflare-ech.com" type="button">Cloudflare ECH</button><button class="chip" data-name="google.com" type="button">Google</button><button class="chip" data-name="example.com" type="button">Example</button><button class="chip" data-mode="record" data-type="HTTPS" type="button">HTTPS only</button></div>
      <div id="error" class="error" hidden></div>
      <div class="stats">
        <div class="stat"><strong id="latency">—</strong><span>Latency</span></div>
        <div class="stat"><strong id="rcode">—</strong><span>Rcode</span></div>
        <div class="stat"><strong id="dnssec">—</strong><span>DNSSEC AD</span></div>
        <div class="stat"><strong id="answersCount">—</strong><span>Answers</span></div>
        <div class="stat"><strong id="bytes">—</strong><span>Wire bytes</span></div>
      </div>
    </section>

    <aside class="card pad">
      <div class="endpointBlock"><h2>DoH endpoint</h2><div class="sub">RFC 8484 GET/POST endpoint for DNS clients.</div><div class="endpoint"><div id="doh" class="code"></div><button class="copy" data-copy="doh" type="button">Copy</button></div></div>
      <div class="endpointBlock"><h2>v2rayNG / Xray ECH lookup</h2><div class="sub">Dynamic HTTPS type 65 lookup through this Worker.</div><div class="endpoint"><div id="echHelper" class="code"></div><button class="copy" data-copy="echHelper" type="button">Copy</button></div></div>
      <div class="endpointBlock"><h2>Resolver chain</h2><div id="resolverList" class="resolverList"><span class="pill">Loading…</span></div><div class="sub">Fallback resolvers are optional Worker variables.</div></div>
    </aside>
  </div>

  <section class="card section">
    <div class="pad">
      <div class="sectionHead"><div><h2 id="resultTitle">Connection profile</h2><div id="meta" class="sub">Ready.</div></div><div id="badges"></div></div>
      <div id="profile" class="profileGrid"><div class="profileBox"><small>IPv4</small><div class="mono">—</div></div><div class="profileBox"><small>IPv6</small><div class="mono">—</div></div><div class="profileBox"><small>ALPN</small><div class="mono">—</div></div></div>
    </div>

    <div id="answerCards" class="answerCards"><div class="emptyCard">Run an inspection to see DNS records.</div></div>
    <div class="desktopTable"><table><thead><tr><th>Name</th><th>Type</th><th>TTL</th><th>Decoded data</th></tr></thead><tbody id="answers"><tr><td colspan="4" class="empty">Run an inspection to see DNS records.</td></tr></tbody></table></div>

    <div id="echArea" class="echArea"><div class="echHeader"><div><h2>ECH inspector</h2><div class="sub">RFC 9849 ECHConfigList decoded from HTTPS/SVCB DNS data.</div></div><span class="pill">No data yet</span></div></div>
    <div id="rawArea" class="pad"></div>
  </section>

  <div class="footer">DNS Dash stores no application-level query history or ECH keys.</div>
</div>
<script nonce="${safeNonce}" data-cfasync="false">${embeddedScript}</script>
</body>
</html>`;
}
