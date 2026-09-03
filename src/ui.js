export function dashboardPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>DNS Dash</title>
<style>
:root{--bg:#050912;--panel:#0b1220;--panel2:#0e1728;--line:#1e2d46;--text:#eef5ff;--muted:#8da2bf;--blue:#5cc8ff;--cyan:#62f3d0;--ok:#76e5aa;--warn:#ffd166;--bad:#ff7f96;--violet:#b597ff;--shadow:0 22px 70px rgba(0,0,0,.33)}*{box-sizing:border-box}html{background:var(--bg)}body{margin:0;color:var(--text);background:radial-gradient(circle at 10% -5%,rgba(37,106,174,.30),transparent 28%),radial-gradient(circle at 92% 4%,rgba(72,43,139,.22),transparent 26%),linear-gradient(180deg,#07101c 0,#050912 56%);font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh}.wrap{max-width:1240px;margin:auto;padding:32px 20px 64px}.top{display:flex;justify-content:space-between;gap:22px;align-items:flex-start;margin-bottom:22px}.brand{display:flex;gap:14px;align-items:flex-start}.logo{width:44px;height:44px;border:1px solid #2c5a7e;border-radius:14px;background:linear-gradient(145deg,#113452,#111c31);display:grid;place-items:center;box-shadow:inset 0 0 28px rgba(92,200,255,.10)}.logo svg{width:26px;height:26px}.brand h1{font-size:31px;line-height:1.1;letter-spacing:-.04em;margin:0 0 6px}.brand p{margin:0;color:var(--muted);max-width:720px}.health{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:#0a1423;padding:8px 11px;border-radius:999px;color:#bdd0e8;white-space:nowrap}.dot{width:8px;height:8px;border-radius:50%;background:var(--warn);box-shadow:0 0 0 4px rgba(255,209,102,.09)}.dot.ok{background:var(--ok);box-shadow:0 0 0 4px rgba(118,229,170,.09)}.grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(330px,.75fr);gap:16px}.card{background:linear-gradient(180deg,rgba(15,24,41,.96),rgba(9,16,29,.96));border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);overflow:hidden}.pad{padding:18px}.card h2{font-size:14px;letter-spacing:.01em;margin:0}.sub{font-size:12px;color:var(--muted)}.queryrow{display:grid;grid-template-columns:minmax(0,1fr) 135px 112px;gap:9px;margin-top:14px}.input,.select,.btn{height:43px;border-radius:10px;border:1px solid var(--line);font:inherit}.input,.select{background:#07111e;color:var(--text);padding:0 11px;outline:none}.input:focus,.select:focus{border-color:#377da7;box-shadow:0 0 0 3px rgba(92,200,255,.08)}.btn{cursor:pointer;background:linear-gradient(180deg,#6fd7ff,#35acd8);border-color:#55c9f5;color:#04141f;font-weight:800}.btn.alt{background:#0d1b2d;color:#dbe9fa;border-color:#2a3c57;font-weight:650}.btn:disabled{opacity:.55;cursor:wait}.quick{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.chip{background:#091522;color:#b8cae0;border:1px solid var(--line);border-radius:999px;padding:6px 9px;font:inherit;font-size:12px;cursor:pointer}.chip:hover{border-color:#35506f;color:#e7f3ff}.modebar{display:flex;gap:7px;margin-top:14px}.mode{flex:1;height:38px;background:#081522;border:1px solid var(--line);border-radius:9px;color:#9fb4ce;cursor:pointer;font:inherit}.mode.active{background:#10243a;border-color:#315d7d;color:#dff6ff}.error{display:none;margin-top:12px;padding:10px 12px;border:1px solid #6d3042;background:#2a121b;color:#ffc5cf;border-radius:10px}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:14px}.stat{background:#07111e;border:1px solid var(--line);border-radius:11px;padding:10px}.stat strong{display:block;font-size:17px;letter-spacing:-.02em}.stat span{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em}.endpointBlock+.endpointBlock{margin-top:18px;padding-top:18px;border-top:1px solid var(--line)}.endpoint{display:flex;align-items:center;gap:8px;margin-top:9px}.code{flex:1;min-width:0;background:#06101b;border:1px solid var(--line);padding:9px 10px;border-radius:9px;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#b9eaff;white-space:nowrap;overflow:auto}.copy{border:1px solid var(--line);background:#102037;color:#eaf4ff;border-radius:9px;padding:8px 10px;cursor:pointer;font:inherit;font-size:12px}.resolverList{margin-top:10px;display:flex;gap:7px;flex-wrap:wrap}.pill{display:inline-flex;align-items:center;gap:5px;border:1px solid #2a3c57;background:#0b1929;border-radius:999px;padding:4px 8px;font-size:11px;color:#b9cde4}.pill.good{border-color:#285d50;background:#0d231e;color:#9af0cb}.pill.warn{border-color:#67572f;background:#241f0e;color:#ffe49a}.pill.violet{border-color:#4a3e73;background:#18142d;color:#d2c7ff}.section{margin-top:16px}.sectionHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.tableWrap{overflow:auto;border-top:1px solid var(--line)}table{width:100%;border-collapse:collapse;min-width:720px}th,td{text-align:left;padding:10px 13px;border-bottom:1px solid rgba(30,45,70,.7);vertical-align:top}th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);background:#081321}td.data{font:11.5px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-word}.empty{text-align:center;color:var(--muted);padding:32px}.profileGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.profileBox{border:1px solid var(--line);background:#07111e;border-radius:12px;padding:11px}.profileBox small{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}.mono{font:11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}.echArea{padding:16px;border-top:1px solid var(--line)}.echHeader{display:flex;justify-content:space-between;gap:10px;align-items:center}.echGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:11px}.kv{background:#07111e;border:1px solid var(--line);border-radius:10px;padding:10px;min-width:0}.kv small{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}.config{margin-top:10px;border:1px solid #31436a;background:#0a1326;border-radius:13px;padding:12px}.configTop{display:flex;align-items:center;justify-content:space-between;gap:10px}.config h3{font-size:13px;margin:0}.suite{margin-top:8px;padding:8px;background:#07111e;border-radius:9px;border:1px solid var(--line);font-size:11px;color:#cbd9ea}.raw{margin-top:12px}.raw summary{cursor:pointer;color:#afc3da}.raw pre{white-space:pre-wrap;word-break:break-word;max-height:380px;overflow:auto;background:#06101b;border:1px solid var(--line);border-radius:10px;padding:11px;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#bad1ea}.footer{margin-top:18px;text-align:center;color:#647c9a;font-size:11px}@media(max-width:900px){.grid{grid-template-columns:1fr}.stats{grid-template-columns:repeat(3,1fr)}}@media(max-width:620px){.wrap{padding:22px 12px 48px}.top{flex-direction:column}.brand h1{font-size:27px}.queryrow{grid-template-columns:1fr 110px}.queryrow .btn{grid-column:1/-1}.stats{grid-template-columns:repeat(2,1fr)}.profileGrid,.echGrid{grid-template-columns:1fr}.endpoint{align-items:stretch;flex-direction:column}.health{align-self:flex-start}}
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="brand"><div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#6ee8d0" stroke-width="1.5"><circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4M12 3.8c2.4 2.2 3.5 4.9 3.5 8.2S14.4 18 12 20.2C9.6 18 8.5 15.3 8.5 12S9.6 6 12 3.8Z"/></svg></div><div><h1>DNS Dash</h1><p>Wire-format DNS over HTTPS, DNSSEC-aware inspection, HTTPS/SVCB decoding and RFC 9849 ECHConfig analysis — in one Cloudflare Worker.</p></div></div>
    <div class="health"><span id="healthDot" class="dot"></span><span id="healthText">Checking resolver</span></div>
  </header>

  <div class="grid">
    <section class="card pad">
      <div class="sectionHead"><div><h2>DNS inspector</h2><div class="sub">Resolve one record or build a connection profile with A + AAAA + HTTPS.</div></div></div>
      <div class="modebar"><button id="profileMode" class="mode active">Connection profile</button><button id="recordMode" class="mode">Single record</button></div>
      <div class="queryrow">
        <input id="name" class="input" value="cloudflare-ech.com" autocomplete="off" spellcheck="false" aria-label="DNS name">
        <select id="type" class="select" aria-label="DNS type"><option>A</option><option>AAAA</option><option selected>HTTPS</option><option>SVCB</option><option>CNAME</option><option>NS</option><option>MX</option><option>TXT</option><option>SOA</option><option>PTR</option><option>SRV</option><option>CAA</option></select>
        <button id="go" class="btn">Inspect</button>
      </div>
      <div class="quick"><button class="chip" data-name="cloudflare-ech.com">Cloudflare ECH</button><button class="chip" data-name="google.com">Google</button><button class="chip" data-name="example.com">Example</button><button class="chip" data-mode="record" data-type="HTTPS">HTTPS only</button></div>
      <div id="error" class="error"></div>
      <div class="stats">
        <div class="stat"><strong id="latency">—</strong><span>Latency</span></div>
        <div class="stat"><strong id="rcode">—</strong><span>Rcode</span></div>
        <div class="stat"><strong id="dnssec">—</strong><span>DNSSEC AD</span></div>
        <div class="stat"><strong id="answersCount">—</strong><span>Answers</span></div>
        <div class="stat"><strong id="bytes">—</strong><span>Wire bytes</span></div>
      </div>
    </section>

    <aside class="card pad">
      <div class="endpointBlock"><h2>DoH endpoint</h2><div class="sub">RFC 8484 GET and POST. Client GET requests are relayed upstream as POST to keep DNS packets out of the upstream URL.</div><div class="endpoint"><div id="doh" class="code"></div><button class="copy" data-copy="doh">Copy</button></div></div>
      <div class="endpointBlock"><h2>v2rayNG / Xray ECH lookup</h2><div class="sub">Use the Worker DoH endpoint to fetch current HTTPS type 65 ECHConfig dynamically.</div><div class="endpoint"><div id="echHelper" class="code"></div><button class="copy" data-copy="echHelper">Copy</button></div></div>
      <div class="endpointBlock"><h2>Resolver chain</h2><div id="resolverList" class="resolverList"><span class="pill">Loading…</span></div><div class="sub" style="margin-top:8px">Fallback resolvers are optional and configured by Worker environment variables.</div></div>
    </aside>
  </div>

  <section class="card section">
    <div class="pad"><div class="sectionHead"><div><h2 id="resultTitle">Connection profile</h2><div id="meta" class="sub">Ready.</div></div><div id="badges"></div></div><div id="profile" class="profileGrid"><div class="profileBox"><small>IPv4</small><div class="mono">—</div></div><div class="profileBox"><small>IPv6</small><div class="mono">—</div></div><div class="profileBox"><small>ALPN</small><div class="mono">—</div></div></div></div>
    <div class="tableWrap"><table><thead><tr><th>Name</th><th>Type</th><th>TTL</th><th>Decoded data</th></tr></thead><tbody id="answers"><tr><td colspan="4" class="empty">Run an inspection to see DNS records.</td></tr></tbody></table></div>
    <div id="echArea" class="echArea"><div class="echHeader"><div><h2>ECH inspector</h2><div class="sub">RFC 9849 ECHConfigList decoded directly from SvcParamKey 5 wire bytes.</div></div><span class="pill">No data yet</span></div></div>
    <div id="rawArea" class="pad"></div>
  </section>
  <div class="footer">DNS Dash does not keep application-level query logs or store ECH keys. ECH data shown here comes from DNS.</div>
</div>
<script>
(function(){
  var state={mode:'profile',last:null};
  var nameEl=document.getElementById('name'),typeEl=document.getElementById('type'),go=document.getElementById('go'),err=document.getElementById('error'),answers=document.getElementById('answers'),profile=document.getElementById('profile'),echArea=document.getElementById('echArea'),rawArea=document.getElementById('rawArea');
  var endpoint=location.origin+'/dns-query';
  document.getElementById('doh').textContent=endpoint;
  document.getElementById('echHelper').textContent='cloudflare-ech.com+'+endpoint;

  document.querySelectorAll('[data-copy]').forEach(function(btn){btn.addEventListener('click',function(){copyText(document.getElementById(btn.dataset.copy).textContent,btn)})});
  document.getElementById('profileMode').addEventListener('click',function(){setMode('profile')});
  document.getElementById('recordMode').addEventListener('click',function(){setMode('record')});
  document.querySelectorAll('.chip').forEach(function(chip){chip.addEventListener('click',function(){if(chip.dataset.name)nameEl.value=chip.dataset.name;if(chip.dataset.type)typeEl.value=chip.dataset.type;if(chip.dataset.mode)setMode(chip.dataset.mode);run()})});
  go.addEventListener('click',run);nameEl.addEventListener('keydown',function(e){if(e.key==='Enter')run()});

  function setMode(mode){state.mode=mode;document.getElementById('profileMode').classList.toggle('active',mode==='profile');document.getElementById('recordMode').classList.toggle('active',mode==='record');typeEl.disabled=mode==='profile';document.getElementById('resultTitle').textContent=mode==='profile'?'Connection profile':'DNS answers'}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function pill(v,kind){return '<span class="pill '+(kind||'')+'">'+esc(v)+'</span>'}
  function copyText(text,btn){navigator.clipboard.writeText(text).then(function(){if(btn){var old=btn.textContent;btn.textContent='Copied';setTimeout(function(){btn.textContent=old},900)}}).catch(function(){})}
  function setError(message){err.textContent=message;err.style.display=message?'block':'none'}
  function flatAnswers(data){if(state.mode==='record')return data.answers||[];var out=[];['A','AAAA','HTTPS'].forEach(function(t){var d=data.records&&data.records[t];if(d&&d.answers)out=out.concat(d.answers)});return out}

  async function health(){try{var r=await fetch('/health',{cache:'no-store'}),d=await r.json();if(!r.ok)throw 0;document.getElementById('healthDot').classList.add('ok');document.getElementById('healthText').textContent='Resolver ready';document.getElementById('resolverList').innerHTML=(d.upstreams||[]).map(function(x,i){return pill((i?'fallback · ':'primary · ')+x,i?'':'good')}).join('')||pill('No resolver','warn')}catch(e){document.getElementById('healthText').textContent='Health unavailable'}}

  async function run(){
    setError('');go.disabled=true;go.textContent='Inspecting…';echArea.innerHTML='<div class="echHeader"><div><h2>ECH inspector</h2><div class="sub">Waiting for HTTPS record.</div></div>'+pill('Querying','warn')+'</div>';rawArea.innerHTML='';
    try{
      var name=nameEl.value.trim();
      var url=state.mode==='profile'?'/api/profile?name='+encodeURIComponent(name):'/api/resolve?name='+encodeURIComponent(name)+'&type='+encodeURIComponent(typeEl.value)+'&dnssec=1';
      var r=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});var d=await r.json();if(!r.ok)throw new Error(d.detail||d.error||'Query failed');state.last=d;
      render(d);
    }catch(e){setError(e.message||String(e));answers.innerHTML='<tr><td colspan="4" class="empty">Inspection failed.</td></tr>';document.getElementById('meta').textContent='Resolver request failed.';echArea.innerHTML='<div class="echHeader"><div><h2>ECH inspector</h2></div>'+pill('Unavailable','warn')+'</div>'}
    finally{go.disabled=false;go.textContent='Inspect'}
  }

  function render(d){
    var list=flatAnswers(d),main=state.mode==='record'?d:(d.records&&d.records.HTTPS)||d.records&&d.records.A||{};
    document.getElementById('latency').textContent=(d.elapsedMs!=null?d.elapsedMs:main.elapsedMs||0)+' ms';
    document.getElementById('rcode').textContent=state.mode==='record'?(d.statusName||d.status):(main.statusName||'mixed');
    document.getElementById('dnssec').textContent=state.mode==='record'?(d.flags&&d.flags.ad?'Yes':'No'):profileDnssec(d);
    document.getElementById('answersCount').textContent=list.length;
    document.getElementById('bytes').textContent=state.mode==='record'?(d.bytes?d.bytes.response:'—'):profileBytes(d);
    document.getElementById('meta').textContent=(d.name||d.query&&d.query.name||'')+' · '+(state.mode==='profile'?'A + AAAA + HTTPS':'type '+(d.query&&d.query.type||''));
    document.getElementById('badges').innerHTML=state.mode==='profile'&&d.summary&&d.summary.echAvailable?pill('ECH advertised','good'):'';
    renderProfile(d);
    renderTable(list);
    renderEch(state.mode==='record'?d.inspection:(d.records&&d.records.HTTPS&&d.records.HTTPS.inspection));
    rawArea.innerHTML='<details class="raw"><summary>Normalized wire-decoded response</summary><pre>'+esc(JSON.stringify(d,null,2))+'</pre></details>';
  }

  function profileDnssec(d){var vals=['A','AAAA','HTTPS'].map(function(t){return d.records&&d.records[t]&&d.records[t].flags&&d.records[t].flags.ad}).filter(function(v){return v!==undefined});return vals.length&&vals.every(Boolean)?'Yes':vals.some(Boolean)?'Partial':'No'}
  function profileBytes(d){var n=0;['A','AAAA','HTTPS'].forEach(function(t){var x=d.records&&d.records[t]&&d.records[t].bytes;if(x)n+=x.response||0});return n||'—'}
  function renderProfile(d){
    if(state.mode==='profile'){
      var s=d.summary||{};profile.style.display='grid';profile.innerHTML='<div class="profileBox"><small>IPv4</small><div class="mono">'+esc((s.ipv4||[]).join('\n')||'—')+'</div></div><div class="profileBox"><small>IPv6</small><div class="mono">'+esc((s.ipv6||[]).join('\n')||'—')+'</div></div><div class="profileBox"><small>ALPN</small><div class="mono">'+esc((s.alpn||[]).join(', ')||'—')+'</div></div>';
    }else{profile.style.display='none'}
  }
  function renderTable(list){if(!list.length){answers.innerHTML='<tr><td colspan="4" class="empty">No answer records returned.</td></tr>';return}answers.innerHTML=list.map(function(a){return '<tr><td>'+esc(a.name)+'</td><td>'+pill(a.typeName,'violet')+'</td><td>'+esc(a.ttl)+'s</td><td class="data">'+esc(a.data)+'</td></tr>'}).join('')}
  function renderEch(info){
    if(!info||!info.serviceBindings||!info.serviceBindings.length){echArea.innerHTML='<div class="echHeader"><div><h2>ECH inspector</h2><div class="sub">No HTTPS/SVCB service binding in this answer.</div></div>'+pill('No service binding','')+'</div>';return}
    var html='<div class="echHeader"><div><h2>ECH inspector</h2><div class="sub">Parsed from DNS wire format, including the binary ECHConfigList.</div></div>'+pill(info.echAvailable?'ECH advertised':'ECH not advertised',info.echAvailable?'good':'warn')+'</div>';
    info.serviceBindings.forEach(function(r){var p=r.params||{};html+='<div class="echGrid"><div class="kv"><small>Mode / priority</small><div>'+esc(r.mode)+' · '+esc(r.priority)+'</div></div><div class="kv"><small>Target</small><div class="mono">'+esc(r.target)+'</div></div><div class="kv"><small>ALPN</small><div>'+esc(Array.isArray(p.alpn)?p.alpn.join(', '):'—')+'</div></div><div class="kv"><small>Port</small><div>'+esc(p.port||443)+'</div></div><div class="kv"><small>IPv4 hints</small><div class="mono">'+esc(Array.isArray(p.ipv4hint)?p.ipv4hint.join(', '):'—')+'</div></div><div class="kv"><small>IPv6 hints</small><div class="mono">'+esc(Array.isArray(p.ipv6hint)?p.ipv6hint.join(', '):'—')+'</div></div></div>';if(p.ech&&p.ech.base64){html+='<div class="endpoint"><div class="code echRaw">'+esc(p.ech.base64)+'</div><button class="copy copyEch">Copy ECHConfigList</button></div>'}}
    (info.echConfigs||[]).forEach(function(c,i){html+='<div class="config"><div class="configTop"><h3>ECH config '+(i+1)+'</h3>'+pill(c.supportedVersion?c.versionHex+' · RFC 9849':c.versionHex,c.supportedVersion?'good':'warn')+'</div><div class="echGrid"><div class="kv"><small>Config ID</small><div>'+esc(c.configId==null?'—':c.configId)+'</div></div><div class="kv"><small>Public name</small><div class="mono">'+esc(c.publicName||'—')+'</div></div><div class="kv"><small>KEM</small><div>'+esc(c.kem||'—')+'</div></div><div class="kv"><small>Public key</small><div>'+esc(c.publicKeyBytes||0)+' bytes</div></div><div class="kv"><small>Maximum name length</small><div>'+esc(c.maximumNameLength==null?'—':c.maximumNameLength)+'</div></div><div class="kv"><small>Extensions</small><div>'+esc((c.extensions||[]).length)+'</div></div></div>'+(c.cipherSuites||[]).map(function(s){return '<div class="suite">'+esc(s.kdf)+' + '+esc(s.aead)+'</div>'}).join('')+'</div>'}
    echArea.innerHTML=html;echArea.querySelectorAll('.copyEch').forEach(function(btn){btn.addEventListener('click',function(){copyText(btn.previousElementSibling.textContent,btn)})})
  }
  setMode('profile');health();run();
})();
</script>
</body>
</html>`;
}
