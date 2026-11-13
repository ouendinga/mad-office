const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');

// DATE como texto 'YYYY-MM-DD': como objeto Date, al pasarlo a ISO se corre al día anterior.
types.setTypeParser(1082, v => v);

function makePool() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: falta DATABASE_URL.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Un corte en una conexión ociosa no debe tumbar el proceso: el pool abre otra.
  pool.on('error', e => console.error('postgres:', e.message));
  return pool;
}

// Migraciones en orden, una sola vez cada una, dentro de una transacción.
async function migrate(pool, dir = path.join(__dirname, '..', 'db', 'migrations')) {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map(r => r.name));
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log(`migración aplicada: ${f}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

module.exports = { makePool, migrate };
