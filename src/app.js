export function dashboardApp() {
  const $ = (id) => document.getElementById(id);
  const state = { mode: 'profile', busy: false };
  const e = {
    name: $('name'), type: $('type'), go: $('go'), error: $('error'), healthDot: $('healthDot'), healthText: $('healthText'),
    resolverList: $('resolverList'), profileMode: $('profileMode'), recordMode: $('recordMode'), resultTitle: $('resultTitle'), meta: $('meta'),
    badges: $('badges'), latency: $('latency'), rcode: $('rcode'), dnssec: $('dnssec'), answersCount: $('answersCount'), bytes: $('bytes'),
    profile: $('profile'), answers: $('answers'), answerCards: $('answerCards'), echArea: $('echArea'), rawArea: $('rawArea'), doh: $('doh'), echHelper: $('echHelper')
  };

  const endpoint = location.origin + '/dns-query';
  e.doh.textContent = endpoint;
  e.echHelper.textContent = 'cloudflare-ech.com+' + endpoint;

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pill = (v, kind = '') => '<span class="pill ' + kind + '">' + esc(v) + '</span>';
  const error = (msg = '') => { e.error.textContent = msg; e.error.hidden = !msg; };
  const busy = (on) => { state.busy = on; e.go.disabled = on; e.go.textContent = on ? 'Inspecting…' : 'Inspect'; };

  async function copyText(text, button) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement('textarea');
        area.value = text; area.readOnly = true; area.style.position = 'fixed'; area.style.opacity = '0';
        document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
      }
      if (button) { const old = button.textContent; button.textContent = 'Copied'; setTimeout(() => { button.textContent = old; }, 900); }
    } catch { if (button) button.textContent = 'Copy failed'; }
  }

  function setMode(mode) {
    state.mode = mode === 'record' ? 'record' : 'profile';
    e.profileMode.classList.toggle('active', state.mode === 'profile');
    e.recordMode.classList.toggle('active', state.mode === 'record');
    e.type.disabled = state.mode === 'profile';
    e.resultTitle.textContent = state.mode === 'profile' ? 'Connection profile' : 'DNS record result';
    e.meta.textContent = state.mode === 'profile' ? 'A + AAAA + HTTPS will be resolved together.' : 'One DNS record type will be resolved.';
  }

  async function health() {
    try {
      const r = await fetch('/health', { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      e.healthDot.classList.add('ok'); e.healthText.textContent = 'Resolver ready';
      const upstreams = Array.isArray(d.upstreams) ? d.upstreams : [];
      e.resolverList.innerHTML = upstreams.length ? upstreams.map((x, i) => pill((i ? 'fallback · ' : 'primary · ') + x, i ? '' : 'good')).join('') : pill('No resolver', 'warn');
    } catch {
      e.healthDot.classList.remove('ok'); e.healthText.textContent = 'Health unavailable'; e.resolverList.innerHTML = pill('Health check failed', 'warn');
    }
  }

  function displayRecord(rr) {
    const p = rr && rr.parsed;
    if (p && typeof p === 'object') {
      if (p.address) return p.address;
      if (p.exchange) return (p.preference == null ? '' : p.preference + ' ') + p.exchange;
      if (p.target && p.priority != null) return p.priority + ' ' + p.target;
      if (p.text) return Array.isArray(p.text) ? p.text.join(' · ') : p.text;
      if (p.value != null) return String(p.value);
      try { return JSON.stringify(p); } catch {}
    }
    return rr && rr.data ? String(rr.data) : '—';
  }

  function recordsFrom(data) {
    if (state.mode === 'record') return Array.isArray(data.answers) ? data.answers : [];
    const out = [];
    for (const t of ['A', 'AAAA', 'HTTPS']) {
      const bucket = data.records && data.records[t];
      if (bucket && Array.isArray(bucket.answers)) out.push(...bucket.answers);
    }
    return out;
  }

  function renderAnswers(records) {
    if (!records.length) {
      e.answers.innerHTML = '<tr><td colspan="4" class="empty">No answer records returned.</td></tr>';
      e.answerCards.innerHTML = '<div class="emptyCard">No answer records returned.</div>';
      return;
    }
    e.answers.innerHTML = records.map((rr) => '<tr><td>' + esc(rr.name || '—') + '</td><td>' + pill(rr.typeName || rr.type || '—') + '</td><td>' + esc(rr.ttl == null ? '—' : rr.ttl + 's') + '</td><td class="data">' + esc(displayRecord(rr)) + '</td></tr>').join('');
    e.answerCards.innerHTML = records.map((rr) => '<article class="answerCard"><div class="answerTop"><strong>' + esc(rr.typeName || rr.type || 'DNS') + '</strong><span>' + esc(rr.ttl == null ? '—' : rr.ttl + 's') + '</span></div><div class="answerName">' + esc(rr.name || '—') + '</div><div class="answerData">' + esc(displayRecord(rr)) + '</div></article>').join('');
  }

  function renderProfile(data) {
    e.profile.hidden = state.mode !== 'profile';
    if (state.mode !== 'profile') return;
    const s = data.summary || {};
    const rows = [
      ['IPv4', Array.isArray(s.ipv4) && s.ipv4.length ? s.ipv4.join(', ') : '—'],
      ['IPv6', Array.isArray(s.ipv6) && s.ipv6.length ? s.ipv6.join(', ') : '—'],
      ['ALPN', Array.isArray(s.alpn) && s.alpn.length ? s.alpn.join(', ') : '—']
    ];
    e.profile.innerHTML = rows.map(([k, v]) => '<div class="profileBox"><small>' + k + '</small><div class="mono">' + esc(v) + '</div></div>').join('');
  }

  function inspectionFrom(data) {
    return state.mode === 'record' ? (data.inspection || null) : (data.records && data.records.HTTPS ? data.records.HTTPS.inspection || null : null);
  }

  function renderEch(info) {
    if (!info || !Array.isArray(info.serviceBindings) || !info.serviceBindings.length) {
      e.echArea.innerHTML = '<div class="echHeader"><div><h2>ECH inspector</h2><div class="sub">No HTTPS/SVCB service-binding data in this response.</div></div>' + pill('No ECH data', 'warn') + '</div>';
      return;
    }
    let html = '<div class="echHeader"><div><h2>ECH inspector</h2><div class="sub">Decoded directly from HTTPS/SVCB DNS wire data.</div></div>' + pill(info.echAvailable ? 'ECH advertised' : 'ECH not advertised', info.echAvailable ? 'good' : 'warn') + '</div>';
    for (const rr of info.serviceBindings) {
      const p = rr.params || {};
      html += '<div class="echGrid"><div class="kv"><small>Mode / priority</small><div>' + esc((rr.mode || 'service') + ' · ' + rr.priority) + '</div></div><div class="kv"><small>Target</small><div class="mono">' + esc(rr.target || '.') + '</div></div><div class="kv"><small>ALPN</small><div>' + esc(Array.isArray(p.alpn) && p.alpn.length ? p.alpn.join(', ') : '—') + '</div></div><div class="kv"><small>Port</small><div>' + esc(p.port || 443) + '</div></div><div class="kv"><small>IPv4 hints</small><div class="mono">' + esc(Array.isArray(p.ipv4hint) && p.ipv4hint.length ? p.ipv4hint.join(', ') : '—') + '</div></div><div class="kv"><small>IPv6 hints</small><div class="mono">' + esc(Array.isArray(p.ipv6hint) && p.ipv6hint.length ? p.ipv6hint.join(', ') : '—') + '</div></div></div>';
      if (p.ech && p.ech.base64) html += '<div class="copyRow"><div class="code echRaw">' + esc(p.ech.base64) + '</div><button class="copy copyEch" type="button">Copy ECHConfigList</button></div>';
    }
    for (const [i, c] of (Array.isArray(info.echConfigs) ? info.echConfigs : []).entries()) {
      html += '<div class="config"><div class="configTop"><h3>ECH config ' + (i + 1) + '</h3>' + pill(c.supportedVersion ? (c.versionHex + ' · RFC 9849') : (c.versionHex || 'unknown'), c.supportedVersion ? 'good' : 'warn') + '</div><div class="echGrid"><div class="kv"><small>Config ID</small><div>' + esc(c.configId == null ? '—' : c.configId) + '</div></div><div class="kv"><small>Public name</small><div class="mono">' + esc(c.publicName || '—') + '</div></div><div class="kv"><small>KEM</small><div>' + esc(c.kem || '—') + '</div></div><div class="kv"><small>Public key</small><div>' + esc((c.publicKeyBytes || 0) + ' bytes') + '</div></div><div class="kv"><small>Maximum name length</small><div>' + esc(c.maximumNameLength == null ? '—' : c.maximumNameLength) + '</div></div><div class="kv"><small>Extensions</small><div>' + esc(Array.isArray(c.extensions) ? c.extensions.length : 0) + '</div></div></div>' + (Array.isArray(c.cipherSuites) ? c.cipherSuites.map((s) => '<div class="suite">' + esc(s.kdf || 'KDF') + ' + ' + esc(s.aead || 'AEAD') + '</div>').join('') : '') + '</div>';
    }
    e.echArea.innerHTML = html;
    e.echArea.querySelectorAll('.copyEch').forEach((button) => button.addEventListener('click', () => copyText(button.previousElementSibling.textContent, button)));
  }

  function renderStats(data, records) {
    if (state.mode === 'record') {
      e.latency.textContent = data.elapsedMs == null ? '—' : data.elapsedMs + ' ms';
      e.rcode.textContent = data.statusName || data.status || '—';
      e.dnssec.textContent = data.dnssec && data.dnssec.authenticatedData ? 'AD' : 'No';
      e.answersCount.textContent = records.length;
      e.bytes.textContent = data.bytes && data.bytes.response != null ? data.bytes.response : '—';
      return;
    }
    const buckets = Object.values(data.records || {});
    const statuses = [...new Set(buckets.map((x) => x && x.statusName).filter(Boolean))];
    const ad = buckets.length > 0 && buckets.every((x) => x && x.dnssec && x.dnssec.authenticatedData);
    const bytes = buckets.reduce((n, x) => n + Number(x && x.bytes && x.bytes.response || 0), 0);
    e.latency.textContent = data.elapsedMs == null ? '—' : data.elapsedMs + ' ms';
    e.rcode.textContent = statuses.length === 1 ? statuses[0] : (statuses.length ? 'Mixed' : '—');
    e.dnssec.textContent = ad ? 'AD' : 'No'; e.answersCount.textContent = records.length; e.bytes.textContent = bytes || '—';
  }

  function renderBadges(data) {
    const list = [];
    if (state.mode === 'profile') {
      if (data.summary && data.summary.echAvailable) list.push(pill('ECH', 'good'));
      const failed = Object.keys(data.errors || {}); if (failed.length) list.push(pill('Partial: ' + failed.join(', '), 'warn'));
    } else {
      if (data.inspection && data.inspection.echAvailable) list.push(pill('ECH', 'good'));
      if (data.resolver) list.push(pill(data.resolver));
    }
    e.badges.innerHTML = list.join('');
  }

  async function run() {
    if (state.busy) return;
    const name = e.name.value.trim(); if (!name) { error('Enter a DNS name.'); return; }
    error(''); busy(true); e.rawArea.innerHTML = '';
    e.echArea.innerHTML = '<div class="echHeader"><div><h2>ECH inspector</h2><div class="sub">Waiting for HTTPS/SVCB data.</div></div>' + pill('Querying', 'warn') + '</div>';
    try {
      const url = state.mode === 'profile' ? '/api/profile?name=' + encodeURIComponent(name) + '&dnssec=1' : '/api/resolve?name=' + encodeURIComponent(name) + '&type=' + encodeURIComponent(e.type.value) + '&dnssec=1';
      const r = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
      let d; try { d = await r.json(); } catch { throw new Error('Invalid response from Worker'); }
      if (!r.ok) throw new Error(d.detail || d.error || ('HTTP ' + r.status));
      const records = recordsFrom(d); renderStats(d, records); renderBadges(d); renderProfile(d); renderAnswers(records); renderEch(inspectionFrom(d));
      e.rawArea.innerHTML = '<details class="raw"><summary>Normalized response</summary><pre>' + esc(JSON.stringify(d, null, 2)) + '</pre></details>';
      e.meta.textContent = state.mode === 'profile' ? name + ' · A + AAAA + HTTPS · ' + (d.elapsedMs == null ? 'done' : d.elapsedMs + ' ms') : (d.query ? d.query.name + ' · ' + d.query.type : name);
    } catch (ex) { error(ex.message || 'Inspection failed'); e.meta.textContent = 'Inspection failed.'; e.badges.innerHTML = pill('Error', 'warn'); }
    finally { busy(false); }
  }

  e.go.addEventListener('click', run);
  e.name.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') run(); });
  e.profileMode.addEventListener('click', () => setMode('profile'));
  e.recordMode.addEventListener('click', () => setMode('record'));
  document.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => { if (chip.dataset.name) e.name.value = chip.dataset.name; if (chip.dataset.type) e.type.value = chip.dataset.type; if (chip.dataset.mode) setMode(chip.dataset.mode); run(); }));
  document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', () => { const target = $(button.dataset.copy); if (target) copyText(target.textContent, button); }));

  setMode('profile'); health(); run();
}
