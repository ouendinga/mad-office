#!/usr/bin/env node
// Órdenes de mantenimiento dentro del contenedor.
//   node src/cli.js clave   ← lee UNA línea de la entrada estándar y guarda su hash como
//                             contraseña de la puerta. No la imprime nunca.

const { makePool, migrate } = require('./db');
const gate = require('./gate');

async function readLine() {
  let data = '';
  for await (const chunk of process.stdin) {
    data += chunk;
    if (data.includes('\n')) break;
  }
  return data.split('\n')[0].replace(/\r$/, '');
}

async function main() {
  const cmd = process.argv[2];
  if (cmd !== 'clave') {
    console.error('Uso: node src/cli.js clave  (la contraseña por la entrada estándar)');
    process.exit(2);
  }
  const password = await readLine();
  if (password.length < 8) {
    console.error('Contraseña demasiado corta.');
    process.exit(1);
  }
  const pool = makePool();
  await migrate(pool);
  await gate.setPassword(pool, password);
  await pool.end();
  console.error('Contraseña de la puerta guardada (solo el hash).');
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
