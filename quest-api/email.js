const { Resend } = require('resend');

// Same isolation principle as auth.js/db.js: this service owns its own
// secrets, separate from the main moksha payment/bot backend.
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'MOKSHA Quest <noreply@moksha-education.com>';

async function sendVerificationEmail(to, verifyUrl) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Подтверди почту — MOKSHA Quest',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1a1a2e;">MOKSHA QUEST</h2>
        <p>Подтверди свою почту, чтобы получать сертификат и уведомления в личном кабинете.</p>
        <p>
          <a href="${verifyUrl}" style="display:inline-block; padding:12px 24px; background:#f9ae38; color:#1a1a2e; text-decoration:none; border-radius:10px; font-weight:700;">
            Подтвердить почту
          </a>
        </p>
        <p style="color:#888; font-size:13px;">Если ссылка не открывается, скопируй её в браузер: ${verifyUrl}</p>
        <p style="color:#888; font-size:13px;">Ссылка действует 24 часа. Если ты не запрашивал(а) подтверждение — просто проигнорируй это письмо.</p>
      </div>
    `,
  });
}

async function sendCertificateEmail(to, pdfBytes, fileName) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Твой сертификат — MOKSHA Quest',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1a1a2e;">MOKSHA QUEST</h2>
        <p>Поздравляем с завершением курса «Обитель богов»! Сертификат — во вложении.</p>
      </div>
    `,
    attachments: [
      {
        filename: fileName,
        content: Buffer.from(pdfBytes).toString('base64'),
      },
    ],
  });
}

module.exports = { sendVerificationEmail, sendCertificateEmail };
