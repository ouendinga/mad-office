// Organigrama: sembrar una empresa, colocar a cada persona en un cargo y mantener a los
// ficticios (salen cuando entra alguien de verdad en su cargo y vuelven si se va).

const { ORG, NPCS, SPARE_NAMES, genericFicha, avatar } = require('./template');

// Mesas: las del open space las reparte en orden; despacho y recepción no ocupan mesa.
async function nextDesk(db, companyId) {
  const r = await db.query(
    `SELECT g AS d FROM generate_series(0, 63) g
      WHERE g NOT IN (SELECT desk_index FROM characters WHERE company_id = $1 AND NOT retired)
      ORDER BY g LIMIT 1`, [companyId]);
  return r.rows[0] ? r.rows[0].d : 63;
}

// Siembra el organigrama de partida si la empresa no tiene ninguno. Los ficticios que ya
// existieran con el mismo nombre (la empresa 1 venía con Marisa, Paco, Lucía y Toni) se reutilizan.
async function seedCompany(db, companyId) {
  const has = await db.query('SELECT 1 FROM positions WHERE company_id = $1 LIMIT 1', [companyId]);
  if (has.rows.length) return false;
  const ids = {};
  for (const [i, p] of ORG.entries()) {
    const r = await db.query(
      `INSERT INTO positions (company_id, parent_id, title, csuite, is_unique, seats, place, sort)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [companyId, p.parent ? ids[p.parent] : null, p.title, !!p.csuite, p.unique !== false, p.seats, p.place || 'mesa', i]);
    ids[p.key] = r.rows[0].id;
  }
  for (const p of ORG) {
    for (const [name, av, ficha] of NPCS[p.key] || []) {
      const old = await db.query(
        `SELECT id FROM characters WHERE company_id = $1 AND owner_user_id IS NULL AND name = $2 AND position_id IS NULL`, [companyId, name]);
      if (old.rows.length) {
        await db.query('UPDATE characters SET position_id = $2, npc_seat = TRUE WHERE id = $1', [old.rows[0].id, ids[p.key]]);
      } else {
        await db.query(
          `INSERT INTO characters (company_id, name, desk_index, approved, npc_seat, position_id, avatar_config, ficha)
           VALUES ($1, $2, $3, TRUE, TRUE, $4, $5, $6)`,
          [companyId, name, p.place && p.place !== 'mesa' ? 40 + ORG.indexOf(p) : await nextDesk(db, companyId), ids[p.key], avatar(av), ficha]);
      }
    }
  }
  for (const id of Object.values(ids)) await rebalance(db, id);
  return true;
}

// Ficticios de un cargo: tantos activos como plazas libres (plazas − personas).
async function rebalance(db, positionId) {
  if (!positionId) return;
  const pos = (await db.query('SELECT id, company_id, seats, title FROM positions WHERE id = $1', [positionId])).rows[0];
  if (!pos) return;
  const humans = (await db.query(
    `SELECT COUNT(*)::int AS n FROM characters WHERE position_id = $1 AND owner_user_id IS NOT NULL AND approved AND NOT paused`,
    [positionId])).rows[0].n;
  const quota = Math.max(0, pos.seats - humans);
  let npcs = (await db.query(
    'SELECT id, retired FROM characters WHERE position_id = $1 AND npc_seat ORDER BY id', [positionId])).rows;
  // Si faltan ficticios (el admin ha subido las plazas), se crean con ficha genérica.
  let spare = 0;
  while (npcs.length < quota) {
    const name = SPARE_NAMES[(positionId * 7 + npcs.length + spare++) % SPARE_NAMES.length];
    const r = await db.query(
      `INSERT INTO characters (company_id, name, desk_index, approved, npc_seat, position_id, avatar_config, ficha)
       VALUES ($1, $2, $3, TRUE, TRUE, $4, $5, $6) RETURNING id, retired`,
      [pos.company_id, name, await nextDesk(db, pos.company_id), positionId,
        avatar([(positionId + npcs.length) % 4, (positionId * 3) % 8, positionId % 6, (positionId + 1) % 6, positionId % 4]),
        genericFicha(pos.title)]);
    npcs = [...npcs, r.rows[0]];
  }
  for (const [i, n] of npcs.entries()) {
    const retire = i >= quota;
    if (n.retired !== retire) await db.query('UPDATE characters SET retired = $2 WHERE id = $1', [n.id, retire]);
  }
}

// Quién ocupa un cargo único (persona de verdad), si alguien.
async function humanHolder(db, positionId, exceptCharacterId = null) {
  const r = await db.query(
    `SELECT c.id, c.name, c.owner_user_id FROM characters c
      WHERE c.position_id = $1 AND c.owner_user_id IS NOT NULL AND c.id <> COALESCE($2, -1)`, [positionId, exceptCharacterId]);
  return r.rows[0] || null;
}

// Coloca a un personaje (de una persona) en un cargo de SU empresa. Devuelve { ok } o { error, code, holder }.
async function join(db, character, positionId) {
  const pos = (await db.query('SELECT * FROM positions WHERE id = $1 AND company_id = $2', [positionId, character.company_id])).rows[0];
  if (!pos) return { error: 'Ese cargo no existe en esta empresa.', code: 'no_existe' };
  if (pos.is_unique) {
    const holder = await humanHolder(db, positionId, character.id);
    if (holder) return { error: `Ese cargo ya lo tiene ${holder.name}. Puedes pedírselo.`, code: 'ocupado', holder };
  }
  const before = character.position_id;
  await db.query('UPDATE characters SET position_id = $2 WHERE id = $1', [character.id, positionId]);
  await rebalance(db, positionId);
  if (before && before !== positionId) await rebalance(db, before);
  return { ok: true, position: pos };
}

// Intercambio de cargos (petición aceptada).
async function swap(db, a, b) {
  await db.query('UPDATE characters SET position_id = $2 WHERE id = $1', [a.id, b.position_id]);
  await db.query('UPDATE characters SET position_id = $2 WHERE id = $1', [b.id, a.position_id]);
  await rebalance(db, a.position_id);
  await rebalance(db, b.position_id);
}

module.exports = { seedCompany, rebalance, join, swap, humanHolder, nextDesk };
