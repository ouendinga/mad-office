// Cola de turnos de IA. El servidor nunca llama al modelo: deja el turno aquí y un
// conector (el despertador, con la suscripción del dueño) lo recoge y devuelve el JSON.

const DAILY_CAP_USD = Number(process.env.DAILY_CAP_USD || 0.25);
const CLAIM_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_ATTEMPTS = 2;
// Los turnos que pide la persona desde la app van antes que los de la simulación.
const INTERACTIVE = ['perfil', 'sueno_ayuda'];

async function spentToday(pool, payerUserId, day) {
  const r = await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0)::float AS spent, COUNT(*) FILTER (WHERE status = 'done')::int AS calls,
            COALESCE(SUM(input_tokens + output_tokens), 0)::int AS tokens
       FROM turns WHERE payer_user_id = $1 AND office_day = $2`,
    [payerUserId, day],
  );
  return r.rows[0];
}

async function enqueue(pool, { kind, characterId, payerUserId, day, block = null, model, request }) {
  if (!payerUserId) return { skipped: 'sin_pagador' };
  const { spent } = await spentToday(pool, payerUserId, day);
  if (spent >= DAILY_CAP_USD) return { skipped: 'tope' };
  try {
    const r = await pool.query(
      `INSERT INTO turns (character_id, payer_user_id, kind, office_day, block, model, request)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [characterId, payerUserId, kind, day, block, model, request],
    );
    return { id: r.rows[0].id };
  } catch (e) {
    if (e.code === '23505') return { skipped: 'duplicado' };
    throw e;
  }
}

async function claim(pool) {
  const r = await pool.query(
    `UPDATE turns SET status = 'running', claimed_at = NOW(), attempts = attempts + 1
      WHERE id = (
        SELECT id FROM turns WHERE status = 'queued'
         ORDER BY (kind = ANY($1)) DESC, id
         LIMIT 1 FOR UPDATE SKIP LOCKED)
      RETURNING id, kind, model, request`,
    [INTERACTIVE],
  );
  return r.rows[0] || null;
}

async function finish(pool, id, { status, result = null, error = null, cost = 0, inTok = 0, outTok = 0 }) {
  const r = await pool.query(
    `UPDATE turns SET status = $2, result = $3, error = $4, cost_usd = $5, input_tokens = $6,
            output_tokens = $7, finished_at = NOW()
      WHERE id = $1 AND status = 'running' RETURNING *`,
    [id, status, result, error, cost, inTok, outTok],
  );
  return r.rows[0] || null;
}

// Reintenta los turnos colgados y caduca los que ya no sirven (bloque pasado).
async function maintain(pool, { day, block }) {
  await pool.query(
    `UPDATE turns SET status = CASE WHEN attempts >= $2 THEN 'failed' ELSE 'queued' END,
            error = CASE WHEN attempts >= $2 THEN 'sin respuesta del despertador' ELSE error END
      WHERE status = 'running' AND claimed_at < NOW() - ($1 || ' milliseconds')::interval`,
    [String(CLAIM_TIMEOUT_MS), MAX_ATTEMPTS],
  );
  await pool.query(
    `UPDATE turns SET status = 'expired', finished_at = NOW()
      WHERE status = 'queued' AND kind IN ('despertar', 'tarde')
        AND (office_day < $1 OR (block = 'manana' AND $2 <> 'manana'))`,
    [day, block],
  );
  await pool.query(
    `UPDATE turns SET status = 'expired', finished_at = NOW()
      WHERE status = 'queued' AND kind = 'diario' AND office_day < $1 AND $2 <> 'noche'`,
    [day, block],
  );
}

module.exports = { DAILY_CAP_USD, INTERACTIVE, spentToday, enqueue, claim, finish, maintain };
