export function dashboardPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DNS Dash</title>
<meta name="color-scheme" content="dark">
<style>
:root{--bg:#07111f;--panel:#0d1a2b;--panel2:#101f33;--line:#213653;--text:#e9f2ff;--muted:#8da6c6;--accent:#65d4ff;--ok:#6ee7b7;--warn:#fcd34d;--bad:#fb7185;--shadow:0 24px 80px rgba(0,0,0,.34)}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0%,#12365b 0,transparent 34%),radial-gradient(circle at 100% 20%,#142f47 0,transparent 28%),var(--bg);color:var(--text);font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh}.wrap{max-width:1180px;margin:auto;padding:34px 20px 56px}.top{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:24px}.brand h1{font-size:34px;line-height:1;margin:0 0 10px;letter-spacing:-.04em}.brand p{margin:0;color:var(--muted);max-width:680px}.badge{border:1px solid #285276;background:#0c2238;color:#a5e9ff;padding:7px 10px;border-radius:999px;white-space:nowrap}.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:18px}.card{background:linear-gradient(180deg,rgba(16,31,51,.96),rgba(10,23,39,.96));border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);overflow:hidden}.pad{padding:20px}.card h2{font-size:15px;margin:0 0 14px}.sub{color:var(--muted);font-size:12px}.query{display:grid;grid-template-columns:minmax(0,1fr) 150px 120px;gap:10px}.input,.select,.button{height:44px;border-radius:11px;border:1px solid var(--line);font:inherit}.input,.select{background:#081522;color:var(--text);padding:0 12px;outline:none}.input:focus,.select:focus{border-color:#3caed8;box-shadow:0 0 0 3px rgba(101,212,255,.1)}.button{cursor:pointer;background:linear-gradient(180deg,#70dbff,#36acd6);border-color:#67d7ff;color:#062032;font-weight:750}.button:disabled{opacity:.55;cursor:wait}.quick{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.chip{border:1px solid var(--line);background:#0b1928;color:#b9cde7;padding:6px 9px;border-radius:999px;cursor:pointer}.endpoint{display:flex;gap:10px;align-items:center;margin-top:12px}.code{min-width:0;flex:1;background:#07121f;border:1px solid var(--line);padding:10px 12px;border-radius:10px;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:#b8eaff;overflow:auto;white-space:nowrap}.copy{border:1px solid var(--line);background:#0d2034;color:var(--text);padding:9px 11px;border-radius:9px;cursor:pointer}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px}.stat{background:#081522;border:1px solid var(--line);border-radius:12px;padding:12px}.stat b{font-size:18px;display:block}.stat span{font-size:11px;color:var(--muted)}.resultCard{margin-top:18px}.tableWrap{overflow:auto;border-top:1px solid var(--line)}table{width:100%;border-collapse:collapse;min-width:680px}th,td{text-align:left;padding:11px 14px;border-bottom:1px solid rgba(33,54,83,.72);vertical-align:top}th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);background:#0a1726}td.data{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-word}.empty{padding:36px;text-align:center;color:var(--muted)}.status{display:inline-flex;align-items:center;gap:6px}.dot{width:8px;height:8px;border-radius:50%;background:var(--ok)}.detail{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.kv{background:#081522;border:1px solid var(--line);border-radius:11px;padding:11px;min-width:0}.kv small{display:block;color:var(--muted);margin-bottom:5px}.kv div{word-break:break-word}.ech{margin-top:16px;border:1px solid #284c68;background:#0a1b2c;border-radius:14px;padding:14px}.ech.good{border-color:#28614f;background:#0a201d}.echTitle{display:flex;justify-content:space-between;gap:10px;align-items:center}.pill{font-size:11px;padding:4px 8px;border-radius:999px;background:#19334d;color:#a9dfff}.pill.good{background:#123d32;color:#93f5cd}.raw{margin-top:14px}.raw summary{cursor:pointer;color:#b9cde7}.raw pre{white-space:pre-wrap;word-break:break-word;background:#07121f;border:1px solid var(--line);border-radius:10px;padding:12px;max-height:360px;overflow:auto}.error{margin-top:14px;padding:12px;border:1px solid #713247;background:#311522;color:#ffc0cc;border-radius:11px;display:none}@media(max-width:860px){.grid{grid-template-columns:1fr}.top{flex-direction:column}.query{grid-template-columns:1fr 120px}.query .button{grid-column:1/-1}.stats{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.wrap{padding:24px 12px}.brand h1{font-size:29px}.detail{grid-template-columns:1fr}.endpoint{align-items:stretch;flex-direction:column}.query{grid-template-columns:1fr}.query .button{grid-column:auto}}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div class="brand"><h1>DNS Dash</h1><p>A compact DNS-over-HTTPS resolver and inspection console running entirely on Cloudflare Workers. Query ordinary records, inspect HTTPS/SVCB parameters, and see whether ECH is currently advertised.</p></div>
    <div class="badge">DoH + DNS inspection</div>
  </div>

  <div class="grid">
    <section class="card pad">
      <h2>Resolve a name</h2>
      <div class="query">
        <input id="name" class="input" value="cloudflare-ech.com" autocomplete="off" spellcheck="false" aria-label="DNS name">
        <select id="type" class="select" aria-label="DNS type">
          <option>A</option><option>AAAA</option><option selected>HTTPS</option><option>SVCB</option><option>CNAME</option><option>MX</option><option>TXT</option><option>NS</option><option>SOA</option><option>CAA</option>
        </select>
        <button id="go" class="button">Resolve</button>
      </div>
      <div class="quick"><button class="chip" data-type="A">A</button><button class="chip" data-type="AAAA">AAAA</button><button class="chip" data-type="HTTPS">HTTPS / ECH</button><button class="chip" data-name="cloudflare-ech.com" data-type="HTTPS">Cloudflare ECH</button></div>
      <div id="error" class="error"></div>
      <div class="stats">
        <div class="stat"><b id="latency">—</b><span>Resolver latency</span></div>
        <div class="stat"><b id="count">—</b><span>Answers</span></div>
        <div class="stat"><b id="rcode">—</b><span>DNS status</span></div>
        <div class="stat"><b id="dnssec">—</b><span>DNSSEC AD</span></div>
      </div>
    </section>

    <aside class="card pad">
      <h2>Your DoH endpoint</h2>
      <div class="sub">Use this URL in clients that support RFC 8484 DNS-over-HTTPS.</div>
      <div class="endpoint"><div id="doh" class="code"></div><button class="copy" data-copy="doh">Copy</button></div>
      <h2 style="margin-top:20px">v2rayNG / Xray ECH helper</h2>
      <div class="sub">Xray can query HTTPS type 65 through this DoH endpoint to obtain ECHConfig dynamically.</div>
      <div class="endpoint"><div id="echExample" class="code"></div><button class="copy" data-copy="echExample">Copy</button></div>
    </aside>
  </div>

  <section class="card resultCard">
    <div class="pad"><div class="status"><span class="dot"></span><h2 style="margin:0">Answers</h2></div><div id="meta" class="sub" style="margin-top:5px">Ready.</div></div>
    <div class="tableWrap"><table><thead><tr><th>Name</th><th>Type</th><th>TTL</th><th>Data</th></tr></thead><tbody id="answers"><tr><td colspan="4" class="empty">Run a query to see DNS answers.</td></tr></tbody></table></div>
    <div id="inspection" class="pad"></div>
  </section>
</div>
<script>
(function(){
  var nameEl=document.getElementById('name'),typeEl=document.getElementById('type'),go=document.getElementById('go'),err=document.getElementById('error'),answers=document.getElementById('answers'),inspection=document.getElementById('inspection');
  var endpoint=location.origin+'/dns-query';
  document.getElementById('doh').textContent=endpoint;
  document.getElementById('echExample').textContent='cloudflare-ech.com+'+endpoint;
  document.querySelectorAll('[data-copy]').forEach(function(btn){btn.addEventListener('click',async function(){var id=btn.getAttribute('data-copy');try{await navigator.clipboard.writeText(document.getElementById(id).textContent);var old=btn.textContent;btn.textContent='Copied';setTimeout(function(){btn.textContent=old},900)}catch(e){}})});
  document.querySelectorAll('.chip').forEach(function(chip){chip.addEventListener('click',function(){if(chip.dataset.name)nameEl.value=chip.dataset.name;if(chip.dataset.type)typeEl.value=chip.dataset.type;resolve()})});
  go.addEventListener('click',resolve);nameEl.addEventListener('keydown',function(e){if(e.key==='Enter')resolve()});

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function badge(v,good){return '<span class="pill'+(good?' good':'')+'">'+esc(v)+'</span>'}
  async function resolve(){
    err.style.display='none';go.disabled=true;go.textContent='Resolving…';inspection.innerHTML='';
    try{
      var url='/api/resolve?name='+encodeURIComponent(nameEl.value.trim())+'&type='+encodeURIComponent(typeEl.value);
      var res=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});var data=await res.json();
      if(!res.ok)throw new Error(data.error||'Query failed');
      document.getElementById('latency').textContent=data.elapsedMs+' ms';document.getElementById('count').textContent=data.answers.length;document.getElementById('rcode').textContent=data.status;document.getElementById('dnssec').textContent=data.flags.ad?'Yes':'No';
      document.getElementById('meta').textContent=data.query.name+' · '+data.query.type+' · resolver '+data.resolver;
      if(!data.answers.length){answers.innerHTML='<tr><td colspan="4" class="empty">No answer records returned.</td></tr>'}else{answers.innerHTML=data.answers.map(function(a){return '<tr><td>'+esc(a.name)+'</td><td>'+badge(a.typeName,false)+'</td><td>'+esc(a.ttl)+'s</td><td class="data">'+esc(a.data)+'</td></tr>'}).join('')}
      renderInspection(data.inspection);
      inspection.innerHTML+= '<details class="raw"><summary>Raw normalized response</summary><pre>'+esc(JSON.stringify(data,null,2))+'</pre></details>';
    }catch(e){err.textContent=e.message||String(e);err.style.display='block';answers.innerHTML='<tr><td colspan="4" class="empty">Query failed.</td></tr>';document.getElementById('meta').textContent='Resolver request failed.'}
    finally{go.disabled=false;go.textContent='Resolve'}
  }
  function renderInspection(info){
    if(!info||!info.serviceBindings||!info.serviceBindings.length)return;
    var html='<div class="ech '+(info.echAvailable?'good':'')+'"><div class="echTitle"><strong>HTTPS / SVCB inspection</strong>'+badge(info.echAvailable?'ECH advertised':'No ECH parameter',info.echAvailable)+'</div>';
    info.serviceBindings.forEach(function(r){html+='<div class="detail"><div class="kv"><small>Priority / target</small><div>'+esc(r.priority)+' · '+esc(r.target)+'</div></div><div class="kv"><small>ALPN</small><div>'+esc(r.alpn.join(', ')||'—')+'</div></div><div class="kv"><small>IPv4 hints</small><div>'+esc(r.ipv4hint.join(', ')||'—')+'</div></div><div class="kv"><small>IPv6 hints</small><div>'+esc(r.ipv6hint.join(', ')||'—')+'</div></div><div class="kv"><small>ECHConfig</small><div>'+(r.ech?esc(r.ech.slice(0,92))+(r.ech.length>92?'…':''):'—')+'</div></div><div class="kv"><small>ECH size</small><div>'+esc(r.echBytesApprox||0)+' bytes approx.</div></div></div>'});
    html+='</div>';inspection.innerHTML=html;
  }
  resolve();
})();
</script>
</body>
</html>`;
}
