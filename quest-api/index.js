require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const { requireAuth } = require('./auth');
const { generateCertificatePdf } = require('./certificate');

const { PORT = 4000, ALLOWED_ORIGINS = '' } = process.env;

// Mirrors UNLOCK_ORDER / PLANET_TASK_IDS in quest/village.js — kept in
// sync manually since this service is deployed separately from the
// static quest frontend.
const REQUIRED_PLANETS = ['surya', 'chandra', 'mangala', 'budha', 'guru', 'shukra', 'shani', 'rahu', 'ketu'];
const REQUIRED_PLANET_TASK_IDS = [
  'watch_lecture',
  'engine_video',
  'engine_phrase',
  'engine_audio',
  'engine_error',
  'engine_image',
  'engine_map',
];

function isCourseComplete(taskProgress) {
  return REQUIRED_PLANETS.every((planetId) => {
    const progress = taskProgress[planetId] || {};
    return REQUIRED_PLANET_TASK_IDS.every((taskId) => progress[taskId]);
  });
}

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: ALLOWED_ORIGINS.split(',').filter(Boolean),
    credentials: false,
  })
);

// Wraps an async route handler so a rejected promise reaches Express's
// error handling instead of crashing the whole process (Node kills the
// process on an unhandled rejection, which took the API down under the
// restart:unless-stopped loop the first time this was tested).
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

app.get('/health', (req, res) => res.json({ ok: true }));

app.get(
  '/api/profile',
  requireAuth,
  ah(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [req.telegramId]);
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  })
);

app.post(
  '/api/profile',
  requireAuth,
  ah(async (req, res) => {
    // Partial update: a field omitted from the body (e.g. the cabinet only
    // sending patronPlanet when switching character) keeps its existing
    // value instead of being wiped to null.
    const { email, firstName, lastName, patronPlanet } = req.body || {};
    const { rows } = await pool.query(
      `INSERT INTO users (telegram_id, email, first_name, last_name, patron_planet)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (telegram_id) DO UPDATE SET
         email = COALESCE(EXCLUDED.email, users.email),
         first_name = COALESCE(EXCLUDED.first_name, users.first_name),
         last_name = COALESCE(EXCLUDED.last_name, users.last_name),
         patron_planet = COALESCE(EXCLUDED.patron_planet, users.patron_planet),
         updated_at = now()
       RETURNING *`,
      [req.telegramId, email || null, firstName || null, lastName || null, patronPlanet || null]
    );
    res.json(rows[0]);
  })
);

app.post(
  '/api/progress',
  requireAuth,
  ah(async (req, res) => {
    const { taskProgress, stepProgress } = req.body || {};
    const { rows } = await pool.query(
      `INSERT INTO users (telegram_id, task_progress, step_progress)
       VALUES ($1, $2, $3)
       ON CONFLICT (telegram_id) DO UPDATE SET
         task_progress = EXCLUDED.task_progress,
         step_progress = EXCLUDED.step_progress,
         updated_at = now()
       RETURNING telegram_id, task_progress, step_progress, updated_at`,
      [req.telegramId, JSON.stringify(taskProgress || {}), JSON.stringify(stepProgress || {})]
    );
    res.json(rows[0]);
  })
);

app.post(
  '/api/certificate',
  requireAuth,
  ah(async (req, res) => {
    const { rows: userRows } = await pool.query('SELECT task_progress FROM users WHERE telegram_id = $1', [
      req.telegramId,
    ]);
    if (!userRows.length) return res.status(404).json({ error: 'profile_not_found' });
    if (!isCourseComplete(userRows[0].task_progress || {})) {
      return res.status(409).json({ error: 'course_not_complete' });
    }

    const { rows: existing } = await pool.query(
      'SELECT id, issued_at FROM certificates WHERE telegram_id = $1 ORDER BY issued_at ASC LIMIT 1',
      [req.telegramId]
    );
    if (existing.length) return res.json(existing[0]);

    const { rows } = await pool.query(
      'INSERT INTO certificates (telegram_id) VALUES ($1) RETURNING id, issued_at',
      [req.telegramId]
    );
    res.json(rows[0]);
  })
);

// Public — no auth. Powers the QR-code verification page.
app.get(
  '/api/certificate/:id',
  ah(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT c.id, c.issued_at, u.first_name, u.last_name
       FROM certificates c JOIN users u ON u.telegram_id = c.telegram_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  })
);

// Public — no auth. The actual downloadable PDF, with an embedded QR
// pointing back at the verify page above.
app.get(
  '/api/certificate/:id/pdf',
  ah(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT c.id, c.issued_at, u.first_name, u.last_name
       FROM certificates c JOIN users u ON u.telegram_id = c.telegram_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });

    const cert = rows[0];
    const pdfBytes = await generateCertificatePdf({
      id: cert.id,
      firstName: cert.first_name,
      lastName: cert.last_name,
      issuedAt: cert.issued_at,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="moksha-quest-certificate-${cert.id}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  })
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  console.log(`quest-api listening on :${PORT}`);
});
