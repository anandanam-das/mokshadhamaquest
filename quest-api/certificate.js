const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const QRCode = require('qrcode');

// Standard-14 PDF fonts have no Cyrillic glyphs, so names/text here need a
// real embedded font — Roboto ships with full Cyrillic coverage and is
// small enough to bundle directly.
const regularFontBytes = fs.readFileSync(path.join(__dirname, 'fonts/Roboto-Regular.ttf'));
const boldFontBytes = fs.readFileSync(path.join(__dirname, 'fonts/Roboto-Bold.ttf'));

const VERIFY_BASE_URL = process.env.VERIFY_BASE_URL || 'https://www.moksha-education.com/quest/verify.html';

function centeredX(font, text, size, pageWidth) {
  return pageWidth / 2 - font.widthOfTextAtSize(text, size) / 2;
}

async function generateCertificatePdf({ id, firstName, lastName, issuedAt }) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const regularFont = await pdfDoc.embedFont(regularFontBytes);
  const boldFont = await pdfDoc.embedFont(boldFontBytes);

  const page = pdfDoc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();

  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderColor: rgb(0.976, 0.682, 0.220),
    borderWidth: 3,
  });
  page.drawRectangle({
    x: 32,
    y: 32,
    width: width - 64,
    height: height - 64,
    borderColor: rgb(0.976, 0.682, 0.220),
    borderWidth: 1,
  });

  const titleSize = 28;
  page.drawText('MOKSHA QUEST', {
    x: centeredX(boldFont, 'MOKSHA QUEST', titleSize, width),
    y: height - 110,
    size: titleSize,
    font: boldFont,
    color: rgb(0.10, 0.13, 0.19),
  });

  const subtitle = 'Сертификат о прохождении курса «Обитель богов»';
  page.drawText(subtitle, {
    x: centeredX(regularFont, subtitle, 15, width),
    y: height - 145,
    size: 15,
    font: regularFont,
    color: rgb(0.40, 0.44, 0.54),
  });

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Участник курса';
  const nameSize = 32;
  page.drawText(fullName, {
    x: centeredX(boldFont, fullName, nameSize, width),
    y: height / 2 + 10,
    size: nameSize,
    font: boldFont,
    color: rgb(0.10, 0.13, 0.19),
  });

  const dateStr = new Date(issuedAt).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
  const dateLine = `успешно завершил(а) курс — ${dateStr}`;
  page.drawText(dateLine, {
    x: centeredX(regularFont, dateLine, 14, width),
    y: height / 2 - 26,
    size: 14,
    font: regularFont,
    color: rgb(0.40, 0.44, 0.54),
  });

  const verifyUrl = `${VERIFY_BASE_URL}?id=${id}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 220 });
  const qrImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
  const qrImage = await pdfDoc.embedPng(qrImageBytes);
  const qrSize = 100;
  page.drawImage(qrImage, { x: width - 70 - qrSize, y: 55, width: qrSize, height: qrSize });

  page.drawText('Проверить подлинность', {
    x: width - 70 - qrSize,
    y: 42,
    size: 9,
    font: regularFont,
    color: rgb(0.40, 0.44, 0.54),
  });

  page.drawText(`ID сертификата: ${id}`, {
    x: 40,
    y: 42,
    size: 9,
    font: regularFont,
    color: rgb(0.55, 0.58, 0.66),
  });

  return pdfDoc.save();
}

module.exports = { generateCertificatePdf };
