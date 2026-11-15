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

// ---- billete del panel (dashboard.alvarosolis.dev) ----
const crypto = require('crypto');
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const b64 = (x) => Buffer.from(x).toString('base64url');
function billete({ aud = 'https://mad-office.alvarosolis.dev', iat = 1794800000, vida = 60, clave = privateKey } = {}) {
  const datos = b64(JSON.stringify({ aud, iat, exp: iat + vida, jti: b64(crypto.randomBytes(16)), sub: 'panel' }));
  return `v1.${datos}.${b64(crypto.sign(null, Buffer.from(`v1.${datos}`), clave))}`;
}
const T = 1794800000;

test('billete del panel: vale una vez, solo para Mad Office y durante 60 s', () => {
  const b = billete();
  assert.equal(gate.comprobarBillete(b, T + 5, publicKey), '');
  assert.equal(gate.comprobarBillete(b, T + 6, publicKey), 'repetido');
  assert.equal(gate.comprobarBillete(billete({ aud: 'https://salidas.alvarosolis.dev' }), T, publicKey), 'destino');
  assert.equal(gate.comprobarBillete(billete(), T + 61, publicKey), 'caducado');
  assert.equal(gate.comprobarBillete(billete({ vida: 3600 }), T, publicKey), 'fechas');
});

test('billete del panel: otra clave, manipulado o basura no valen', () => {
  const otra = crypto.generateKeyPairSync('ed25519');
  assert.equal(gate.comprobarBillete(billete({ clave: otra.privateKey }), T, publicKey), 'firma');
  assert.equal(gate.comprobarBillete('v1.e30.AAAA', T, publicKey), 'firma');
  assert.equal(gate.comprobarBillete('basura', T, publicKey), 'formato');
  assert.equal(gate.comprobarBillete(billete(), T, null), 'firma'); // sin clave montada nada pasa
});
