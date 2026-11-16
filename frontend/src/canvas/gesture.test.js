import { drawGesture } from './avatarSprites';

// Un contexto falso que apunta qué píxeles se pintan.
const fakeCtx = () => { const px = []; return { px, fillStyle: '', fillRect: (x, y) => px.push(`${x},${y}`), save() {}, restore() {}, globalAlpha: 1 }; };
const draw = (g, seed) => { const c = fakeCtx(); drawGesture(c, g, 0, 0, 2, 0, seed, '#E9AE85'); return c.px; };

test('cada gesto se dibuja, y cada uno con su estilo según la persona', () => {
  for (const g of ['estira', 'movil', 'telefono']) expect(draw(g, 1).length).toBeGreaterThan(5);
  expect(draw('estira', 3)).not.toEqual(draw('estira', 1)); // uno estira un brazo; otro, los dos
  expect(draw('movil', 1)).not.toEqual(draw('movil', 2)); // a la altura del pecho o de la cara
  expect(draw('telefono', 1)).not.toEqual(draw('telefono', 2)); // oreja derecha o izquierda
  expect(draw('nada', 1)).toEqual([]);
});
