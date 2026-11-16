// Cómo se ve comer y hablar: el estilo llega del servidor y aquí solo se elige el fotograma.
import { eatMods, EAT_RHYTHM } from './SpriteSheet';

// Los estilos que manda el servidor (backend/src/world/eating.js STYLES).
const SERVER_STYLES = ['rapido', 'bocaditos', 'taper', 'palillos', 'mancha', 'movil', 'habla', 'bocata'];

test('cada estilo del servidor tiene su ritmo, con bocado y masticado', () => {
  for (const s of SERVER_STYLES) {
    expect(EAT_RHYTHM[s]).toBeDefined();
    expect(EAT_RHYTHM[s]).toContain(1);
    expect(EAT_RHYTHM[s]).toContain(2);
  }
});

test('quien come rápido da más bocados que quien picotea', () => {
  const bites = s => EAT_RHYTHM[s].filter(f => f === 1).length / EAT_RHYTHM[s].length;
  expect(bites('rapido')).toBeGreaterThan(bites('bocaditos') * 2);
});

test('sin comer ni hablar no hay nada que dibujar', () => {
  expect(eatMods(null, 3)).toBeNull();
  expect(eatMods({ eat: null, talking: false }, 3)).toBeNull();
});

test('hablando, la boca se abre a ratos; y no se da un bocado', () => {
  let open = 0;
  for (let f = 0; f < 60; f++) {
    const m = eatMods({ eat: { style: 'rapido', food: 'pasta' }, talking: true, seed: 2 }, f);
    expect(m.frame).not.toBe(1);
    if (m.mouth === 'open') open++;
  }
  expect(open).toBeGreaterThan(10);
  expect(open).toBeLessThan(50);
});

test('dos personas con el mismo estilo no mastican a la vez', () => {
  const a = []; const b = [];
  for (let f = 0; f < 30; f++) {
    a.push(eatMods({ eat: { style: 'taper', food: 'pasta' }, seed: 1 }, f).frame);
    b.push(eatMods({ eat: { style: 'taper', food: 'pasta' }, seed: 2 }, f).frame);
  }
  expect(a.join()).not.toBe(b.join());
});

test('un estilo desconocido se dibuja como el táper (no rompe)', () => {
  expect(eatMods({ eat: { style: 'nuevo', food: 'x' }, seed: 0 }, 0).eat).toBe('nuevo');
});
