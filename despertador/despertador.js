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
    hora: turn.prompt.includes('14:00') ? `${14 + i}:${i ? '15' : '00'}` : h,
    lugar: ['mesa', 'cafe', 'reuniones', 'mesa'][i],
    con: '',
    que: ['Revisa el correo con cara de póker', 'Café y cotilleo', 'Reunión sin orden del día', 'Teclea fuerte para parecer ocupado'][i],
    frase: ['Buenos días, ¿no?', '¿Os habéis enterado?', 'Esto podría ser un correo.', ''][i],
  }));
  const by = {
    despertar: { sueno: { hace_caso: true, por_que: 'Ha sido muy vívido, algo de verdad tendrá.' }, humor: 'contento', plan },
    tarde: { humor: 'normal', plan },
    diario: { diario: 'Hoy ha sido un día de oficina como otro cualquiera. Nadie me ha robado el táper, lo cual ya es mucho.', humor: 'contento' },
    perfil: { puesto: 'Desarrollador', personalidad: 'Optimista crónico con tendencia a la épica.', manias: ['Nombra las variables como sus gatos', 'Celebra cada deploy', 'Tararea mientras programa'], objetivo: 'Que su café no lo use nadie', muletillas: ['¡Al lío!', 'Eso es un bug de producto.', 'Funciona, no lo toques.', 'Café y seguimos.'] },
    sueno_ayuda: { propuestas: ['Sueñas que la impresora te pide perdón y te ofrece un trato.', 'Sueñas que Paco te cede su taza para siempre.', 'Sueñas que eres jefe y nadie convoca reuniones.'], comentario: 'Encaja con su obsesión por el café.' },
  };
  if (turn.kind === 'despertar' && !turn.schema.properties.sueno) delete by.despertar.sueno;
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
