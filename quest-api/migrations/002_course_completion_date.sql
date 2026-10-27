-- Run before deploying the updated quest-api.
-- Saved by /api/progress on first complete submission; never changed by downloads.
ALTER TABLE users ADD COLUMN IF NOT EXISTS course_completed_at timestamptz;
-- Historical progress has no reliable exam timestamp: do not invent one here.
-- Existing certificates retain their original date as a compatibility fallback.

-- Preserve the original date of previously issued certificates across later syncs.
UPDATE users u SET course_completed_at = c.first_issued_at
FROM (SELECT telegram_id, MIN(issued_at) AS first_issued_at FROM certificates GROUP BY telegram_id) c
WHERE u.telegram_id = c.telegram_id AND u.course_completed_at IS NULL;
