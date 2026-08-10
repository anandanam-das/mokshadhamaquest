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

async function sendMessage(botToken, chatId, text, replyMarkup) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || 'Telegram sendMessage request failed');
  }
  return data.result;
}

module.exports = { getChatMemberStatus, isActiveMember, sendMessage };
