const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export const DNS_TYPES = Object.freeze({
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  PTR: 12,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  SRV: 33,
  OPT: 41,
  SVCB: 64,
  HTTPS: 65,
  CAA: 257
});

const TYPE_NAMES = Object.freeze(Object.fromEntries(Object.entries(DNS_TYPES).map(([name, code]) => [String(code), name])));
const RCODE_NAMES = Object.freeze({ 0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED', 6: 'YXDOMAIN', 7: 'YXRRSET', 8: 'NXRRSET', 9: 'NOTAUTH', 10: 'NOTZONE', 16: 'BADVERS' });
const SVC_PARAM_NAMES = Object.freeze({ 0: 'mandatory', 1: 'alpn', 2: 'no-default-alpn', 3: 'port', 4: 'ipv4hint', 5: 'ech', 6: 'ipv6hint' });
const KEM_NAMES = Object.freeze({ 0x0010: 'DHKEM(P-256, HKDF-SHA256)', 0x0011: 'DHKEM(P-384, HKDF-SHA384)', 0x0012: 'DHKEM(P-521, HKDF-SHA512)', 0x0020: 'DHKEM(X25519, HKDF-SHA256)', 0x0021: 'DHKEM(X448, HKDF-SHA512)' });
const KDF_NAMES = Object.freeze({ 0x0001: 'HKDF-SHA256', 0x0002: 'HKDF-SHA384', 0x0003: 'HKDF-SHA512' });
const AEAD_NAMES = Object.freeze({ 0x0001: 'AES-128-GCM', 0x0002: 'AES-256-GCM', 0x0003: 'ChaCha20Poly1305', 0xffff: 'Export-only' });

export function typeName(code) {
  return TYPE_NAMES[String(Number(code))] || `TYPE${Number(code) || 0}`;
}

export function rcodeName(code) {
  return RCODE_NAMES[Number(code)] || `RCODE${Number(code) || 0}`;
}

export function buildDnsQuery(name, type, { id = randomId(), dnssec = true, checkingDisabled = false } = {}) {
  const typeCode = typeof type === 'number' ? type : DNS_TYPES[String(type || '').toUpperCase()];
  if (!Number.isInteger(typeCode) || typeCode < 1 || typeCode > 65535) throw new Error('Unsupported DNS type');
  const qname = encodeName(name);
  const optLength = dnssec ? 11 : 0;
  const out = new Uint8Array(12 + qname.length + 4 + optLength);
  const view = new DataView(out.buffer);
  view.setUint16(0, id & 0xffff);
  let flags = 0x0100;
  if (checkingDisabled) flags |= 0x0010;
  view.setUint16(2, flags);
  view.setUint16(4, 1);
  view.setUint16(10, dnssec ? 1 : 0);
  out.set(qname, 12);
  let p = 12 + qname.length;
  view.setUint16(p, typeCode); p += 2;
  view.setUint16(p, 1); p += 2;
  if (dnssec) {
    out[p++] = 0;
    view.setUint16(p, DNS_TYPES.OPT); p += 2;
    view.setUint16(p, 1232); p += 2;
    view.setUint32(p, 0x00008000); p += 4;
    view.setUint16(p, 0);
  }
  return out;
}

export function parseDnsMessage(input) {
  const bytes = asBytes(input);
  if (bytes.length < 12) throw new Error('DNS message is too small');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const id = view.getUint16(0);
  const rawFlags = view.getUint16(2);
  const counts = {
    question: view.getUint16(4),
    answer: view.getUint16(6),
    authority: view.getUint16(8),
    additional: view.getUint16(10)
  };
  const flags = {
    qr: Boolean(rawFlags & 0x8000),
    opcode: (rawFlags >>> 11) & 0x0f,
    aa: Boolean(rawFlags & 0x0400),
    tc: Boolean(rawFlags & 0x0200),
    rd: Boolean(rawFlags & 0x0100),
    ra: Boolean(rawFlags & 0x0080),
    ad: Boolean(rawFlags & 0x0020),
    cd: Boolean(rawFlags & 0x0010),
    rcode: rawFlags & 0x000f
  };
  let offset = 12;
  const question = [];
  for (let i = 0; i < counts.question; i++) {
    const decoded = decodeName(bytes, offset);
    offset = decoded.offset;
    need(bytes, offset, 4);
    question.push({ name: decoded.name, type: readU16(bytes, offset), typeName: typeName(readU16(bytes, offset)), class: readU16(bytes, offset + 2) });
    offset += 4;
  }
  const answer = [];
  const authority = [];
  const additional = [];
  offset = parseSection(bytes, offset, counts.answer, answer);
  offset = parseSection(bytes, offset, counts.authority, authority);
  offset = parseSection(bytes, offset, counts.additional, additional);

  let extendedRcode = flags.rcode;
  const opt = additional.find(rr => rr.type === DNS_TYPES.OPT);
  if (opt?.parsed?.extendedRcode) extendedRcode |= (opt.parsed.extendedRcode << 4);
  const ttls = [...answer, ...authority].filter(rr => rr.type !== DNS_TYPES.OPT && Number.isFinite(rr.ttl)).map(rr => rr.ttl);

  return {
    id,
    bytes: bytes.length,
    flags: { ...flags, rcode: extendedRcode, rcodeName: rcodeName(extendedRcode) },
    counts,
    question,
    answer,
    authority,
    additional,
    minTtl: ttls.length ? Math.min(...ttls) : 0
  };
}

export function validateDnsQuery(input) {
  const parsed = parseDnsMessage(input);
  if (parsed.flags.qr) throw new Error('DNS request has the response bit set');
  if (parsed.flags.opcode !== 0) throw new Error('Only standard DNS queries are supported');
  if (parsed.question.length < 1) throw new Error('DNS request has no question');
  return parsed;
}

export function validateDnsResponse(input, query) {
  const parsed = parseDnsMessage(input);
  if (!parsed.flags.qr) throw new Error('Upstream returned a DNS query instead of a response');
  if (query && parsed.id !== query.id) throw new Error('Upstream DNS transaction ID mismatch');
  if (query?.question?.length && parsed.question?.length) {
    const q = query.question[0];
    const r = parsed.question[0];
    if (normalizeName(q.name) !== normalizeName(r.name) || q.type !== r.type || q.class !== r.class) throw new Error('Upstream DNS question mismatch');
  }
  return parsed;
}

export function serviceBindingInspection(records = []) {
  const serviceBindings = records.filter(rr => rr.type === DNS_TYPES.SVCB || rr.type === DNS_TYPES.HTTPS).map(rr => ({
    name: rr.name,
    type: rr.typeName,
    ttl: rr.ttl,
    ...(rr.parsed || {})
  }));
  const echConfigs = serviceBindings.flatMap(record => record.params?.ech?.configs || []);
  return {
    serviceBindings,
    echAvailable: serviceBindings.some(record => Boolean(record.params?.ech?.base64)),
    echConfigs
  };
}

export function parseEchConfigList(input) {
  const bytes = asBytes(input);
  const result = { valid: false, totalBytes: bytes.length, declaredBytes: 0, configs: [], error: '' };
  try {
    need(bytes, 0, 2);
    const declared = readU16(bytes, 0);
    result.declaredBytes = declared;
    if (declared < 4 || declared + 2 > bytes.length) throw new Error('Invalid ECHConfigList length');
    let p = 2;
    const end = 2 + declared;
    while (p < end) {
      need(bytes, p, 4);
      const version = readU16(bytes, p); p += 2;
      const length = readU16(bytes, p); p += 2;
      need(bytes, p, length);
      const contentStart = p;
      const contentEnd = p + length;
      const config = { version, versionHex: hex16(version), length, supportedVersion: version === 0xfe0d };
      if (version === 0xfe0d) Object.assign(config, parseEchContents(bytes, contentStart, contentEnd));
      result.configs.push(config);
      p = contentEnd;
    }
    if (p !== end) throw new Error('ECHConfigList ended on a partial config');
    result.valid = result.configs.length > 0;
  } catch (error) {
    result.error = error?.message || 'Invalid ECHConfigList';
  }
  return result;
}

export function toBase64(input) {
  const bytes = asBytes(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function parseSection(bytes, offset, count, target) {
  for (let i = 0; i < count; i++) {
    const owner = decodeName(bytes, offset);
    offset = owner.offset;
    need(bytes, offset, 10);
    const type = readU16(bytes, offset);
    const klass = readU16(bytes, offset + 2);
    const ttl = readU32(bytes, offset + 4);
    const rdlength = readU16(bytes, offset + 8);
    const rdataStart = offset + 10;
    const rdataEnd = rdataStart + rdlength;
    need(bytes, rdataStart, rdlength);
    const parsed = parseRdata(bytes, type, klass, ttl, rdataStart, rdataEnd);
    target.push({ name: owner.name, type, typeName: typeName(type), class: klass, ttl, rdlength, data: parsed.text, parsed: parsed.value });
    offset = rdataEnd;
  }
  return offset;
}

function parseRdata(bytes, type, klass, ttl, start, end) {
  try {
    if (type === DNS_TYPES.A && end - start === 4) {
      const address = Array.from(bytes.subarray(start, end)).join('.');
      return out(address, { address });
    }
    if (type === DNS_TYPES.AAAA && end - start === 16) {
      const address = formatIpv6(bytes.subarray(start, end));
      return out(address, { address });
    }
    if (type === DNS_TYPES.NS || type === DNS_TYPES.CNAME || type === DNS_TYPES.PTR) {
      const name = decodeName(bytes, start).name;
      return out(name, { target: name });
    }
    if (type === DNS_TYPES.MX) {
      need(bytes, start, 2);
      const preference = readU16(bytes, start);
      const exchange = decodeName(bytes, start + 2).name;
      return out(`${preference} ${exchange}`, { preference, exchange });
    }
    if (type === DNS_TYPES.TXT) {
      const strings = [];
      let p = start;
      while (p < end) {
        const len = bytes[p++];
        if (p + len > end) throw new Error('Malformed TXT record');
        strings.push(textDecoder.decode(bytes.subarray(p, p + len)));
        p += len;
      }
      return out(strings.map(s => JSON.stringify(s)).join(' '), { strings });
    }
    if (type === DNS_TYPES.SOA) {
      let p = start;
      const mname = decodeName(bytes, p); p = mname.offset;
      const rname = decodeName(bytes, p); p = rname.offset;
      need(bytes, p, 20);
      const value = { mname: mname.name, rname: rname.name, serial: readU32(bytes, p), refresh: readU32(bytes, p + 4), retry: readU32(bytes, p + 8), expire: readU32(bytes, p + 12), minimum: readU32(bytes, p + 16) };
      return out(`${value.mname} ${value.rname} ${value.serial} ${value.refresh} ${value.retry} ${value.expire} ${value.minimum}`, value);
    }
    if (type === DNS_TYPES.SRV) {
      need(bytes, start, 6);
      const value = { priority: readU16(bytes, start), weight: readU16(bytes, start + 2), port: readU16(bytes, start + 4), target: decodeName(bytes, start + 6).name };
      return out(`${value.priority} ${value.weight} ${value.port} ${value.target}`, value);
    }
    if (type === DNS_TYPES.CAA) {
      need(bytes, start, 2);
      const flags = bytes[start];
      const tagLength = bytes[start + 1];
      if (start + 2 + tagLength > end) throw new Error('Malformed CAA record');
      const tag = textDecoder.decode(bytes.subarray(start + 2, start + 2 + tagLength));
      const value = textDecoder.decode(bytes.subarray(start + 2 + tagLength, end));
      return out(`${flags} ${tag} ${JSON.stringify(value)}`, { flags, tag, value });
    }
    if (type === DNS_TYPES.SVCB || type === DNS_TYPES.HTTPS) return parseServiceBinding(bytes, start, end);
    if (type === DNS_TYPES.OPT) {
      const extendedRcode = (ttl >>> 24) & 0xff;
      const version = (ttl >>> 16) & 0xff;
      const dnssecOk = Boolean(ttl & 0x8000);
      return out(`UDP=${klass} DO=${dnssecOk}`, { udpPayloadSize: klass, extendedRcode, version, dnssecOk });
    }
    const raw = bytes.subarray(start, end);
    return out(`base64:${toBase64(raw)}`, { base64: toBase64(raw), hex: toHex(raw) });
  } catch (error) {
    const raw = bytes.subarray(start, end);
    return out(`malformed:${toHex(raw)}`, { malformed: true, error: error?.message || 'Malformed RDATA', hex: toHex(raw) });
  }
}

function parseServiceBinding(bytes, start, end) {
  need(bytes, start, 3);
  const priority = readU16(bytes, start);
  const targetDecoded = decodeName(bytes, start + 2);
  let p = targetDecoded.offset;
  if (p > end) throw new Error('Malformed SVCB target');
  const params = {};
  const orderedKeys = [];
  let previous = -1;
  while (p < end) {
    need(bytes, p, 4);
    const key = readU16(bytes, p);
    const length = readU16(bytes, p + 2);
    p += 4;
    if (key <= previous) throw new Error('SVCB keys are not strictly increasing');
    previous = key;
    if (p + length > end) throw new Error('SVCB parameter exceeds RDATA');
    const valueBytes = bytes.subarray(p, p + length);
    const name = SVC_PARAM_NAMES[key] || `key${key}`;
    params[name] = parseSvcParam(key, valueBytes);
    orderedKeys.push({ key, name, length });
    p += length;
  }
  const textParts = [`${priority}`, targetDecoded.name || '.'];
  for (const item of orderedKeys) textParts.push(formatSvcParam(item.name, params[item.name]));
  const value = { mode: priority === 0 ? 'alias' : 'service', priority, target: targetDecoded.name || '.', params, orderedKeys };
  return out(textParts.join(' '), value);
}

function parseSvcParam(key, bytes) {
  if (key === 0) {
    if (bytes.length % 2) throw new Error('Malformed mandatory SvcParam');
    const keys = [];
    for (let p = 0; p < bytes.length; p += 2) {
      const value = readU16(bytes, p);
      keys.push(SVC_PARAM_NAMES[value] || `key${value}`);
    }
    return keys;
  }
  if (key === 1) {
    const protocols = [];
    let p = 0;
    while (p < bytes.length) {
      const len = bytes[p++];
      if (!len || p + len > bytes.length) throw new Error('Malformed ALPN SvcParam');
      protocols.push(textDecoder.decode(bytes.subarray(p, p + len)));
      p += len;
    }
    return protocols;
  }
  if (key === 2) {
    if (bytes.length !== 0) throw new Error('Malformed no-default-alpn SvcParam');
    return true;
  }
  if (key === 3) {
    if (bytes.length !== 2) throw new Error('Malformed port SvcParam');
    return readU16(bytes, 0);
  }
  if (key === 4) {
    if (!bytes.length || bytes.length % 4) throw new Error('Malformed ipv4hint SvcParam');
    const list = [];
    for (let p = 0; p < bytes.length; p += 4) list.push(Array.from(bytes.subarray(p, p + 4)).join('.'));
    return list;
  }
  if (key === 5) {
    const base64 = toBase64(bytes);
    return { base64, bytes: bytes.length, ...parseEchConfigList(bytes) };
  }
  if (key === 6) {
    if (!bytes.length || bytes.length % 16) throw new Error('Malformed ipv6hint SvcParam');
    const list = [];
    for (let p = 0; p < bytes.length; p += 16) list.push(formatIpv6(bytes.subarray(p, p + 16)));
    return list;
  }
  return { base64: toBase64(bytes), hex: toHex(bytes), bytes: bytes.length };
}

function parseEchContents(bytes, start, end) {
  let p = start;
  needRange(bytes, p, 3, end);
  const configId = bytes[p++];
  const kemId = readU16(bytes, p); p += 2;
  needRange(bytes, p, 2, end);
  const publicKeyLength = readU16(bytes, p); p += 2;
  needRange(bytes, p, publicKeyLength, end);
  const publicKey = bytes.subarray(p, p + publicKeyLength); p += publicKeyLength;
  needRange(bytes, p, 2, end);
  const suitesLength = readU16(bytes, p); p += 2;
  if (suitesLength < 4 || suitesLength % 4) throw new Error('Invalid ECH cipher suite vector');
  needRange(bytes, p, suitesLength, end);
  const cipherSuites = [];
  const suiteEnd = p + suitesLength;
  while (p < suiteEnd) {
    const kdfId = readU16(bytes, p);
    const aeadId = readU16(bytes, p + 2);
    cipherSuites.push({ kdfId, kdf: KDF_NAMES[kdfId] || hex16(kdfId), aeadId, aead: AEAD_NAMES[aeadId] || hex16(aeadId) });
    p += 4;
  }
  needRange(bytes, p, 2, end);
  const maximumNameLength = bytes[p++];
  const publicNameLength = bytes[p++];
  if (!publicNameLength) throw new Error('ECH public_name is empty');
  needRange(bytes, p, publicNameLength, end);
  const publicName = textDecoder.decode(bytes.subarray(p, p + publicNameLength)); p += publicNameLength;
  needRange(bytes, p, 2, end);
  const extensionsLength = readU16(bytes, p); p += 2;
  needRange(bytes, p, extensionsLength, end);
  const extensions = [];
  const extensionEnd = p + extensionsLength;
  while (p < extensionEnd) {
    needRange(bytes, p, 4, extensionEnd);
    const type = readU16(bytes, p); p += 2;
    const length = readU16(bytes, p); p += 2;
    needRange(bytes, p, length, extensionEnd);
    extensions.push({ type, typeHex: hex16(type), length, base64: toBase64(bytes.subarray(p, p + length)) });
    p += length;
  }
  if (p !== end) throw new Error('ECHConfig contents length mismatch');
  return {
    configId,
    kemId,
    kem: KEM_NAMES[kemId] || hex16(kemId),
    publicKeyBytes: publicKey.length,
    publicKeyBase64: toBase64(publicKey),
    cipherSuites,
    maximumNameLength,
    publicName,
    extensions
  };
}

function formatSvcParam(name, value) {
  if (value === true) return name;
  if (name === 'ech') return `ech=${JSON.stringify(value.base64 || '')}`;
  if (Array.isArray(value)) return `${name}=${JSON.stringify(value.join(','))}`;
  if (typeof value === 'object') return `${name}=${JSON.stringify(value.base64 || value.hex || '')}`;
  return `${name}=${JSON.stringify(String(value))}`;
}

function encodeName(name) {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error('Invalid DNS name');
  const labels = normalized.split('.');
  const parts = [];
  let total = 1;
  for (const label of labels) {
    const encoded = textEncoder.encode(label);
    if (!encoded.length || encoded.length > 63) throw new Error('Invalid DNS label length');
    total += 1 + encoded.length;
    if (total > 255) throw new Error('DNS name is too long');
    parts.push(encoded);
  }
  const out = new Uint8Array(total);
  let p = 0;
  for (const label of parts) {
    out[p++] = label.length;
    out.set(label, p);
    p += label.length;
  }
  out[p] = 0;
  return out;
}

function decodeName(bytes, start) {
  const labels = [];
  let p = start;
  let next = start;
  let jumped = false;
  const visited = new Set();
  for (let depth = 0; depth < 128; depth++) {
    need(bytes, p, 1);
    const length = bytes[p];
    if ((length & 0xc0) === 0xc0) {
      need(bytes, p, 2);
      const pointer = ((length & 0x3f) << 8) | bytes[p + 1];
      if (pointer >= bytes.length || visited.has(pointer)) throw new Error('Invalid DNS compression pointer');
      visited.add(pointer);
      if (!jumped) next = p + 2;
      jumped = true;
      p = pointer;
      continue;
    }
    if (length & 0xc0) throw new Error('Unsupported DNS label encoding');
    if (length === 0) {
      if (!jumped) next = p + 1;
      return { name: labels.length ? labels.join('.') : '.', offset: next };
    }
    if (length > 63) throw new Error('Invalid DNS label length');
    need(bytes, p + 1, length);
    labels.push(textDecoder.decode(bytes.subarray(p + 1, p + 1 + length)));
    p += 1 + length;
    if (!jumped) next = p;
  }
  throw new Error('DNS name compression depth exceeded');
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase().replace(/\.$/, '');
}

function formatIpv6(bytes) {
  const groups = [];
  for (let i = 0; i < 16; i += 2) groups.push(((bytes[i] << 8) | bytes[i + 1]).toString(16));
  let bestStart = -1;
  let bestLength = 0;
  for (let i = 0; i < groups.length;) {
    if (groups[i] !== '0') { i++; continue; }
    let j = i;
    while (j < groups.length && groups[j] === '0') j++;
    if (j - i > bestLength && j - i >= 2) { bestStart = i; bestLength = j - i; }
    i = j;
  }
  if (bestStart < 0) return groups.join(':');
  const left = groups.slice(0, bestStart).join(':');
  const right = groups.slice(bestStart + bestLength).join(':');
  return `${left}::${right}`.replace(/^:::/, '::').replace(/:::$/, '::');
}

function out(text, value) {
  return { text, value };
}

function asBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new Error('Expected byte array');
}

function readU16(bytes, offset) {
  need(bytes, offset, 2);
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32(bytes, offset) {
  need(bytes, offset, 4);
  return ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function need(bytes, offset, length) {
  if (offset < 0 || length < 0 || offset + length > bytes.length) throw new Error('Truncated DNS message');
}

function needRange(bytes, offset, length, end) {
  if (offset < 0 || length < 0 || offset + length > end || end > bytes.length) throw new Error('Truncated ECHConfig');
}

function randomId() {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  return (bytes[0] << 8) | bytes[1];
}

function hex16(value) {
  return `0x${Number(value).toString(16).padStart(4, '0')}`;
}

function toHex(input) {
  return Array.from(input, byte => byte.toString(16).padStart(2, '0')).join('');
}
