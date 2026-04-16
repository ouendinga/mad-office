/**
 * TileSet — genera y cachea tiles procedurales en offscreen canvases.
 * Cada tile es TILE_SIZE x TILE_SIZE pixeles.
 * Cuando haya assets PNG reales, solo hay que reemplazar generateTile().
 */

export const TILE_SIZE = 32;

// IDs de tile
export const T = {
  EMPTY: 0,
  FLOOR_WOOD_1: 1,
  FLOOR_WOOD_2: 2,
  FLOOR_TILE_1: 3,
  FLOOR_TILE_2: 4,
  WALL_TOP: 5,
  WALL_SIDE: 6,
  WALL_CORNER_TL: 7,
  WALL_CORNER_TR: 8,
  WALL_BOTTOM: 9,
  DESK_TOP_L: 10,
  DESK_TOP_R: 11,
  DESK_FRONT_L: 12,
  DESK_FRONT_R: 13,
  CHAIR: 14,
  MONITOR: 15,
  PLANT_POT: 16,
  PLANT_LEAVES: 17,
  SOFA_L: 18,
  SOFA_M: 19,
  SOFA_R: 20,
  TABLE_SMALL: 21,
  BOOKSHELF_L: 22,
  BOOKSHELF_R: 23,
  WHITEBOARD_L: 24,
  WHITEBOARD_R: 25,
  COFFEE_MACHINE: 26,
  FLOOR_MEETING: 27,
  FLOOR_BREAK: 28,
  WINDOW: 29,
  RUG_TL: 30,
  RUG_TR: 31,
  RUG_BL: 32,
  RUG_BR: 33,
  MEETING_TABLE_L: 34,
  MEETING_TABLE_R: 35,
  MEETING_CHAIR_T: 36,
  MEETING_CHAIR_B: 37,
  SINK: 38,
  TOILET: 39,
  MIRROR: 40,
  FLOOR_BATH: 41,
  DOOR: 42,
};

const tileCache = new Map();

/** Obtener (o generar y cachear) un tile como offscreen canvas */
export function getTile(id) {
  if (tileCache.has(id)) return tileCache.get(id);
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  generateTile(ctx, id);
  tileCache.set(id, canvas);
  return canvas;
}

/** Limpiar cache (por si se cambia de skin/tileset) */
export function clearTileCache() {
  tileCache.clear();
}

// --- Helpers de dibujo ---

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// --- Generadores procedurales por tipo ---

function generateTile(ctx, id) {
  const S = TILE_SIZE;
  switch (id) {
    case T.FLOOR_WOOD_1:
      px(ctx, 0, 0, S, S, '#8B7355');
      // Vetas de madera
      for (let y = 4; y < S; y += 8) {
        line(ctx, 0, y, S, y + 1, '#7A6348');
      }
      // Variaciones de tono
      px(ctx, 0, 0, S, 2, '#917A5E');
      px(ctx, 0, 16, S, 2, '#7F6B4F');
      break;

    case T.FLOOR_WOOD_2:
      px(ctx, 0, 0, S, S, '#806A4E');
      for (let y = 6; y < S; y += 8) {
        line(ctx, 0, y, S, y + 1, '#705C42');
      }
      px(ctx, 8, 0, 2, S, '#8B7355');
      px(ctx, 24, 0, 2, S, '#8B7355');
      break;

    case T.FLOOR_TILE_1:
      px(ctx, 0, 0, S, S, '#E8DCC8');
      ctx.strokeStyle = '#D4C4A8';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
      // Textura sutil
      px(ctx, 4, 4, 2, 2, '#DED0B8');
      px(ctx, 20, 12, 2, 2, '#DED0B8');
      px(ctx, 12, 24, 2, 2, '#DED0B8');
      break;

    case T.FLOOR_TILE_2:
      px(ctx, 0, 0, S, S, '#DBCFB7');
      ctx.strokeStyle = '#C8BAA0';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
      px(ctx, 10, 8, 2, 2, '#D0C2A8');
      px(ctx, 22, 20, 2, 2, '#D0C2A8');
      break;

    case T.FLOOR_MEETING:
      px(ctx, 0, 0, S, S, '#4A6741');
      ctx.strokeStyle = '#3D5736';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
      px(ctx, 6, 6, 2, 2, '#527244');
      px(ctx, 22, 18, 2, 2, '#527244');
      break;

    case T.FLOOR_BREAK:
      px(ctx, 0, 0, S, S, '#5C4033');
      ctx.strokeStyle = '#4E3528';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
      // Baldosa
      line(ctx, S / 2, 0, S / 2, S, '#53382A');
      line(ctx, 0, S / 2, S, S / 2, '#53382A');
      break;

    case T.FLOOR_BATH:
      px(ctx, 0, 0, S, S, '#B8CCD8');
      ctx.strokeStyle = '#A0B8C4';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
      break;

    case T.WALL_TOP:
      px(ctx, 0, 0, S, S, '#5D4E37');
      px(ctx, 0, S - 4, S, 4, '#4A3D2C');
      // Textura de ladrillo
      for (let y = 2; y < S - 4; y += 8) {
        for (let x = 0; x < S; x += 16) {
          const off = (Math.floor(y / 8) % 2) * 8;
          px(ctx, x + off, y, 14, 6, '#665840');
          ctx.strokeStyle = '#4A3D2C';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x + off + 0.5, y + 0.5, 13, 5);
        }
      }
      break;

    case T.WALL_SIDE:
      px(ctx, 0, 0, S, S, '#5D4E37');
      px(ctx, S - 4, 0, 4, S, '#4A3D2C');
      for (let y = 0; y < S; y += 8) {
        for (let x = 0; x < S - 4; x += 16) {
          const off = (Math.floor(y / 8) % 2) * 8;
          px(ctx, x + off, y, 14, 6, '#665840');
        }
      }
      break;

    case T.WALL_CORNER_TL:
      px(ctx, 0, 0, S, S, '#4A3D2C');
      px(ctx, 4, 4, S - 4, S - 4, '#5D4E37');
      break;

    case T.WALL_CORNER_TR:
      px(ctx, 0, 0, S, S, '#4A3D2C');
      px(ctx, 0, 4, S - 4, S - 4, '#5D4E37');
      break;

    case T.WALL_BOTTOM:
      px(ctx, 0, 0, S, S, '#5D4E37');
      px(ctx, 0, 0, S, 4, '#4A3D2C');
      break;

    case T.DESK_TOP_L:
      px(ctx, 0, 0, S, S, '#8B7355');
      px(ctx, 0, 0, S, 2, '#9E8468');
      px(ctx, 0, S - 2, S, 2, '#7A6348');
      // Borde izq
      px(ctx, 0, 0, 2, S, '#7A6348');
      break;

    case T.DESK_TOP_R:
      px(ctx, 0, 0, S, S, '#8B7355');
      px(ctx, 0, 0, S, 2, '#9E8468');
      px(ctx, 0, S - 2, S, 2, '#7A6348');
      px(ctx, S - 2, 0, 2, S, '#7A6348');
      break;

    case T.DESK_FRONT_L:
      px(ctx, 0, 0, S, S, '#7A6348');
      px(ctx, 0, 0, S, 2, '#8B7355');
      // Patas
      px(ctx, 2, 2, 4, S - 2, '#665840');
      px(ctx, 14, 4, 12, S - 6, '#6B5C44');
      break;

    case T.DESK_FRONT_R:
      px(ctx, 0, 0, S, S, '#7A6348');
      px(ctx, 0, 0, S, 2, '#8B7355');
      px(ctx, S - 6, 2, 4, S - 2, '#665840');
      px(ctx, 6, 4, 12, S - 6, '#6B5C44');
      break;

    case T.CHAIR:
      // Asiento
      px(ctx, 6, 14, 20, 12, '#4A6FA5');
      px(ctx, 8, 16, 16, 8, '#5A82B5');
      // Respaldo
      px(ctx, 8, 4, 16, 12, '#3D5F8C');
      px(ctx, 10, 6, 12, 8, '#4A6FA5');
      // Patas
      px(ctx, 8, 26, 4, 6, '#333');
      px(ctx, 20, 26, 4, 6, '#333');
      break;

    case T.MONITOR:
      // Pantalla
      px(ctx, 4, 2, 24, 18, '#2C3E50');
      px(ctx, 6, 4, 20, 14, '#3498DB');
      // Brillo
      px(ctx, 7, 5, 6, 3, '#5DADE2');
      // Soporte
      px(ctx, 13, 20, 6, 4, '#2C3E50');
      px(ctx, 10, 24, 12, 3, '#34495E');
      // Teclado
      px(ctx, 6, 28, 20, 4, '#34495E');
      px(ctx, 8, 29, 16, 2, '#4A6A7A');
      break;

    case T.PLANT_POT:
      px(ctx, 8, 12, 16, 18, '#A0522D');
      px(ctx, 6, 12, 20, 4, '#B8652A');
      // Tierra
      px(ctx, 10, 12, 12, 3, '#4A3520');
      break;

    case T.PLANT_LEAVES:
      // Copa del arbol/planta
      ctx.fillStyle = '#27AE60';
      ctx.beginPath();
      ctx.arc(16, 14, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2ECC71';
      ctx.beginPath();
      ctx.arc(14, 10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#55E088';
      ctx.beginPath();
      ctx.arc(18, 8, 7, 0, Math.PI * 2);
      ctx.fill();
      // Tallo
      px(ctx, 14, 22, 4, 10, '#6B4226');
      break;

    case T.SOFA_L:
      px(ctx, 0, 8, S, 24, '#6C5CE7');
      px(ctx, 0, 4, 8, 28, '#5B4CD6');
      px(ctx, 4, 12, 28, 16, '#7D6FE8');
      // Cojin
      px(ctx, 8, 14, 20, 10, '#8B7FEC');
      break;

    case T.SOFA_M:
      px(ctx, 0, 8, S, 24, '#6C5CE7');
      px(ctx, 0, 12, S, 16, '#7D6FE8');
      px(ctx, 4, 14, 24, 10, '#8B7FEC');
      break;

    case T.SOFA_R:
      px(ctx, 0, 8, S, 24, '#6C5CE7');
      px(ctx, 24, 4, 8, 28, '#5B4CD6');
      px(ctx, 0, 12, 28, 16, '#7D6FE8');
      px(ctx, 4, 14, 20, 10, '#8B7FEC');
      break;

    case T.TABLE_SMALL:
      px(ctx, 2, 6, 28, 20, '#8B7355');
      px(ctx, 2, 6, 28, 3, '#9E8468');
      px(ctx, 4, 26, 4, 6, '#705C42');
      px(ctx, 24, 26, 4, 6, '#705C42');
      break;

    case T.BOOKSHELF_L:
      px(ctx, 0, 0, S, S, '#5D4E37');
      px(ctx, 0, 0, S, 2, '#4A3D2C');
      px(ctx, 0, 15, S, 2, '#4A3D2C');
      // Libros fila sup
      px(ctx, 2, 3, 5, 11, '#E74C3C');
      px(ctx, 8, 4, 4, 10, '#3498DB');
      px(ctx, 13, 3, 6, 11, '#27AE60');
      px(ctx, 20, 5, 4, 9, '#F39C12');
      px(ctx, 25, 3, 5, 11, '#9B59B6');
      // Libros fila inf
      px(ctx, 2, 18, 6, 12, '#1ABC9C');
      px(ctx, 9, 19, 5, 11, '#E67E22');
      px(ctx, 15, 18, 5, 12, '#2980B9');
      px(ctx, 21, 19, 4, 11, '#C0392B');
      px(ctx, 26, 18, 5, 12, '#8E44AD');
      break;

    case T.BOOKSHELF_R:
      px(ctx, 0, 0, S, S, '#5D4E37');
      px(ctx, 0, 0, S, 2, '#4A3D2C');
      px(ctx, 0, 15, S, 2, '#4A3D2C');
      px(ctx, 2, 3, 4, 11, '#F39C12');
      px(ctx, 7, 4, 5, 10, '#9B59B6');
      px(ctx, 13, 3, 6, 11, '#E74C3C');
      px(ctx, 20, 4, 5, 10, '#27AE60');
      px(ctx, 26, 3, 5, 11, '#3498DB');
      px(ctx, 2, 18, 5, 12, '#E67E22');
      px(ctx, 8, 19, 6, 11, '#1ABC9C');
      px(ctx, 15, 18, 5, 12, '#C0392B');
      px(ctx, 21, 19, 5, 11, '#2980B9');
      px(ctx, 27, 18, 4, 12, '#8E44AD');
      break;

    case T.WHITEBOARD_L:
      px(ctx, 0, 0, S, S, '#ECF0F1');
      ctx.strokeStyle = '#95A5A6';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, S - 2, S - 2);
      // Garabatos
      line(ctx, 4, 8, 28, 10, '#E74C3C');
      line(ctx, 4, 16, 20, 14, '#3498DB');
      line(ctx, 4, 22, 24, 22, '#27AE60');
      break;

    case T.WHITEBOARD_R:
      px(ctx, 0, 0, S, S, '#ECF0F1');
      ctx.strokeStyle = '#95A5A6';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, S - 2, S - 2);
      // Diagrama
      px(ctx, 8, 6, 8, 8, '#3498DB');
      px(ctx, 20, 14, 8, 8, '#E74C3C');
      line(ctx, 16, 10, 20, 18, '#333');
      // Bandeja
      px(ctx, 4, 28, 24, 3, '#95A5A6');
      break;

    case T.COFFEE_MACHINE:
      px(ctx, 4, 0, 24, S, '#2C3E50');
      px(ctx, 6, 2, 20, 10, '#34495E');
      // Boton rojo
      ctx.fillStyle = '#E74C3C';
      ctx.beginPath();
      ctx.arc(16, 7, 3, 0, Math.PI * 2);
      ctx.fill();
      // Taza
      px(ctx, 10, 20, 12, 10, '#FFFFFF');
      px(ctx, 12, 22, 8, 6, '#8B6914');
      // Vapor
      ctx.fillStyle = 'rgba(200,200,200,0.5)';
      ctx.beginPath();
      ctx.arc(16, 16, 4, 0, Math.PI * 2);
      ctx.fill();
      break;

    case T.WINDOW:
      px(ctx, 0, 0, S, S, '#5D4E37');
      px(ctx, 3, 3, 26, 26, '#87CEEB');
      px(ctx, 4, 4, 11, 11, '#A8D8EA');
      px(ctx, 17, 4, 11, 11, '#A8D8EA');
      px(ctx, 4, 17, 11, 11, '#A8D8EA');
      px(ctx, 17, 17, 11, 11, '#A8D8EA');
      // Marco central
      px(ctx, 15, 3, 2, 26, '#5D4E37');
      px(ctx, 3, 15, 26, 2, '#5D4E37');
      break;

    case T.DOOR:
      px(ctx, 4, 0, 24, S, '#8B6914');
      px(ctx, 6, 2, 20, S - 2, '#A0792A');
      // Pomo
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(22, 18, 2, 0, Math.PI * 2);
      ctx.fill();
      break;

    case T.SINK:
      px(ctx, 4, 8, 24, 18, '#BDC3C7');
      px(ctx, 8, 12, 16, 10, '#87CEEB');
      // Grifo
      px(ctx, 14, 4, 4, 8, '#95A5A6');
      px(ctx, 12, 4, 8, 3, '#7F8C8D');
      break;

    case T.TOILET:
      px(ctx, 6, 8, 20, 22, '#ECF0F1');
      px(ctx, 8, 10, 16, 14, '#FFFFFF');
      // Cisterna
      px(ctx, 8, 2, 16, 8, '#BDC3C7');
      break;

    case T.MIRROR:
      px(ctx, 6, 2, 20, 24, '#A8D8EA');
      ctx.strokeStyle = '#95A5A6';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 2, 20, 24);
      // Brillo
      px(ctx, 8, 4, 4, 8, '#C8E8F8');
      break;

    case T.RUG_TL:
      px(ctx, 0, 0, S, S, 'rgba(108, 92, 231, 0.25)');
      px(ctx, 0, 0, S, 3, 'rgba(108, 92, 231, 0.4)');
      px(ctx, 0, 0, 3, S, 'rgba(108, 92, 231, 0.4)');
      break;
    case T.RUG_TR:
      px(ctx, 0, 0, S, S, 'rgba(108, 92, 231, 0.25)');
      px(ctx, 0, 0, S, 3, 'rgba(108, 92, 231, 0.4)');
      px(ctx, S - 3, 0, 3, S, 'rgba(108, 92, 231, 0.4)');
      break;
    case T.RUG_BL:
      px(ctx, 0, 0, S, S, 'rgba(108, 92, 231, 0.25)');
      px(ctx, 0, S - 3, S, 3, 'rgba(108, 92, 231, 0.4)');
      px(ctx, 0, 0, 3, S, 'rgba(108, 92, 231, 0.4)');
      break;
    case T.RUG_BR:
      px(ctx, 0, 0, S, S, 'rgba(108, 92, 231, 0.25)');
      px(ctx, 0, S - 3, S, 3, 'rgba(108, 92, 231, 0.4)');
      px(ctx, S - 3, 0, 3, S, 'rgba(108, 92, 231, 0.4)');
      break;

    case T.MEETING_TABLE_L:
      px(ctx, 0, 4, S, 24, '#5D4E37');
      px(ctx, 0, 4, S, 3, '#6B5C44');
      px(ctx, 2, 28, 6, 4, '#4A3D2C');
      break;
    case T.MEETING_TABLE_R:
      px(ctx, 0, 4, S, 24, '#5D4E37');
      px(ctx, 0, 4, S, 3, '#6B5C44');
      px(ctx, 24, 28, 6, 4, '#4A3D2C');
      break;

    case T.MEETING_CHAIR_T:
      px(ctx, 8, 0, 16, 10, '#4A6FA5');
      px(ctx, 10, 2, 12, 6, '#5A82B5');
      px(ctx, 8, 10, 16, 8, '#3D5F8C');
      break;
    case T.MEETING_CHAIR_B:
      px(ctx, 8, 14, 16, 8, '#3D5F8C');
      px(ctx, 8, 22, 16, 10, '#4A6FA5');
      px(ctx, 10, 24, 12, 6, '#5A82B5');
      break;

    default:
      // Tile desconocido — rosa debug
      px(ctx, 0, 0, S, S, '#FF00FF');
      px(ctx, 0, 0, S / 2, S / 2, '#FF88FF');
      px(ctx, S / 2, S / 2, S / 2, S / 2, '#FF88FF');
      break;
  }
}
