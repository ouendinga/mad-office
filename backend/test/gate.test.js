const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'x'.repeat(40);
const gate = require('../src/gate');

test('puerta: el hash verifica la buena y rechaza la mala', () => {
  const h = gate.hashPassword('correcto-caballo-pila');
  assert.ok(h.startsWith('scrypt$'));
  assert.ok(!h.includes('correcto'));
  assert.equal(gate.verifyPassword('correcto-caballo-pila', h), true);
  assert.equal(gate.verifyPassword('otra', h), false);
  assert.equal(gate.verifyPassword('x', 'basura'), false);
});

test('puerta: lee la cookie entre otras', () => {
  assert.equal(gate.readCookie('a=1; mo_gate=abc%3D; b=2', 'mo_gate'), 'abc=');
  assert.equal(gate.readCookie('', 'mo_gate'), null);
});

test('puerta: sin GATE=on no estorba', () => {
  assert.equal(gate.ENABLED, false);
  assert.equal(gate.cookieOk(''), true);
});
