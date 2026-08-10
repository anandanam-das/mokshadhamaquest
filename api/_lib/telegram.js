const crypto = require('crypto');

// Verifies the data payload the Telegram Login Widget returns, per
// https://core.telegram.org/widgets/login#checking-authorization
function verifyTelegramAuth(data, botToken) {
  if (!data || typeof data !== 'object') return false;
  const { hash, ...fields } = data;
  if (!hash) return false;

  const checkString = Object.keys(fields)
    .filter((key) => fields[key] !== undefined && fields[key] !== null)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  const hashBuffer = Buffer.from(hash, 'hex');
  const computedBuffer = Buffer.from(computedHash, 'hex');
  if (hashBuffer.length !== computedBuffer.length) return false;
  if (!crypto.timingSafeEqual(hashBuffer, computedBuffer)) return false;

  const authDate = Number(fields.auth_date);
  const ageSeconds = Date.now() / 1000 - authDate;
  if (!Number.isFinite(authDate) || ageSeconds > 86400 || ageSeconds < 0) return false;

  return true;
}

async function getChatMemberStatus(botToken, chatId, userId) {
  const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${encodeURIComponent(userId)}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || 'Telegram getChatMember request failed');
  }
  return data.result.status;
}

function isActiveMember(status) {
  return status === 'creator' || status === 'administrator' || status === 'member';
}

module.exports = { verifyTelegramAuth, getChatMemberStatus, isActiveMember };
