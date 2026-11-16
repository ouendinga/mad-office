#!/usr/bin/env node
// El despertador: corre en TU ordenador, recoge los turnos de la oficina y los resuelve con
// la herramienta oficial de tu suscripción (`claude -p`). Tu sesión de Claude no sale de aquí:
// el servidor solo ve el prompt y el JSON de vuelta.
//
//   MAD_OFFICE_URL=http://localhost:8081 RUNNER_TOKEN=... node despertador/despertador.js
//   --fake   responde sin IA (para probar sin gastar)
//   --once   resuelve lo que haya y termina

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const URL = (process.env.MAD_OFFICE_URL || 'http://localhost:8081').replace(/\/$/, '');
const TOKEN = process.env.RUNNER_TOKEN;
const CLAUDE = process.env.CLAUDE_BIN || 'claude';
const FAKE = process.argv.includes('--fake');
const ONCE = process.argv.includes('--once');
const IDLE_MS = 5000;
const TIMEOUT_MS = 90 * 1000;

if (!TOKEN) {
  console.error('Falta RUNNER_TOKEN (el mismo que en el .env de la oficina).');
  process.exit(1);
}

// Carpeta vacía: que claude no cargue ningún CLAUDE.md ni ajustes de proyecto.
const CWD = fs.mkdtempSync(path.join(os.tmpdir(), 'despertador-'));

async function api(method, p, body) {
  const res = await fetch(`${URL}/api/runner${p}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-runner-token': TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data.error || ''}`.trim());
  return data;
}

function runClaude(turn) {
  const args = [
    '-p', turn.prompt,
    '--model', turn.model,
    '--output-format', 'json',
    '--system-prompt', turn.system,
    '--json-schema', JSON.stringify(turn.schema),
    '--tools', '',
    '--setting-sources', '',
    '--strict-mcp-config',
    '--no-session-persistence',
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE, args, {
      cwd: CWD,
      env: { ...process.env, MAX_THINKING_TOKENS: '0' }, // sin razonamiento: no hace falta y gasta
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', reject);
    child.on('close', code => {
      clearTimeout(timer);
      let d;
      try { d = JSON.parse(out); } catch { return reject(new Error(`claude salió con ${code}: ${(err || out).slice(0, 200)}`)); }
      if (d.is_error) return reject(new Error(`claude: ${String(d.result || d.subtype).slice(0, 200)}`));
      let output = d.structured_output;
      if (!output && typeof d.result === 'string') {
        try { output = JSON.parse(d.result.replace(/^```(json)?\s*|\s*```$/g, '')); } catch { /* sigue */ }
      }
      if (!output) return reject(new Error('claude no devolvió JSON'));
      const u = d.usage || {};
      resolve({
        output,
        cost_usd: d.total_cost_usd || 0,
        input_tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
        output_tokens: u.output_tokens || 0,
      });
    });
  });
}

// Respuestas de mentira con la forma correcta, para probar el circuito sin gastar.
function fake(turn) {
  const plan = ['09:00', '10:30', '11:30', '13:00'].map((h, i) => ({
    hora: turn.kind === 'tarde' ? `${14 + i}:${i ? '15' : '00'}` : h,
    lugar: ['mesa', 'cafe', 'reuniones', 'mesa'][i],
    con: '',
    que: ['Revisa el correo con cara de póker', 'Café y cotilleo', 'Reunión sin orden del día', 'Teclea fuerte para parecer ocupado'][i],
    frase: ['Buenos días, ¿no?', '¿Os habéis enterado?', 'Esto podría ser un correo.', ''][i],
    externo: i === 3 ? 'un cliente de Bilbao' : '',
    piensa: i === 1 ? 'Si no hay café, me vuelvo a casa' : '',
  }));
  // A veces teletrabaja (para probar el modo remoto), según el id del turno.
  const donde = turn.id % 3 === 0 ? 'casa' : 'oficina';
  const by = {
    despertar: { donde, trayecto: donde === 'oficina' ? 'El bus va tan lleno que acaba sujetando el paraguas de otro' : '', sueno: { hace_caso: true, por_que: 'Ha sido muy vívido, algo de verdad tendrá.' }, humor: 'contento', plan },
    tarde: { humor: 'normal', horas_extra: turn.id % 2 === 0, plan: turn.id % 2 === 0 ? [...plan, { hora: '19:10', lugar: 'mesa', con: '', que: 'Sigue con el marrón a deshoras', frase: '¿Quién apaga la luz?', externo: '', piensa: 'Mañana pido aumento' }] : plan },
    diario: { diario: 'Hoy ha sido un día de oficina como otro cualquiera. Nadie me ha robado el táper, lo cual ya es mucho.', humor: 'contento', trayecto: 'Se cruza con su jefe en el metro y finge leer' },
    perfil: { puesto: 'Desarrollador', personalidad: 'Optimista crónico con tendencia a la épica.', manias: ['Nombra las variables como sus gatos', 'Celebra cada deploy', 'Tararea mientras programa'], objetivo: 'Que su café no lo use nadie', muletillas: ['¡Al lío!', 'Eso es un bug de producto.', 'Funciona, no lo toques.', 'Café y seguimos.'] },
    anuncio: { titulo: 'Se busca valiente para la máquina de café', texto: 'Ofrecemos sueldo competitivo (con la competencia de la cafetera), reuniones ilimitadas y una planta que no se riega sola.', requisitos: ['Saber reiniciar el router', 'Tolerancia al Comic Sans', 'Café sin azúcar'] },
    sueno_ayuda: { propuestas: ['Sueñas que la impresora te pide perdón y te ofrece un trato.', 'Sueñas que Paco te cede su taza para siempre.', 'Sueñas que eres jefe y nadie convoca reuniones.'], comentario: 'Encaja con su obsesión por el café.' },
  };
  // A veces propone un percance pequeño (para probar la regla que decide): el café en el teclado
  // en su mesa, la nevera abierta en la cocina o, de vez en cuando, uno que la regla rechaza.
  if (turn.schema.properties.incidente && (turn.kind === 'despertar' || turn.kind === 'tarde')) {
    const tarde = turn.kind === 'tarde';
    const props = [
      { tipo: 'cafe_teclado', hora: tarde ? '17:15' : '13:00', texto: '¡Mi teclado! ¡Traed arroz!' },
      { tipo: 'nevera_abierta', hora: tarde ? '15:15' : '10:30', texto: 'Solo iba a mirar.' },
      { tipo: 'nevera_abierta', hora: tarde ? '14:00' : '09:00', texto: 'Esto no debería pasar en mi mesa.' }, // sitio que no cuadra
    ];
    const p = props[turn.id % 4];
    if (p) by[turn.kind].incidente = p;
  }
  if (turn.kind === 'despertar' && !turn.schema.properties.sueno) delete by.despertar.sueno;
  if (turn.schema.properties.horas_extra && turn.kind === 'despertar') Object.assign(by.despertar, by.tarde, { donde: by.despertar.donde, trayecto: by.despertar.trayecto });
  return { output: by[turn.kind], cost_usd: 0, input_tokens: 0, output_tokens: 0 };
}

async function loop() {
  console.log(`Despertador ${FAKE ? '(modo prueba, sin IA) ' : ''}→ ${URL}`);
  for (;;) {
    let turn;
    try {
      turn = await api('POST', '/claim');
    } catch (e) {
      console.error(`No llego a la oficina: ${e.message}`);
      if (ONCE) process.exit(1);
      await new Promise(r => setTimeout(r, IDLE_MS * 2));
      continue;
    }
    if (!turn) {
      if (ONCE) return;
      await new Promise(r => setTimeout(r, IDLE_MS));
      continue;
    }
    const t0 = Date.now();
    try {
      const res = FAKE ? fake(turn) : await runClaude(turn);
      await api('POST', `/turns/${turn.id}`, { ok: true, ...res });
      console.log(`✓ #${turn.id} ${turn.kind} (${turn.model}) ${((Date.now() - t0) / 1000).toFixed(1)}s ${res.cost_usd.toFixed(4)} $`);
    } catch (e) {
      console.error(`✗ #${turn.id} ${turn.kind}: ${e.message}`);
      await api('POST', `/turns/${turn.id}`, { ok: false, error: e.message }).catch(() => {});
    }
  }
}

loop();
