// KangarooTwelve and identity decoding, taken from dkat's bpp9kviewer (github.com/krypdkat/bpp9kviewer, used with his permission).
// Used by /check to verify the 4-letter checksum at the end of a Qubic address.
(function(){
const RC = (() => { // round constants for rounds 12..23 as [lo, hi]
  const all = ['0000000000000001','0000000000008082','800000000000808A','8000000080008000','000000000000808B','0000000080000001',
    '8000000080008081','8000000000008009','000000000000008A','0000000000000088','0000000080008009','000000008000000A',
    '000000008000808B','800000000000008B','8000000000008089','8000000000008003','8000000000008002','8000000000000080',
    '000000000000800A','800000008000000A','8000000080008081','8000000000008080','0000000080000001','8000000080008008'];
  return all.slice(12).map(h => [parseInt(h.slice(8), 16) >>> 0, parseInt(h.slice(0, 8), 16) >>> 0]);
})();
const RHO = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
const PI = (() => { const p = new Array(25); for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) p[x + 5 * y] = y + 5 * ((2 * x + 3 * y) % 5); return p; })();
const BC = new Uint32Array(10), B = new Uint32Array(50);
// s: Uint32Array(50), lane i = (s[2i] lo, s[2i+1] hi)
function keccakP12(s) {
  for (let r = 0; r < 12; r++) {
    for (let x = 0; x < 5; x++) {
      BC[2 * x] = s[2 * x] ^ s[2 * x + 10] ^ s[2 * x + 20] ^ s[2 * x + 30] ^ s[2 * x + 40];
      BC[2 * x + 1] = s[2 * x + 1] ^ s[2 * x + 11] ^ s[2 * x + 21] ^ s[2 * x + 31] ^ s[2 * x + 41];
    }
    for (let x = 0; x < 5; x++) {
      const a = (x + 4) % 5, b = (x + 1) % 5;
      const lo = BC[2 * b], hi = BC[2 * b + 1];
      const dlo = BC[2 * a] ^ ((lo << 1) | (hi >>> 31)), dhi = BC[2 * a + 1] ^ ((hi << 1) | (lo >>> 31));
      for (let y = 0; y < 25; y += 5) { s[2 * (x + y)] ^= dlo; s[2 * (x + y) + 1] ^= dhi; }
    }
    for (let i = 0; i < 25; i++) { // rho + pi into B
      const lo = s[2 * i], hi = s[2 * i + 1], n = RHO[i], d = PI[i];
      if (n === 0) { B[2 * d] = lo; B[2 * d + 1] = hi; }
      else if (n < 32) { B[2 * d] = (lo << n) | (hi >>> (32 - n)); B[2 * d + 1] = (hi << n) | (lo >>> (32 - n)); }
      else if (n === 32) { B[2 * d] = hi; B[2 * d + 1] = lo; }
      else { const m = n - 32; B[2 * d] = (hi << m) | (lo >>> (32 - m)); B[2 * d + 1] = (lo << m) | (hi >>> (32 - m)); }
    }
    for (let y = 0; y < 25; y += 5) for (let x = 0; x < 5; x++) { // chi
      const i = x + y, j = (x + 1) % 5 + y, k = (x + 2) % 5 + y;
      s[2 * i] = B[2 * i] ^ (~B[2 * j] & B[2 * k]);
      s[2 * i + 1] = B[2 * i + 1] ^ (~B[2 * j + 1] & B[2 * k + 1]);
    }
    s[0] ^= RC[r][0]; s[1] ^= RC[r][1];
  }
}

// ---------- TurboSHAKE128 / KangarooTwelve (empty customization) ----------
function turboShake(msg, domain, outLen) {
  const st = new Uint32Array(50), sb = new Uint8Array(st.buffer), RATE = 168;
  let off = 0;
  while (msg.length - off >= RATE) { for (let i = 0; i < RATE; i++) sb[i] ^= msg[off + i]; keccakP12(st); off += RATE; }
  const rem = msg.length - off;
  for (let i = 0; i < rem; i++) sb[i] ^= msg[off + i];
  sb[rem] ^= domain; sb[RATE - 1] ^= 0x80; keccakP12(st);
  const out = new Uint8Array(outLen); let o = 0;
  for (;;) { const n = Math.min(RATE, outLen - o); out.set(sb.subarray(0, n), o); o += n; if (o >= outLen) break; keccakP12(st); }
  return out;
}
function lengthEncode(x) { const b = []; while (x > 0) { b.unshift(x & 255); x = Math.floor(x / 256); } b.push(b.length); return b; }
function k12(msg, outLen = 32) {
  const S = new Uint8Array(msg.length + 1); S.set(msg); S[msg.length] = 0; // M || C(empty) || length_encode(0)
  const CH = 8192;
  if (S.length <= CH) return turboShake(S, 0x07, outLen);
  const n = Math.ceil((S.length - CH) / CH);
  const node = new Uint8Array(CH + 8 + 32 * n + lengthEncode(n).length + 2);
  node.set(S.subarray(0, CH)); node[CH] = 0x03;
  let p = CH + 8;
  for (let i = 0; i < n; i++) { node.set(turboShake(S.subarray(CH * (i + 1), Math.min(S.length, CH * (i + 2))), 0x0B, 32), p); p += 32; }
  for (const b of lengthEncode(n)) node[p++] = b;
  node[p++] = 0xFF; node[p++] = 0xFF;
  return turboShake(node, 0x06, outLen);
}

// ---------- random2 pool (score_common.h), sampled ----------
// The pool is a chain of Keccak-p12 states (200 bytes each, 512 MB total). random2 reads u64 words at
// positions that depend only on its 32-byte seed, so we list every word a replay needs, stream the
// chain once, and keep only those words.
const POOL_VEC_SIZE = (2 ** 32 + 64) / 8;
function identityToPubkey(id) {
  const b = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    let v = 0n;
    for (let j = 13; j >= 0; j--) v = v * 26n + BigInt(id.toUpperCase().charCodeAt(i * 14 + j) - 65);
    for (let k = 0; k < 8; k++) { b[i * 8 + k] = Number(v & 255n); v >>= 8n; }
  }
  return b;
}

window.qubicIdValid = function (id) {
  if (!/^[A-Z]{60}$/.test(id)) return false;
  var h = k12(identityToPubkey(id), 32), c = (h[0] | h[1] << 8 | h[2] << 16) & 0x3FFFF, s = "";
  for (var i = 0; i < 4; i++) { s += String.fromCharCode(65 + c % 26); c = Math.floor(c / 26); }
  return s === id.slice(56);
};
})();
