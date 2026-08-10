# MOKSHA auth server

Verifies Telegram Login Widget sign-ins and checks whether the user is
subscribed to a closed Telegram channel/chat, using the Telegram Bot API.
This is what `src/api/auth.js` on the frontend talks to.

## 1. Create the bot

1. Message [@BotFather](https://t.me/BotFather), send `/newbot` (or reuse an
   existing bot) and copy the **bot token** it gives you
   (`123456789:AAExample...`). The number before the colon is the **bot id**.
2. Add the bot as an **admin** of the private channel/chat you want to gate
   access behind. The bot can only check membership for chats it belongs to.
3. Get the chat's numeric id (looks like `-1001234567890`):
   - Add [@RawDataBot](https://t.me/RawDataBot) (or @userinfobot) to the
     channel temporarily, or forward a message from the channel to it, and
     read the `chat.id` field it reports — then remove it again.
4. Run `/setdomain` in BotFather and point it at the exact domain that will
   serve `login.html` (the Login Widget only works over HTTPS on a domain
   registered this way — plain `http://localhost` will not trigger the
   Telegram popup, so test on a real HTTPS domain, e.g. via a tunnel like
   ngrok, before going live).

## 2. Configure the server

```
cd server
cp .env.example .env
```

Fill in `.env`:

- `TELEGRAM_BOT_TOKEN` — from step 1.
- `TELEGRAM_CHANNEL_ID` — the chat id from step 1.3.
- `SESSION_SECRET` — any long random string.
- `ALLOWED_ORIGIN` — where the frontend is served from.

## 3. Configure the frontend

Edit `src/config.js`:

- `telegramBotId` — the numeric id from step 1.
- `apiBaseUrl` — where this server is reachable (e.g. `http://localhost:3001`
  in dev, your real API domain in production).

## 4. Run it

```
cd server
npm install
npm run dev
```

The server listens on `PORT` (default `3001`) and exposes:

- `POST /api/auth/telegram` — verifies the Login Widget payload's signature,
  opens a session cookie for the user.
- `GET /api/access?telegramId=...` — looks up the user's status in the
  configured chat via `getChatMember` and reports whether they have access.
  Trusts the session cookie first; the query param is only a fallback.
- `POST /api/auth/logout` — clears the session cookie.

## How the frontend flow uses it

1. `login.html` loads Telegram's widget script and calls
   `Telegram.Login.auth({ bot_id, ... }, callback)` when the button is
   clicked — this opens Telegram's own popup, the user confirms there.
2. Telegram calls back with a signed payload (id, name, `auth_date`, `hash`,
   ...). `login.js` posts that straight to `POST /api/auth/telegram`.
3. The server recomputes the HMAC over the payload using
   `SHA256(bot_token)` as the key and compares it to the `hash` field — this
   is how we know the data really came from Telegram and wasn't forged
   client-side. It also checks `auth_date` isn't stale (>24h old is rejected).
4. `checking.html` calls `GET /api/access`, which asks Telegram whether that
   user is a `creator`/`administrator`/`member` of the configured chat. If
   not (or `left`/`kicked`), the frontend shows the "нужна подписка на
   курс" screen instead of letting them in.
