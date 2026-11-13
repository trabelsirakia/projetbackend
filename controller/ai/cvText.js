/**
 * Lecture des CV PDF (pdf.js de Mozilla) : contrôle du fichier (signature %PDF, taille, pages, protection)
 * puis extraction du texte ligne par ligne (les fragments d'une même ligne sont regroupés par ordonnée).
 */
const AppError = require('../../config/utils/AppError');

const MAX_PAGES = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_CHARS = 40000;
const MIN_WORDS = 25;

const invalid = (message, code = 'CV_UNREADABLE') => new AppError(message, 422, code);

let pdfjs;
async function loadPdfjs() {
  pdfjs = pdfjs || await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

async function extractPdf(buffer) {
  if (!buffer || !buffer.length) throw invalid('Ajoutez votre CV au format PDF.', 'CV_REQUIRED');
  if (buffer.length > MAX_BYTES) throw new AppError('CV trop volumineux : 5 Mo maximum.', 413, 'PAYLOAD_TOO_LARGE');
  if (buffer.subarray(0, 1024).indexOf('%PDF-') === -1) throw invalid('Le fichier n\'est pas un PDF : exportez votre CV en PDF.', 'CV_NOT_PDF');

  const lib = await loadPdfjs();
  let doc;
  try {
    doc = await lib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  } catch (err) {
    if (err?.name === 'PasswordException') throw invalid('Ce PDF est protégé par un mot de passe : exportez une version sans protection.', 'CV_PROTECTED');
    throw invalid('Ce PDF est illisible ou endommagé : exportez-le à nouveau.');
  }
  try {
    if (doc.numPages > MAX_PAGES) throw invalid(`CV trop long (${doc.numPages} pages) : ${MAX_PAGES} pages maximum.`, 'CV_TOO_LONG');
    const lines = [];
    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const rows = new Map();
      for (const item of content.items) {
        if (!item.str) continue;
        const y = Math.round(item.transform[5]);
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push({ x: item.transform[4], s: item.str });
      }
      [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => {
        const line = items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim();
        if (line) lines.push(line);
      });
    }
    const text = lines.join('\n').slice(0, MAX_CHARS);
    if (text.split(/\s+/).filter(Boolean).length < MIN_WORDS) {
      throw invalid('Aucun texte lisible dans ce PDF (CV scanné ?) : exportez-le depuis votre traitement de texte.', 'CV_NO_TEXT');
    }
    return { text, pages: doc.numPages };
  } finally {
    doc.destroy();
  }
}

module.exports = { extractPdf, MAX_BYTES };
