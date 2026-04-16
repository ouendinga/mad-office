/**
 * Office Map Renderer
 * Draws the 2D office map on Canvas with desks, rooms, decorations, and avatars
 * Map is 800x600 logical pixels
 */

import { drawAvatar, drawRepresentation, drawActionIndicator } from './avatarSprites';

const MAP_W = 800;
const MAP_H = 600;
const DESK_W = 80;
const DESK_H = 50;
const AVATAR_SCALE = 3;

// Desk positions: 2 rows of 4
const DESK_POSITIONS = [
  // Row 1 (top)
  { x: 120, y: 120 }, { x: 250, y: 120 }, { x: 380, y: 120 }, { x: 510, y: 120 },
  // Row 2 (bottom)
  { x: 120, y: 280 }, { x: 250, y: 280 }, { x: 380, y: 280 }, { x: 510, y: 280 },
];

// Room zones
const MEETING_ROOM = { x: 620, y: 380, w: 160, h: 200, label: 'Sala de Reuniones' };
const BREAK_AREA = { x: 20, y: 380, w: 160, h: 200, label: 'Zona de Descanso' };

// Decorations
const DECORATIONS = [
  { type: 'plant', x: 30, y: 100 },
  { type: 'plant', x: 680, y: 100 },
  { type: 'whiteboard', x: 650, y: 50, w: 120, h: 70 },
  { type: 'coffee_machine', x: 50, y: 410 },
  { type: 'plant', x: 350, y: 400 },
];

export function renderOffice(ctx, canvas, users, animFrame) {
  const scaleX = canvas.width / MAP_W;
  const scaleY = canvas.height / MAP_H;
  const scale = Math.min(scaleX, scaleY);

  ctx.save();
  ctx.scale(scale, scale);

  // Background - office floor
  ctx.fillStyle = '#1A1A2E';
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  // Floor tiles pattern
  ctx.fillStyle = '#16213E';
  for (let y = 0; y < MAP_H; y += 40) {
    for (let x = 0; x < MAP_W; x += 40) {
      if ((Math.floor(x / 40) + Math.floor(y / 40)) % 2 === 0) {
        ctx.fillRect(x, y, 40, 40);
      }
    }
  }

  // Walls
  ctx.fillStyle = '#2D2D44';
  ctx.fillRect(0, 0, MAP_W, 10);   // Top wall
  ctx.fillRect(0, 0, 10, MAP_H);   // Left wall
  ctx.fillRect(MAP_W - 10, 0, 10, MAP_H); // Right wall
  ctx.fillRect(0, MAP_H - 10, MAP_W, 10); // Bottom wall

  // Meeting room
  drawRoom(ctx, MEETING_ROOM, '#0D1B2A');
  // Break area
  drawRoom(ctx, BREAK_AREA, '#1B2838');

  // Draw decorations
  DECORATIONS.forEach(d => drawDecoration(ctx, d));

  // Draw desks
  DESK_POSITIONS.forEach((pos, i) => drawDesk(ctx, pos, i));

  // Draw avatars at desks
  if (users) {
    users.forEach(user => {
      if (user.desk_index !== null && user.desk_index < DESK_POSITIONS.length) {
        const desk = DESK_POSITIONS[user.desk_index];
        const avatarX = desk.x + (DESK_W / 2) - (16 * AVATAR_SCALE / 2);
        const avatarY = desk.y - 16 * AVATAR_SCALE + 5;

        const config = user.avatar_config || {};
        const avatarPixelX = Math.floor(avatarX / AVATAR_SCALE);
        const avatarPixelY = Math.floor(avatarY / AVATAR_SCALE);

        // Bouncing effect for certain actions
        let yOffset = 0;
        if (user.current_action === 'celebrating' || user.current_representation === 'bouncing') {
          yOffset = Math.sin(animFrame * 0.3) * 2;
        }

        ctx.save();
        ctx.translate(avatarX, avatarY + yOffset);

        const localCtx = ctx;
        // Draw avatar at scale
        drawAvatar(localCtx, config, 0, 0, AVATAR_SCALE);

        // Draw action indicator
        if (user.current_action) {
          drawActionIndicator(localCtx, user.current_action, 0, 0, AVATAR_SCALE, animFrame);
        }

        // Draw mood representation
        if (user.current_representation) {
          drawRepresentation(localCtx, user.current_representation, 0, 0, AVATAR_SCALE, animFrame);
        }

        ctx.restore();

        // Draw user name below desk
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(user.name, desk.x + DESK_W / 2, desk.y + DESK_H + 16);
        ctx.textAlign = 'left';

        // Draw mood indicator dot
        const dominantMood = getDominantMood(user);
        const moodColor = MOOD_COLORS[dominantMood] || '#FFFFFF';
        ctx.beginPath();
        ctx.arc(desk.x + DESK_W / 2, desk.y + DESK_H + 26, 4, 0, Math.PI * 2);
        ctx.fillStyle = moodColor;
        ctx.fill();
      }
    });
  }

  ctx.restore();
}

const MOOD_COLORS = {
  happiness: '#00B894',
  stress: '#E17055',
  frustration: '#D63031',
  excitement: '#FDCB6E',
  sadness: '#74B9FF',
  tiredness: '#A29BFE',
};

function getDominantMood(user) {
  const moods = {
    happiness: user.happiness || 0,
    stress: user.stress || 0,
    frustration: user.frustration || 0,
    excitement: user.excitement || 0,
    sadness: user.sadness || 0,
    tiredness: user.tiredness || 0,
  };

  let dominant = 'happiness';
  let maxVal = 0;
  for (const [key, val] of Object.entries(moods)) {
    if (val > maxVal) {
      maxVal = val;
      dominant = key;
    }
  }
  return dominant;
}

function drawRoom(ctx, room, color) {
  ctx.fillStyle = color;
  ctx.fillRect(room.x, room.y, room.w, room.h);

  // Room border
  ctx.strokeStyle = '#3D3D5C';
  ctx.lineWidth = 2;
  ctx.strokeRect(room.x, room.y, room.w, room.h);

  // Room label
  ctx.fillStyle = '#6C6C8A';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(room.label, room.x + room.w / 2, room.y + 15);
  ctx.textAlign = 'left';

  // Meeting room: table
  if (room.label.includes('Reuniones')) {
    ctx.fillStyle = '#4A3728';
    ctx.fillRect(room.x + 30, room.y + 60, 100, 50);
    // Chairs
    ctx.fillStyle = '#2D2D44';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(room.x + 40 + i * 30, room.y + 45, 15, 12);
      ctx.fillRect(room.x + 40 + i * 30, room.y + 115, 15, 12);
    }
  }

  // Break area: couch + table
  if (room.label.includes('Descanso')) {
    ctx.fillStyle = '#6C5CE7';
    ctx.fillRect(room.x + 20, room.y + 80, 80, 25);
    ctx.fillRect(room.x + 20, room.y + 130, 80, 25);
    // Coffee table
    ctx.fillStyle = '#4A3728';
    ctx.fillRect(room.x + 50, room.y + 108, 40, 18);
  }
}

function drawDesk(ctx, pos, index) {
  // Desk surface
  ctx.fillStyle = '#5D4E37';
  ctx.fillRect(pos.x, pos.y, DESK_W, DESK_H);

  // Desk border
  ctx.strokeStyle = '#4A3728';
  ctx.lineWidth = 1;
  ctx.strokeRect(pos.x, pos.y, DESK_W, DESK_H);

  // Monitor
  ctx.fillStyle = '#2C3E50';
  ctx.fillRect(pos.x + DESK_W / 2 - 12, pos.y + 5, 24, 18);
  // Screen glow
  ctx.fillStyle = '#3498DB';
  ctx.fillRect(pos.x + DESK_W / 2 - 10, pos.y + 7, 20, 14);
  // Monitor stand
  ctx.fillStyle = '#2C3E50';
  ctx.fillRect(pos.x + DESK_W / 2 - 3, pos.y + 23, 6, 5);

  // Keyboard
  ctx.fillStyle = '#34495E';
  ctx.fillRect(pos.x + DESK_W / 2 - 15, pos.y + 32, 30, 8);

  // Desk number
  ctx.fillStyle = '#6C6C8A';
  ctx.font = '9px Inter, sans-serif';
  ctx.fillText(`#${index + 1}`, pos.x + 3, pos.y + DESK_H - 4);
}

function drawDecoration(ctx, dec) {
  switch (dec.type) {
    case 'plant':
      // Pot
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(dec.x, dec.y + 15, 20, 15);
      // Leaves
      ctx.fillStyle = '#27AE60';
      ctx.beginPath();
      ctx.arc(dec.x + 10, dec.y + 10, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2ECC71';
      ctx.beginPath();
      ctx.arc(dec.x + 10, dec.y + 7, 8, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'whiteboard':
      ctx.fillStyle = '#ECF0F1';
      ctx.fillRect(dec.x, dec.y, dec.w, dec.h);
      ctx.strokeStyle = '#BDC3C7';
      ctx.lineWidth = 2;
      ctx.strokeRect(dec.x, dec.y, dec.w, dec.h);
      // Some scribbles
      ctx.strokeStyle = '#E74C3C';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dec.x + 10, dec.y + 15);
      ctx.lineTo(dec.x + 60, dec.y + 20);
      ctx.stroke();
      ctx.strokeStyle = '#3498DB';
      ctx.beginPath();
      ctx.moveTo(dec.x + 10, dec.y + 35);
      ctx.lineTo(dec.x + 80, dec.y + 30);
      ctx.stroke();
      break;

    case 'coffee_machine':
      ctx.fillStyle = '#2C3E50';
      ctx.fillRect(dec.x, dec.y, 25, 35);
      ctx.fillStyle = '#E74C3C';
      ctx.fillRect(dec.x + 5, dec.y + 5, 15, 3);
      // Cup
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(dec.x + 8, dec.y + 25, 10, 8);
      break;

    default:
      break;
  }
}

export { MAP_W, MAP_H, DESK_POSITIONS, MOOD_COLORS };
