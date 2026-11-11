// API del despertador. Autenticado con RUNNER_TOKEN (cabecera X-Runner-Token).
// De momento hay un único despertador (el del admin) que resuelve todos los turnos.

const crypto = require('crypto');
const express = require('express');
const turns = require('../ai/turns');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function router({ sim }) {
  const r = express.Router();
  const token = process.env.RUNNER_TOKEN;

  r.use((req, res, next) => {
    if (!token || token.length < 24) return res.status(503).json({ error: 'RUNNER_TOKEN no configurado' });
    if (!safeEqual(req.get('x-runner-token') || '', token)) return res.status(401).json({ error: 'token' });
    next();
  });

  r.post('/claim', async (req, res) => {
    const t = await turns.claim(req.app.get('db'));
    if (!t) return res.status(204).end();
    res.json({ id: t.id, kind: t.kind, model: t.model, ...t.request });
  });

  r.post('/turns/:id', async (req, res) => {
    const pool = req.app.get('db');
    const b = req.body || {};
    const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const usage = { cost: num(b.cost_usd), inTok: Math.round(num(b.input_tokens)), outTok: Math.round(num(b.output_tokens)) };
    if (!b.ok) {
      await turns.finish(pool, req.params.id, { status: 'failed', error: String(b.error || 'error').slice(0, 300), ...usage });
      return res.json({ ok: true });
    }
    const t = await turns.finish(pool, req.params.id, { status: 'done', result: b.output, ...usage });
    if (!t) return res.status(409).json({ error: 'el turno ya no está en marcha' });
    try {
      await sim.applyTurn(t);
    } catch (e) {
      // La salida no pasó el Game Master: se marca fallido y sigue el piloto automático.
      await pool.query(`UPDATE turns SET status = 'failed', error = $2 WHERE id = $1`, [t.id, `GM: ${e.message}`.slice(0, 300)]);
      return res.status(422).json({ error: e.message });
    }
    res.json({ ok: true });
  });

  return r;
}

module.exports = { router };
