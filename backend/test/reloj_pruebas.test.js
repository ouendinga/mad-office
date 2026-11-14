const test = require('node:test');
const assert = require('node:assert');
const { makeClock, shiftedClock, madridMs, parts } = require('../src/world/clock');

test('madridMs: hora de Madrid en invierno y en verano', () => {
  assert.strictEqual(parts(madridMs('2026-11-14', '09:00')).hhmm, '09:00');
  assert.strictEqual(new Date(madridMs('2026-11-14', '09:00')).toISOString(), '2026-11-14T08:00:00.000Z');
  assert.strictEqual(new Date(madridMs('2026-07-01', '09:00')).toISOString(), '2026-07-01T07:00:00.000Z');
});

test('shiftedClock: sin reloj, el común; con reloj, parte de la hora fijada y corre a su velocidad', () => {
  let t = 1_000_000;
  const base = makeClock({ now: () => t });
  assert.strictEqual(shiftedClock(base, null), base);
  const target = madridMs('2026-11-16', '09:00');
  const c = shiftedClock(base, { realAt: base.nowMs(), officeAt: target, speed: 10 });
  assert.strictEqual(c.nowMs(), target);
  t += 60_000; // un minuto real
  assert.strictEqual(c.nowMs(), target + 600_000); // diez de oficina
  assert.strictEqual(c.realMs(600_000), 60_000);
  assert.ok(c.shifted);
});
