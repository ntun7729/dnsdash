const $ = (id) => document.getElementById(id);

const state = {
  mode: 'profile',
  busy: false,
  last: null
};

const els = {
  name: $('name'),
  type: $('type'),
  go: $('go'),
  error: $('error'),
  healthDot: $('healthDot'),
  healthText: $('healthText'),
  resolverList: $('resolverList'),
  profileMode: $('profileMode'),
  recordMode: $('recordMode'),
  resultTitle: $('resultTitle'),
  meta: $('meta'),
  badges: $('badges'),
  latency: $('latency'),
  rcode: $('rcode'),
  dnssec: $('dnssec'),
  answersCount: $('answersCount'),
  bytes: $('bytes'),
  profile: $('profile'),
  answers: $('answers'),
  answerCards: $('answerCards'),
  echArea: $('echArea'),
  rawArea: $('rawArea'),
  doh: $('doh'),
  echHelper: $('echHelper')
};

const endpoint = location.origin + '/dns-query';
els.doh.textContent = endpoint;
els.echHelper.textContent = 'cloudflare-ech.com+' + endpoint;

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function pill(value, kind = '') {
  return '<span class="pill ' + kind + '">' + esc(value) + '</span>';
}

function setError(message = '') {
  els.error.textContent = message;
  els.error.hidden = !message;
}

function setBusy(busy) {
  state.busy = busy;
  els.go.disabled = busy;
  els.go.textContent = busy ? 'Inspecting…' : 'Inspect';
}

async function copyText(text, button) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    if (button) {
      const old = button.textContent;
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = old; }, 900);
    }
  } catch {
    if (button) button.textContent = 'Copy failed';
  }
}

function setMode(mode) {
  state.mode = mode === 'record' ? 'record' : 'profile';
  els.profileMode.classList.toggle('active', state.mode === 'profile');
  els.recordMode.classList.toggle('active', state.mode === 'record');
  els.type.disabled = state.mode === 'profile';
  els.resultTitle.textContent = state.mode === 'profile' ? 'Connection profile' : 'DNS record result';
  els.meta.textContent = state.mode === 'profile'
    ? 'A + AAAA + HTTPS will be resolved together.'
    : 'One DNS record type will be resolved.';
}

async function health() {
  try {
    const response = await fetch('/health', { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    els.healthDot.classList.add('ok');
    els.healthText.textContent = 'Resolver ready';
    const upstreams = Array.isArray(data.upstreams) ? data.upstreams : [];
    els.resolverList.innerHTML = upstreams.length
      ? upstreams.map((host, index) => pill((index ? 'fallback · ' : 'primary · ') + host, index ? '' : 'good')).join('')
      : pill('No resolver', 'warn');
  } catch (error) {
    els.healthDot.classList.remove('ok');
    els.healthText.textContent = 'Health unavailable';
    els.resolverList.innerHTML = pill('Health check failed', 'warn');
  }
}

function recordDisplay(record) {
  if (record && record.parsed && typeof record.parsed === 'object') {
    const parsed = record.parsed;
    if (parsed.address) return parsed.address;
    if (parsed.target && parsed.priority != null) return parsed.priority + ' ' + parsed.target;
    if (parsed.exchange) return (parsed.preference == null ? '' : parsed.preference + ' ') + parsed.exchange;
    if (parsed.text) return Array.isArray(parsed.text) ? parsed.text.join(' · ') : parsed.text;
    if (parsed.value != null) return String(parsed.value);
    try { return JSON.stringify(parsed); } catch {}
  }
  return record && record.data ? String(record.data) : '—';
}

function flatAnswers(data) {
  if (state.mode === 'record') return Array.isArray(data.answers) ? data.answers : [];
  const out = [];
  for (const type of ['A', 'AAAA', 'HTTPS']) {
    const bucket = data.records && data.records[type];
    if (bucket && Array.isArray(bucket.answers)) out.push(...bucket.answers);
  }
  return out;
}

function renderAnswers(records) {
  if (!records.length) {
    els.answers.innerHTML = '<tr><td colspan="4" class="empty">No answer records returned.</td></tr>';
    els.answerCards.innerHTML = '<div class="emptyCard">No answer records returned.</div>';
    return;
  }

  els.answers.innerHTML = records.map((record) => '<tr>' +
    '<td>' + esc(record.name || '—') + '</td>' +
    '<td>' + pill(record.typeName || record.type || '—') + '</td>' +
    '<td>' + esc(record.ttl == null ? '—' : record.ttl + 's') + '</td>' +
    '<td class="data">' + esc(recordDisplay(record)) + '</td>' +
  '</tr>').join('');

  els.answerCards.innerHTML = records.map((record) => '<article class="answerCard">' +
    '<div class="answerTop"><strong>' + esc(record.typeName || record.type || 'DNS') + '</strong><span>' + esc(record.ttl == null ? '—' : record.ttl + 's') + '</span></div>' +
    '<div class="answerName">' + esc(record.name || '—') + '</div>' +
    '<div class="answerData">' + esc(recordDisplay(record)) + '</div>' +
  '</article>').join('');
}

function renderProfile(data) {
  if (state.mode !== 'profile') {
    els.profile.hidden = true;
    return;
  }
  els.profile.hidden = false;
  const summary = data.summary || {};
  const ipv4 = Array.isArray(summary.ipv4) ? summary.ipv4 : [];
  const ipv6 = Array.isArray(summary.ipv6) ? summary.ipv6 : [];
  const alpn = Array.isArray(summary.alpn) ? summary.alpn : [];
  els.profile.innerHTML = [
    ['IPv4', ipv4.join(', ') || '—'],
    ['IPv6', ipv6.join(', ') || '—'],
    ['ALPN', alpn.join(', ') || '—']
  ].map(([label, value]) => '<div class="profileBox"><small>' + label + '</small><div class="mono">' + esc(value) + '</div></div>').join('');
}

function extractInspection(data) {
  if (state.mode === 'record') return data.inspection || null;
  return data.records && data.records.HTTPS ? data.records.HTTPS.inspection || null : null;
}

function renderEch(inspection) {
  if (!inspection || !Array.isArray(inspection.serviceBindings) || !inspection.serviceBindings.length) {
    els.echArea.innerHTML = '<div class="echHeader"><div><h2>ECH inspector</h2><div class="sub">No HTTPS/SVCB service-binding data in this response.</div></div>' + pill('No ECH data', 'warn') + '</div>';
    return;
  }

  let html = '<div class="echHeader"><div><h2>ECH inspector</h2><div class="sub">Decoded directly from HTTPS/SVCB DNS wire data.</div></div>' +
    pill(inspection.echAvailable ? 'ECH advertised' : 'ECH not advertised', inspection.echAvailable ? 'good' : 'warn') + '</div>';

  for (const record of inspection.serviceBindings) {
    const params = record.params || {};
    html += '<div class="echGrid">' +
      '<div class="kv"><small>Mode / priority</small><div>' + esc((record.mode || 'service') + ' · ' + record.priority) + '</div></div>' +
      '<div class="kv"><small>Target</small><div class="mono">' + esc(record.target || '.') + '</div></div>' +
      '<div class="kv"><small>ALPN</small><div>' + esc(Array.isArray(params.alpn) && params.alpn.length ? params.alpn.join(', ') : '—') + '</div></div>' +
      '<div class="kv"><small>Port</small><div>' + esc(params.port || 443) + '</div></div>' +
      '<div class="kv"><small>IPv4 hints</small><div class="mono">' + esc(Array.isArray(params.ipv4hint) && params.ipv4hint.length ? params.ipv4hint.join(', ') : '—') + '</div></div>' +
      '<div class="kv"><small>IPv6 hints</small><div class="mono">' + esc(Array.isArray(params.ipv6hint) && params.ipv6hint.length ? params.ipv6hint.join(', ') : '—') + '</div></div>' +
    '</div>';

    if (params.ech && params.ech.base64) {
      html += '<div class="copyRow"><div class="code echRaw">' + esc(params.ech.base64) + '</div><button class="copy copyEch" type="button">Copy ECHConfigList</button></div>';
    }
  }

  const configs = Array.isArray(inspection.echConfigs) ? inspection.echConfigs : [];
  for (let index = 0; index < configs.length; index++) {
    const config = configs[index];
    html += '<div class="config">' +
      '<div class="configTop"><h3>ECH config ' + (index + 1) + '</h3>' + pill(config.supportedVersion ? (config.versionHex + ' · RFC 9849') : (config.versionHex || 'unknown'), config.supportedVersion ? 'good' : 'warn') + '</div>' +
      '<div class="echGrid">' +
        '<div class="kv"><small>Config ID</small><div>' + esc(config.configId == null ? '—' : config.configId) + '</div></div>' +
        '<div class="kv"><small>Public name</small><div class="mono">' + esc(config.publicName || '—') + '</div></div>' +
        '<div class="kv"><small>KEM</small><div>' + esc(config.kem || '—') + '</div></div>' +
        '<div class="kv"><small>Public key</small><div>' + esc((config.publicKeyBytes || 0) + ' bytes') + '</div></div>' +
        '<div class="kv"><small>Maximum name length</small><div>' + esc(config.maximumNameLength == null ? '—' : config.maximumNameLength) + '</div></div>' +
        '<div class="kv"><small>Extensions</small><div>' + esc(Array.isArray(config.extensions) ? config.extensions.length : 0) + '</div></div>' +
      '</div>' +
      (Array.isArray(config.cipherSuites) ? config.cipherSuites.map((suite) => '<div class="suite">' + esc(suite.kdf || 'KDF') + ' + ' + esc(suite.aead || 'AEAD') + '</div>').join('') : '') +
    '</div>';
  }

  els.echArea.innerHTML = html;
  els.echArea.querySelectorAll('.copyEch').forEach((button) => {
    button.addEventListener('click', () => copyText(button.previousElementSibling.textContent, button));
  });
}

function renderStats(data, records) {
  if (state.mode === 'record') {
    els.latency.textContent = data.elapsedMs == null ? '—' : data.elapsedMs + ' ms';
    els.rcode.textContent = data.statusName || data.status || '—';
    els.dnssec.textContent = data.dnssec && data.dnssec.authenticatedData ? 'AD' : 'No';
    els.answersCount.textContent = records.length;
    els.bytes.textContent = data.bytes && data.bytes.response != null ? data.bytes.response : '—';
    return;
  }

  const buckets = Object.values(data.records || {});
  const authenticated = buckets.length > 0 && buckets.every((item) => item && item.dnssec && item.dnssec.authenticatedData);
  const statuses = [...new Set(buckets.map((item) => item && item.statusName).filter(Boolean))];
  const totalBytes = buckets.reduce((sum, item) => sum + Number(item && item.bytes && item.bytes.response || 0), 0);
  els.latency.textContent = data.elapsedMs == null ? '—' : data.elapsedMs + ' ms';
  els.rcode.textContent = statuses.length === 1 ? statuses[0] : (statuses.length ? 'Mixed' : '—');
  els.dnssec.textContent = authenticated ? 'AD' : 'No';
  els.answersCount.textContent = records.length;
  els.bytes.textContent = totalBytes || '—';
}

function renderBadges(data) {
  const tags = [];
  if (state.mode === 'profile') {
    if (data.summary && data.summary.echAvailable) tags.push(pill('ECH', 'good'));
    const failed = Object.keys(data.errors || {});
    if (failed.length) tags.push(pill('Partial: ' + failed.join(', '), 'warn'));
  } else {
    if (data.inspection && data.inspection.echAvailable) tags.push(pill('ECH', 'good'));
    if (data.resolver) tags.push(pill(data.resolver));
  }
  els.badges.innerHTML = tags.join('');
}

function renderRaw(data) {
  els.rawArea.innerHTML = '<details class="raw"><summary>Normalized response</summary><pre>' + esc(JSON.stringify(data, null, 2)) + '</pre></details>';
}

async function run() {
  if (state.busy) return;
  const name = els.name.value.trim();
  if (!name) {
    setError('Enter a DNS name.');
    return;
  }

  setError('');
  setBusy(true);
  els.echArea.innerHTML = '<div class="echHeader"><div><h2>ECH inspector</h2><div class="sub">Waiting for HTTPS/SVCB data.</div></div>' + pill('Querying', 'warn') + '</div>';
  els.rawArea.innerHTML = '';

  try {
    const path = state.mode === 'profile'
      ? '/api/profile?name=' + encodeURIComponent(name) + '&dnssec=1'
      : '/api/resolve?name=' + encodeURIComponent(name) + '&type=' + encodeURIComponent(els.type.value) + '&dnssec=1';
    const response = await fetch(path, { cache: 'no-store', headers: { Accept: 'application/json' } });
    let data;
    try { data = await response.json(); } catch { throw new Error('Invalid response from Worker'); }
    if (!response.ok) throw new Error(data.detail || data.error || ('HTTP ' + response.status));

    state.last = data;
    const records = flatAnswers(data);
    renderStats(data, records);
    renderBadges(data);
    renderProfile(data);
    renderAnswers(records);
    renderEch(extractInspection(data));
    renderRaw(data);

    els.meta.textContent = state.mode === 'profile'
      ? name + ' · A + AAAA + HTTPS · ' + (data.elapsedMs == null ? 'done' : data.elapsedMs + ' ms')
      : (data.query ? data.query.name + ' · ' + data.query.type : name);
  } catch (error) {
    setError(error.message || 'Inspection failed');
    els.meta.textContent = 'Inspection failed.';
    els.badges.innerHTML = pill('Error', 'warn');
  } finally {
    setBusy(false);
  }
}

els.go.addEventListener('click', run);
els.name.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') run();
});
els.profileMode.addEventListener('click', () => setMode('profile'));
els.recordMode.addEventListener('click', () => setMode('record'));

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    if (chip.dataset.name) els.name.value = chip.dataset.name;
    if (chip.dataset.type) els.type.value = chip.dataset.type;
    if (chip.dataset.mode) setMode(chip.dataset.mode);
    run();
  });
});

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = $(button.dataset.copy);
    if (target) copyText(target.textContent, button);
  });
});

setMode('profile');
health();
run();
