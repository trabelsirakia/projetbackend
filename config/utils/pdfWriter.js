/**
 * Générateur de PDF minimal (données de démonstration et tests), sans dépendance de mise en page :
 *  - textPdf(lines) : vrai PDF texte (police Helvetica, flux compressé Flate, table xref) ;
 *  - scannedPdf(lines) : PDF « scanné » : chaque page est une IMAGE JPEG du texte, sans aucun texte extractible
 *    (c'est le cas réel d'un CV numérisé, qui doit passer par l'OCR).
 * Les accents français passent par l'encodage WinAnsi.
 */
const zlib = require('zlib');

function pdfString(s) {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (ch === '(' || ch === ')' || ch === '\\') out += `\\${ch}`;
    else if (code < 128) out += ch;
    else if (ch === '’') out += '\\222';
    else if (ch === '€') out += '\\200';
    else if (ch === '·' || ch === '•') out += '\\267';
    else if (code < 256) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += '-';
  }
  return out;
}

function assemble(objects, catalogIndex) {
  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  let offset = chunks[0].length;
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(offset);
    const parts = typeof body === 'string'
      ? [Buffer.from(`${i + 1} 0 obj\n${body}\nendobj\n`, 'latin1')]
      : [Buffer.from(`${i + 1} 0 obj\n${body.dict}\nstream\n`, 'latin1'), body.data, Buffer.from('\nendstream\nendobj\n', 'latin1')];
    for (const p of parts) { chunks.push(p); offset += p.length; }
  });
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
    + `trailer\n<< /Size ${objects.length + 1} /Root ${catalogIndex} 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(chunks);
}

/** PDF texte A4 (une page tous les `linesPerPage` lignes ; lignes longues coupées à `wrap` caractères). */
function textPdf(lines, { linesPerPage = 52, wrap = 105 } = {}) {
  const wrapped = [];
  for (const line of lines) {
    if (line.length <= wrap) { wrapped.push(line); continue; }
    let rest = line;
    while (rest.length > wrap) {
      const cut = rest.lastIndexOf(' ', wrap);
      const at = cut > 20 ? cut : wrap;
      wrapped.push(rest.slice(0, at));
      rest = `  ${rest.slice(at).trim()}`;
    }
    wrapped.push(rest);
  }
  const pages = [];
  for (let i = 0; i < Math.max(1, wrapped.length); i += linesPerPage) pages.push(wrapped.slice(i, i + linesPerPage));
  const objects = [null, null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  const kids = [];
  for (const pageLines of pages) {
    const content = `BT /F1 10 Tf 14 TL 50 800 Td\n${pageLines.map((l) => `(${pdfString(l)}) Tj T*`).join('\n')}\nET`;
    const data = zlib.deflateSync(Buffer.from(content, 'latin1'));
    objects.push({ dict: `<< /Length ${data.length} /Filter /FlateDecode >>`, data });
    const stream = objects.length;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${stream} 0 R >>`);
    kids.push(objects.length);
  }
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  return assemble(objects, 1);
}

/** PDF scanné : texte dessiné dans une image JPEG (une page), aucun texte extractible. */
function scannedPdf(lines) {
  const { createCanvas } = require('@napi-rs/canvas');
  const W = 1240;
  const H = 1754; // A4 à 150 dpi
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#111111';
  ctx.font = '26px Arial, Helvetica, sans-serif';
  let y = 110;
  for (const line of lines) {
    ctx.fillText(line, 90, y);
    y += 40;
    if (y > H - 80) break;
  }
  const jpeg = canvas.toBuffer('image/jpeg', 92);
  const content = Buffer.from(`q 595 0 0 842 0 0 cm /Im1 Do Q`, 'latin1');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>',
    { dict: `<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, data: jpeg },
    { dict: `<< /Length ${content.length} >>`, data: content },
  ];
  return assemble(objects, 1);
}

// ---------- PDF protégé par mot de passe (gestionnaire de sécurité standard, révision 2, RC4 40 bits) ----------
const crypto = require('crypto');

const PAD = Buffer.from('28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A', 'hex');
const padded = (pwd) => Buffer.concat([Buffer.from(pwd, 'latin1'), PAD]).subarray(0, 32);
const md5 = (...parts) => crypto.createHash('md5').update(Buffer.concat(parts)).digest();

function rc4(key, data) {
  const s = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i += 1) {
    j = (j + s[i] + key[i % key.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = Buffer.alloc(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n += 1) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
    out[n] = data[n] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

/** Vrai PDF chiffré : impossible à ouvrir sans le mot de passe (cas réel d'un CV « protégé »). */
function protectedPdf(lines, userPassword = 'secret') {
  const ownerKey = md5(padded(`${userPassword}-owner`)).subarray(0, 5);
  const O = rc4(ownerKey, padded(userPassword));
  const P = -44;
  const pBytes = Buffer.alloc(4);
  pBytes.writeInt32LE(P);
  const id = crypto.randomBytes(16);
  const key = md5(padded(userPassword), O, pBytes, id).subarray(0, 5);
  const U = rc4(key, PAD);
  const objKey = (num) => md5(key, Buffer.from([num & 255, (num >> 8) & 255, (num >> 16) & 255, 0, 0])).subarray(0, 10);

  const content = Buffer.from(`BT /F1 10 Tf 14 TL 50 800 Td\n${lines.map((l) => `(${pdfString(l)}) Tj T*`).join('\n')}\nET`, 'latin1');
  const stream = rc4(objKey(4), content);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    { dict: `<< /Length ${stream.length} >>`, data: stream },
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Filter /Standard /V 1 /R 2 /O <${O.toString('hex')}> /U <${U.toString('hex')}> /P ${P} >>`,
  ];
  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  let offset = chunks[0].length;
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(offset);
    const parts = typeof body === 'string'
      ? [Buffer.from(`${i + 1} 0 obj\n${body}\nendobj\n`, 'latin1')]
      : [Buffer.from(`${i + 1} 0 obj\n${body.dict}\nstream\n`, 'latin1'), body.data, Buffer.from('\nendstream\nendobj\n', 'latin1')];
    for (const part of parts) { chunks.push(part); offset += part.length; }
  });
  const hexId = id.toString('hex');
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
    + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 6 0 R /ID [<${hexId}> <${hexId}>] >>\nstartxref\n${offset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(chunks);
}

module.exports = { textPdf, scannedPdf, protectedPdf };
