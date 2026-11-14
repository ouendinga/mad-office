// Lo que lleva cada visitante encima de su sprite de 32x32 (x, y = esquina de arriba a la
// izquierda del sprite): el repartidor, su caja; mantenimiento, la caja de herramientas; la
// limpieza, el cubo y la fregona. Pixel art con contorno, como el resto.

const OUT = '#2A1F2D';

function box(ctx, x, y, w, h, fill, shade) {
  ctx.fillStyle = OUT;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  if (shade) {
    ctx.fillStyle = shade;
    ctx.fillRect(x, y + h - 2, w, 2);
  }
}

export function drawVisitorProps(ctx, kind, x, y) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (kind === 'repartidor') {
    // caja de cartón en brazos, con cinta y una etiqueta
    box(ctx, x + 9, y + 18, 14, 9, '#C8924E', '#9C6B36');
    ctx.fillStyle = '#E8D7A8';
    ctx.fillRect(x + 15, y + 18, 2, 9);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 10, y + 19, 4, 3);
  } else if (kind === 'mantenimiento') {
    // caja de herramientas roja en el suelo y una llave inglesa en la mano
    box(ctx, x + 22, y + 24, 9, 6, '#C0392B', '#8E2A20');
    ctx.fillStyle = OUT;
    ctx.fillRect(x + 25, y + 22, 3, 1);
    ctx.fillRect(x + 24, y + 22, 1, 2);
    ctx.fillRect(x + 28, y + 22, 1, 2);
    ctx.fillStyle = '#B8C0CC';
    ctx.fillRect(x + 4, y + 18, 2, 7);
    ctx.fillRect(x + 3, y + 17, 4, 2);
  } else if (kind === 'limpieza') {
    // cubo azul y fregona
    box(ctx, x + 1, y + 24, 7, 6, '#3A7BD5', '#2A5CA8');
    ctx.fillStyle = '#9FD1FF';
    ctx.fillRect(x + 2, y + 24, 5, 1);
    ctx.fillStyle = '#8A5A2B';
    for (let i = 0; i < 18; i++) ctx.fillRect(x + 27 - Math.floor(i / 3), y + 10 + i, 1, 1);
    ctx.fillStyle = '#D9D9E0';
    ctx.fillRect(x + 19, y + 28, 6, 2);
    ctx.fillStyle = OUT;
    ctx.fillRect(x + 19, y + 30, 6, 1);
  }
  ctx.restore();
}
