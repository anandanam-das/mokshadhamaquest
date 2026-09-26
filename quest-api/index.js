require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const { requireAuth, requireAdmin } = require('./auth');
const { generateCertificatePdf } = require('./certificate');
const { sendVerificationEmail, sendCertificateEmail } = require('./email');

const { PORT = 4000, ALLOWED_ORIGINS = '' } = process.env;
const EMAIL_VERIFY_BASE_URL = process.env.EMAIL_VERIFY_BASE_URL || 'https://www.moksha-education.com/quest/verify-email.html';
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

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

// Mirrors REL_ROUNDS ids in quest/village.js — the 6 rounds of task 11
// ("Экзамен Шивы"), stored under taskProgress.relationships. Completing
// the course now requires this in addition to the 9 planets.
const REQUIRED_EXAM_ROUND_IDS = [
  'round_direction',
  'round_reason',
  'round_impact',
  'round_union',
  'round_neutral',
  'round_nodes',
];

// The "Введение" (Семя) lesson — same idea as REQUIRED_PLANET_TASK_IDS but
// for the intro block, which lives under taskProgress.intro rather than a
// planet id. Not part of isCourseComplete (that's specifically the 9
// planets), but it's still real progress and belongs in the admin stats.
const INTRO_TASK_IDS = ['watch_lecture', 'task_gunas', 'task_1', 'task_2', 'task_3', 'task_4', 'village_intro'];

function isCourseComplete(taskProgress) {
  const planetsDone = REQUIRED_PLANETS.every((planetId) => {
    const progress = taskProgress[planetId] || {};
    return REQUIRED_PLANET_TASK_IDS.every((taskId) => progress[taskId]);
  });
  const examProgress = taskProgress.relationships || {};
  const examDone = REQUIRED_EXAM_ROUND_IDS.every((roundId) => examProgress[roundId]);
  return planetsDone && examDone;
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
    // value instead of being wiped to null. hasSeenPrologue is a one-way
    // flag — only `true` is ever written, so a page that doesn't know the
    // current value can't accidentally flip it back to false.
    const { email, firstName, lastName, patronPlanet, hasSeenPrologue } = req.body || {};

    // A changed email must be re-verified — reset the flag (and drop any
    // stale pending token) whenever the incoming email differs from what's
    // on file, so a verified badge never survives switching to an address
    // nobody proved ownership of.
    let emailChanged = false;
    if (email) {
      const { rows: current } = await pool.query('SELECT email FROM users WHERE telegram_id = $1', [req.telegramId]);
      emailChanged = !current.length || current[0].email !== email;
    }

    const { rows } = await pool.query(
      `INSERT INTO users (telegram_id, email, first_name, last_name, patron_planet, has_seen_prologue)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, false))
       ON CONFLICT (telegram_id) DO UPDATE SET
         email = COALESCE(EXCLUDED.email, users.email),
         first_name = COALESCE(EXCLUDED.first_name, users.first_name),
         last_name = COALESCE(EXCLUDED.last_name, users.last_name),
         patron_planet = COALESCE(EXCLUDED.patron_planet, users.patron_planet),
         has_seen_prologue = COALESCE(EXCLUDED.has_seen_prologue, users.has_seen_prologue),
         email_verified = CASE WHEN $7 THEN false ELSE users.email_verified END,
         email_verify_token = CASE WHEN $7 THEN NULL ELSE users.email_verify_token END,
         email_verify_expires = CASE WHEN $7 THEN NULL ELSE users.email_verify_expires END,
         updated_at = now()
       RETURNING *`,
      [
        req.telegramId,
        email || null,
        firstName || null,
        lastName || null,
        patronPlanet || null,
        hasSeenPrologue === true ? true : null,
        emailChanged,
      ]
    );
    res.json(rows[0]);
  })
);

app.post(
  '/api/email/send-verification',
  requireAuth,
  ah(async (req, res) => {
    const { rows } = await pool.query('SELECT email, email_verified FROM users WHERE telegram_id = $1', [req.telegramId]);
    if (!rows.length || !rows[0].email) return res.status(400).json({ error: 'no_email' });
    if (rows[0].email_verified) return res.json({ ok: true, alreadyVerified: true });

    const token = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);
    await pool.query('UPDATE users SET email_verify_token = $2, email_verify_expires = $3 WHERE telegram_id = $1', [
      req.telegramId,
      token,
      expires,
    ]);

    const verifyUrl = `${EMAIL_VERIFY_BASE_URL}?token=${token}`;
    await sendVerificationEmail(rows[0].email, verifyUrl);
    res.json({ ok: true });
  })
);

// Public — no auth. The link inside the verification email hits this
// directly from the browser.
app.get(
  '/api/email/verify',
  ah(async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'missing_token' });

    const { rows } = await pool.query(
      'SELECT telegram_id, email_verify_expires FROM users WHERE email_verify_token = $1',
      [token]
    );
    if (!rows.length) return res.status(404).json({ error: 'invalid_token' });
    if (new Date(rows[0].email_verify_expires) < new Date()) return res.status(410).json({ error: 'token_expired' });

    await pool.query(
      `UPDATE users SET email_verified = true, email_verify_token = NULL, email_verify_expires = NULL
       WHERE telegram_id = $1`,
      [rows[0].telegram_id]
    );
    res.json({ ok: true });
  })
);

app.post(
  '/api/certificate/email',
  requireAuth,
  ah(async (req, res) => {
    const { rows: userRows } = await pool.query('SELECT email, email_verified FROM users WHERE telegram_id = $1', [
      req.telegramId,
    ]);
    if (!userRows.length || !userRows[0].email) return res.status(400).json({ error: 'no_email' });
    if (!userRows[0].email_verified) return res.status(409).json({ error: 'email_not_verified' });

    const { rows: certRows } = await pool.query(
      'SELECT c.id, c.issued_at, u.first_name, u.last_name FROM certificates c JOIN users u ON u.telegram_id = c.telegram_id WHERE c.telegram_id = $1 ORDER BY c.issued_at ASC LIMIT 1',
      [req.telegramId]
    );
    if (!certRows.length) return res.status(409).json({ error: 'no_certificate' });

    const cert = certRows[0];
    const pdfBytes = await generateCertificatePdf({
      id: cert.id,
      firstName: cert.first_name,
      lastName: cert.last_name,
      issuedAt: cert.issued_at,
    });
    await sendCertificateEmail(userRows[0].email, pdfBytes, `moksha-quest-certificate-${cert.id}.pdf`);
    res.json({ ok: true });
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

// Admin-only — server-side allowlist check (requireAdmin), independent of
// whatever the frontend decided to show. Returns every user with a
// computed progress summary rather than raw task_progress, so the admin
// page doesn't need to duplicate the planet/task list itself.
app.get(
  '/api/admin/overview',
  requireAuth,
  requireAdmin,
  ah(async (req, res) => {
    const { rows: users } = await pool.query(
      `SELECT u.telegram_id, u.email, u.first_name, u.last_name, u.patron_planet,
              u.task_progress, u.created_at, u.updated_at,
              c.id AS certificate_id, c.issued_at AS certificate_issued_at
       FROM users u
       LEFT JOIN certificates c ON c.telegram_id = u.telegram_id
       ORDER BY u.created_at DESC`
    );

    // Mirrors quest/profile.js's totalTasks/doneLessons exactly (76 tasks,
    // 11 lessons = Введение + 9 planets + Экзамен Шивы) — this used to omit
    // the exam entirely, so the admin table's "Заданий" column topped out
    // at 70/9 instead of matching what the student's own cabinet shows.
    const totalTasksPerUser =
      INTRO_TASK_IDS.length + REQUIRED_PLANETS.length * REQUIRED_PLANET_TASK_IDS.length + REQUIRED_EXAM_ROUND_IDS.length;
    const totalLessonsPerUser = REQUIRED_PLANETS.length + 2; // Введение + 9 планет + экзамен
    const summarized = users.map((u) => {
      const progress = u.task_progress || {};
      const introProgress = progress.intro || {};
      const introDoneCount = INTRO_TASK_IDS.filter((taskId) => introProgress[taskId]).length;
      const introDone = introDoneCount === INTRO_TASK_IDS.length;
      let donePlanets = 0;
      let doneTasks = introDoneCount;
      REQUIRED_PLANETS.forEach((planetId) => {
        const planetProgress = progress[planetId] || {};
        const completedCount = REQUIRED_PLANET_TASK_IDS.filter((taskId) => planetProgress[taskId]).length;
        doneTasks += completedCount;
        if (completedCount === REQUIRED_PLANET_TASK_IDS.length) donePlanets += 1;
      });
      const examProgress = progress.relationships || {};
      const examDoneCount = REQUIRED_EXAM_ROUND_IDS.filter((roundId) => examProgress[roundId]).length;
      const examDone = examDoneCount === REQUIRED_EXAM_ROUND_IDS.length;
      doneTasks += examDoneCount;
      const doneLessons = donePlanets + (introDone ? 1 : 0) + (examDone ? 1 : 0);
      return {
        telegramId: u.telegram_id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        patronPlanet: u.patron_planet,
        donePlanets,
        totalPlanets: REQUIRED_PLANETS.length,
        doneLessons,
        totalLessons: totalLessonsPerUser,
        doneTasks,
        totalTasks: totalTasksPerUser,
        hasCertificate: !!u.certificate_id,
        certificateId: u.certificate_id,
        certificateIssuedAt: u.certificate_issued_at,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      };
    });

    res.json({
      totalUsers: summarized.length,
      totalCertificates: summarized.filter((u) => u.hasCertificate).length,
      users: summarized,
    });
  })
);

app.patch(
  '/api/admin/users/:telegramId',
  requireAuth,
  requireAdmin,
  ah(async (req, res) => {
    // Same "field not sent keeps old value" convention as the self-service
    // POST /api/profile — the admin edit form always sends every field, so
    // in practice this just applies whatever's in the form.
    const { email, firstName, lastName, patronPlanet } = req.body || {};
    const { rows } = await pool.query(
      `UPDATE users SET
         email = COALESCE($2, email),
         first_name = COALESCE($3, first_name),
         last_name = COALESCE($4, last_name),
         patron_planet = COALESCE($5, patron_planet),
         updated_at = now()
       WHERE telegram_id = $1
       RETURNING *`,
      [req.params.telegramId, email ?? null, firstName ?? null, lastName ?? null, patronPlanet ?? null]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  })
);

app.delete(
  '/api/admin/users/:telegramId',
  requireAuth,
  requireAdmin,
  ah(async (req, res) => {
    await pool.query('DELETE FROM certificates WHERE telegram_id = $1', [req.params.telegramId]);
    const { rowCount } = await pool.query('DELETE FROM users WHERE telegram_id = $1', [req.params.telegramId]);
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  })
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  console.log(`quest-api listening on :${PORT}`);
});
