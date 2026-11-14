// Una simulación por empresa. Las arranca todas al empezar, crea la de una empresa nueva al
// vuelo y encuentra la de un personaje (para aplicar los turnos de la IA).

const { Sim } = require('./sim');
const { seedCompany } = require('../company/org');

class World {
  constructor({ pool, io, clock }) {
    this.pool = pool;
    this.io = io;
    this.clock = clock;
    this.sims = new Map();
  }

  async start() {
    const r = await this.pool.query('SELECT id FROM companies ORDER BY id');
    for (const { id } of r.rows) await this.ensure(id);
  }

  async ensure(companyId) {
    if (this.sims.has(companyId)) return this.sims.get(companyId);
    await seedCompany(this.pool, companyId);
    const sim = new Sim({ pool: this.pool, io: this.io, clock: this.clock, companyId });
    this.sims.set(companyId, sim);
    await sim.start();
    return sim;
  }

  get(companyId) {
    return this.sims.get(Number(companyId)) || null;
  }

  async forCharacter(characterId) {
    const r = await this.pool.query('SELECT company_id FROM characters WHERE id = $1', [characterId]);
    return r.rows[0] ? this.ensure(r.rows[0].company_id) : null;
  }

  // Tras cambiar ajustes de la empresa (horario, ubicación…).
  async reload(companyId) {
    const sim = this.get(companyId);
    if (sim) {
      await sim.loadCompany();
      await sim.weather.loadLocation();
      await sim.weather.refresh();
      sim.invalidate();
    }
  }
}

module.exports = { World };
