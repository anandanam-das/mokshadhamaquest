const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const QRCode = require('qrcode');

const regularFontBytes = fs.readFileSync(path.join(__dirname, 'fonts/Tinos-Regular.ttf'));
const italicFontBytes = fs.readFileSync(path.join(__dirname, 'fonts/Tinos-Italic.ttf'));
const backgroundBytes = fs.readFileSync(path.join(__dirname, 'assets/certificate-celestial.png'));
const VERIFY_BASE_URL = process.env.VERIFY_BASE_URL || 'https://www.moksha-education.com/quest/verify.html';

function wrapText(text, font, size, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.replace(/MOKSHA EDUCATION/g, 'MOKSHA\u00a0EDUCATION').split(/[ \t\r\n]+/)) {
    const next = line ? line + ' ' + word : word;
    if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function generateCertificatePdf({ id, firstName, lastName, completedAt, issuedAt }) {
  // issuedAt is a stable fallback for certificates created before completion tracking.
  const completionDate = new Date(completedAt || issuedAt);
  if (!Number.isFinite(completionDate.getTime())) throw new Error('certificate_completion_date_required');
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle('MOKSHA EDUCATION — Граха-таттва');
  pdfDoc.setAuthor('MOKSHA EDUCATION');
  const regular = await pdfDoc.embedFont(regularFontBytes, { subset: true });
  const italic = await pdfDoc.embedFont(italicFontBytes, { subset: true });
  const page = pdfDoc.addPage([842, 595]);
  const background = await pdfDoc.embedPng(backgroundBytes);
  page.drawImage(background, { x: 0, y: 0, width: 842, height: 595 });
  const ink = rgb(0.055, 0.17, 0.23);
  const center = 282;
  function centered(text, y, size, font = regular, maxWidth = 450) {
    while (font.widthOfTextAtSize(text, size) > maxWidth && size > 10) size -= 0.5;
    page.drawText(text, { x: center - font.widthOfTextAtSize(text, size) / 2, y, size, font, color: ink });
  }
  centered('M O K S H A  E D U C A T I O N', 501, 16);
  centered('Сертификат', 415, 60);
  centered('Настоящим подтверждается, что', 360, 17);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || 'Участник курса';
  // Long names wrap rather than intruding into the engraved sphere.
  let nameSize = 47;
  while (italic.widthOfTextAtSize(fullName, nameSize) > 400 && nameSize > 28) nameSize -= 0.5;
  const nameLines = wrapText(fullName, italic, nameSize, 400);
  nameLines.forEach((line, i) => centered(line, nameLines.length > 1 ? 323 - i * 33 : 300, nameSize, italic, 400));
  page.drawLine({ start: { x: 92, y: 271 }, end: { x: 476, y: 271 }, thickness: 0.65, color: rgb(0.69, 0.52, 0.27) });
  const body = 'успешно завершил первый блок обучения «Граха-таттва — природа планет», прослушал 11 лекций и сдал все экзамены на образовательной платформе MOKSHA EDUCATION. Присвоен статус «Граха-таттва-гья» — познавший природу планет.';
  const bodyLines = wrapText(body, regular, 16.5, 438);
  bodyLines.forEach((line, i) => centered(line, 233 - i * 22.5, 16.5, regular, 438));

  const dateStr = completionDate.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tbilisi' });
  page.drawText('Дата завершения: ' + dateStr, { x: 36, y: 40, size: 11.5, font: regular, color: ink });
  const number = '№ ' + id;
  let numberSize = 10;
  while (regular.widthOfTextAtSize(number, numberSize) > 182 && numberSize > 6) numberSize -= 0.25;
  page.drawText(number, { x: 300, y: 40, size: numberSize, font: regular, color: ink });

  const verifyUrl = VERIFY_BASE_URL + '?id=' + encodeURIComponent(id);
  const qrBytes = await QRCode.toBuffer(verifyUrl, { type: 'png', margin: 4, width: 600, errorCorrectionLevel: 'M', color: { dark: '#0e2b3b', light: '#ffffff' } });
  const qrImage = await pdfDoc.embedPng(qrBytes);
  // Larger than the approved draft, with the full quiet zone for reliable scanning.
  const qrSize = 76;
  page.drawImage(qrImage, { x: 496, y: 62, width: qrSize, height: qrSize });
  page.drawText('Проверить', { x: 508, y: 51, size: 10.5, font: regular, color: ink });
  page.drawText('подлинность', { x: 501, y: 39, size: 10.5, font: regular, color: ink });
  // Make the verification link usable directly in the PDF as well.
  const { PDFName, PDFString } = require('pdf-lib');
  const link = pdfDoc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [496, 39, 572, 138], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(verifyUrl) } });
  page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([pdfDoc.context.register(link)]));
  return pdfDoc.save();
}
module.exports = { generateCertificatePdf };
