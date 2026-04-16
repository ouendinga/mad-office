/**
 * Office Map Renderer v2
 * 800x600 map with improved furniture, bathroom, movement, reactions
 */

import { drawAvatar, drawRepresentation, drawActionIndicator } from './avatarSprites';

const MAP_W = 800;
const MAP_H = 600;
const DESK_W = 80;
const DESK_H = 50;
const AVATAR_SCALE = 3;

// Desk positions: 2 rows of 4
const DESK_POSITIONS = [
  { x: 120, y: 120 }, { x: 250, y: 120 }, { x: 380, y: 120 }, { x: 510, y: 120 },
  { x: 120, y: 280 }, { x: 250, y: 280 }, { x: 380, y: 280 }, { x: 510, y: 280 },
];

// Room zones
const MEETING_ROOM = { x: 620, y: 380, w: 160, h: 200, label: 'Sala de Reuniones' };
const BREAK_AREA = { x: 20, y: 380, w: 160, h: 200, label: 'Zona de Descanso' };
const BATHROOM = { x: 660, y: 20, w: 120, h: 100, label: 'Lavabo' };

const DECORATIONS = [
  { type: 'plant', x: 30, y: 100 },
  { type: 'plant', x: 600, y: 140 },
  { type: 'whiteboard', x: 630, y: 150, w: 140, h: 80 },
  { type: 'coffee_machine', x: 50, y: 420 },
  { type: 'plant', x: 350, y: 400 },
  { type: 'bookshelf', x: 240, y: 10, w: 100, h: 45 },
  { type: 'bookshelf', x: 400, y: 10, w: 100, h: 45 },
];

export const MOOD_COLORS = {
  alegria: '#00B894',
  energia: '#FDCB6E',
  optimismo: '#6C5CE7',
  frustracion: '#D63031',
  estres: '#E17055',
  neutral: '#6C6C8A',
};

// Avatar target positions for smooth movement
const avatarPositions = {};

function getAvatarDisplayPos(user, deskPos) {
  const userId = user.id;

  // Target: custom position if moving, desk position if sitting
  let targetX, targetY;
  if (user.position_x !== null && user.position_x !== undefined) {
    targetX = user.position_x;
    targetY = user.position_y;
  } else if (deskPos) {
    targetX = deskPos.x + (DESK_W / 2) - 24;
    targetY = deskPos.y - 48;
  } else {
    targetX = 400;
    targetY = 300;
  }

  // Smooth interpolation
  if (!avatarPositions[userId]) {
    avatarPositions[userId] = { x: targetX, y: targetY };
  }
  const pos = avatarPositions[userId];
  const speed = user.current_action === 'corriendo' ? 0.08 : 0.03;
  pos.x += (targetX - pos.x) * speed;
  pos.y += (targetY - pos.y) * speed;

  return pos;
}

export function renderOffice(ctx, canvas, users, animFrame, reactions, clock) {
  const scaleX = canvas.width / MAP_W;
  const scaleY = canvas.height / MAP_H;
  const scale = Math.min(scaleX, scaleY);

  ctx.save();
  ctx.scale(scale, scale);

  // Background
  const isNight = clock && !clock.working;
  ctx.fillStyle = isNight ? '#0A0A15' : '#1A1A2E';
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  // Floor tiles
  ctx.fillStyle = isNight ? '#0E0E20' : '#16213E';
  for (let y = 0; y < MAP_H; y += 40) {
    for (let x = 0; x < MAP_W; x += 40) {
      if ((Math.floor(x / 40) + Math.floor(y / 40)) % 2 === 0) {
        ctx.fillRect(x, y, 40, 40);
      }
    }
  }

  // Walls
  ctx.fillStyle = '#2D2D44';
  ctx.fillRect(0, 0, MAP_W, 10);
  ctx.fillRect(0, 0, 10, MAP_H);
  ctx.fillRect(MAP_W - 10, 0, 10, MAP_H);
  ctx.fillRect(0, MAP_H - 10, MAP_W, 10);

  // Rooms
  drawRoom(ctx, MEETING_ROOM, '#0D1B2A');
  drawRoom(ctx, BREAK_AREA, '#1B2838');
  drawBathroom(ctx, BATHROOM);

  // Decorations
  DECORATIONS.forEach(d => drawDecoration(ctx, d));

  // Desks
  DESK_POSITIONS.forEach((pos, i) => drawDesk(ctx, pos, i));

  // Night overlay
  if (isNight) {
    ctx.fillStyle = 'rgba(0, 0, 20, 0.4)';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    ctx.fillStyle = '#6C6C8A';
    ctx.font = '16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Fuera de horario laboral', MAP_W / 2, MAP_H / 2);
    ctx.textAlign = 'left';
  }

  // Draw avatars
  if (users && !isNight) {
    users.forEach(user => {
      const deskIndex = user.desk_index;
      const deskPos = deskIndex !== null && deskIndex < DESK_POSITIONS.length ? DESK_POSITIONS[deskIndex] : null;
      const pos = getAvatarDisplayPos(user, deskPos);
      const config = user.avatar_config || {};

      let yOffset = 0;
      if (user.current_action === 'celebrando' || user.current_action === 'corriendo') {
        yOffset = Math.sin(animFrame * 0.3) * 3;
      }

      ctx.save();
      ctx.translate(pos.x, pos.y + yOffset);

      drawAvatar(ctx, config, 0, 0, AVATAR_SCALE);

      if (user.current_action) {
        drawActionIndicator(ctx, user.current_action, 0, 0, AVATAR_SCALE, animFrame);
      }

      if (user.current_representation) {
        drawRepresentation(ctx, user.current_representation, 0, 0, AVATAR_SCALE, animFrame);
      }

      ctx.restore();

      // Name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(user.name, pos.x + 24, pos.y + 55);

      // Mood dot
      const dominantMood = getDominantMood(user);
      ctx.beginPath();
      ctx.arc(pos.x + 24, pos.y + 63, 4, 0, Math.PI * 2);
      ctx.fillStyle = MOOD_COLORS[dominantMood] || '#6C6C8A';
      ctx.fill();
      ctx.textAlign = 'left';
    });

    // Draw emoji reactions
    if (reactions) {
      reactions.forEach(r => {
        const u = users.find(u => u.id === r.userId);
        if (!u) return;
        const deskPos = u.desk_index !== null && u.desk_index < DESK_POSITIONS.length ? DESK_POSITIONS[u.desk_index] : null;
        const pos = getAvatarDisplayPos(u, deskPos);
        const elapsed = (Date.now() - r.timestamp) / 1000;
        const alpha = Math.max(0, 1 - elapsed / 3);
        const yOff = -elapsed * 20;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.emoji, pos.x + 24, pos.y + yOff - 5);
        ctx.restore();
      });
    }
  }

  ctx.restore();
}

function getDominantMood(user) {
  const moods = {
    alegria: user.alegria || 5,
    energia: user.energia || 5,
    optimismo: user.optimismo || 5,
    frustracion: user.frustracion || 5,
    estres: user.estres || 5,
  };
  let worst = 'neutral';
  let minVal = 10;
  for (const [key, val] of Object.entries(moods)) {
    if (val < minVal) { minVal = val; worst = key; }
  }
  return minVal < 4 ? worst : 'neutral';
}

function drawRoom(ctx, room, color) {
  ctx.fillStyle = color;
  ctx.fillRect(room.x, room.y, room.w, room.h);
  ctx.strokeStyle = '#3D3D5C';
  ctx.lineWidth = 2;
  ctx.strokeRect(room.x, room.y, room.w, room.h);

  ctx.fillStyle = '#6C6C8A';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(room.label, room.x + room.w / 2, room.y + 15);
  ctx.textAlign = 'left';

  if (room.label.includes('Reuniones')) {
    // Table
    ctx.fillStyle = '#4A3728';
    const rx = room.x + 30, ry = room.y + 60;
    ctx.fillRect(rx, ry, 100, 50);
    ctx.strokeStyle = '#3A2718';
    ctx.strokeRect(rx, ry, 100, 50);
    // Chairs
    ctx.fillStyle = '#2D2D44';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(rx + 10 + i * 30, ry - 15, 18, 12);
      ctx.fillRect(rx + 10 + i * 30, ry + 53, 18, 12);
    }
  }

  if (room.label.includes('Descanso')) {
    // Sofa
    ctx.fillStyle = '#6C5CE7';
    ctx.fillRect(room.x + 15, room.y + 70, 90, 20);
    ctx.fillRect(room.x + 10, room.y + 65, 10, 30);
    ctx.fillRect(room.x + 100, room.y + 65, 10, 30);
    // Coffee table
    ctx.fillStyle = '#4A3728';
    ctx.fillRect(room.x + 40, room.y + 100, 50, 20);
    ctx.strokeStyle = '#3A2718';
    ctx.strokeRect(room.x + 40, room.y + 100, 50, 20);
    // Second sofa
    ctx.fillStyle = '#5B4CD6';
    ctx.fillRect(room.x + 15, room.y + 130, 90, 20);
    ctx.fillRect(room.x + 10, room.y + 125, 10, 30);
    ctx.fillRect(room.x + 100, room.y + 125, 10, 30);
    // Rug
    ctx.fillStyle = 'rgba(108, 92, 231, 0.15)';
    ctx.fillRect(room.x + 20, room.y + 60, 100, 100);
  }
}

function drawBathroom(ctx, room) {
  ctx.fillStyle = '#152238';
  ctx.fillRect(room.x, room.y, room.w, room.h);
  ctx.strokeStyle = '#3D3D5C';
  ctx.lineWidth = 2;
  ctx.strokeRect(room.x, room.y, room.w, room.h);

  ctx.fillStyle = '#6C6C8A';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(room.label, room.x + room.w / 2, room.y + 15);
  ctx.textAlign = 'left';

  // Sink
  ctx.fillStyle = '#BDC3C7';
  ctx.fillRect(room.x + 15, room.y + 30, 35, 25);
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(room.x + 20, room.y + 35, 25, 15);
  // Mirror
  ctx.fillStyle = '#A8D8EA';
  ctx.fillRect(room.x + 18, room.y + 22, 30, 8);
  // Toilet
  ctx.fillStyle = '#ECF0F1';
  ctx.fillRect(room.x + 70, room.y + 30, 30, 35);
  ctx.fillStyle = '#BDC3C7';
  ctx.fillRect(room.x + 73, room.y + 25, 24, 8);
}

function drawDesk(ctx, pos, index) {
  ctx.fillStyle = '#5D4E37';
  ctx.fillRect(pos.x, pos.y, DESK_W, DESK_H);
  ctx.strokeStyle = '#4A3728';
  ctx.lineWidth = 1;
  ctx.strokeRect(pos.x, pos.y, DESK_W, DESK_H);

  // Monitor
  ctx.fillStyle = '#2C3E50';
  ctx.fillRect(pos.x + DESK_W / 2 - 12, pos.y + 5, 24, 18);
  ctx.fillStyle = '#3498DB';
  ctx.fillRect(pos.x + DESK_W / 2 - 10, pos.y + 7, 20, 14);
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
    case 'plant': {
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(dec.x, dec.y + 15, 20, 15);
      ctx.fillStyle = '#6B3410';
      ctx.fillRect(dec.x + 2, dec.y + 17, 16, 2);
      ctx.fillStyle = '#27AE60';
      ctx.beginPath();
      ctx.arc(dec.x + 10, dec.y + 10, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2ECC71';
      ctx.beginPath();
      ctx.arc(dec.x + 10, dec.y + 6, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#55E088';
      ctx.beginPath();
      ctx.arc(dec.x + 13, dec.y + 4, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'whiteboard': {
      ctx.fillStyle = '#ECF0F1';
      ctx.fillRect(dec.x, dec.y, dec.w, dec.h);
      ctx.strokeStyle = '#95A5A6';
      ctx.lineWidth = 3;
      ctx.strokeRect(dec.x, dec.y, dec.w, dec.h);
      // Tray
      ctx.fillStyle = '#95A5A6';
      ctx.fillRect(dec.x + 10, dec.y + dec.h - 4, dec.w - 20, 6);
      // Scribbles
      ctx.strokeStyle = '#E74C3C';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dec.x + 15, dec.y + 15);
      ctx.lineTo(dec.x + 80, dec.y + 20);
      ctx.lineTo(dec.x + 60, dec.y + 30);
      ctx.stroke();
      ctx.strokeStyle = '#3498DB';
      ctx.beginPath();
      ctx.moveTo(dec.x + 15, dec.y + 40);
      ctx.lineTo(dec.x + 100, dec.y + 35);
      ctx.stroke();
      ctx.strokeStyle = '#27AE60';
      ctx.beginPath();
      ctx.moveTo(dec.x + 15, dec.y + 55);
      ctx.lineTo(dec.x + 90, dec.y + 55);
      ctx.stroke();
      break;
    }
    case 'coffee_machine': {
      ctx.fillStyle = '#2C3E50';
      ctx.fillRect(dec.x, dec.y, 30, 40);
      ctx.fillStyle = '#34495E';
      ctx.fillRect(dec.x + 2, dec.y + 2, 26, 12);
      ctx.fillStyle = '#E74C3C';
      ctx.beginPath();
      ctx.arc(dec.x + 15, dec.y + 8, 3, 0, Math.PI * 2);
      ctx.fill();
      // Cup
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(dec.x + 8, dec.y + 28, 14, 10);
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(dec.x + 10, dec.y + 30, 10, 6);
      // Steam
      ctx.fillStyle = 'rgba(200,200,200,0.4)';
      ctx.beginPath();
      ctx.arc(dec.x + 15, dec.y + 24, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bookshelf': {
      ctx.fillStyle = '#4A3728';
      ctx.fillRect(dec.x, dec.y, dec.w, dec.h);
      ctx.strokeStyle = '#3A2718';
      ctx.lineWidth = 1;
      ctx.strokeRect(dec.x, dec.y, dec.w, dec.h);
      // Shelves
      ctx.fillStyle = '#3A2718';
      ctx.fillRect(dec.x, dec.y + dec.h / 2, dec.w, 2);
      // Books (fixed widths to avoid flickering)
      const colors = ['#E74C3C', '#3498DB', '#27AE60', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#2980B9'];
      const bookWidths = [6, 5, 7, 5, 8, 6, 5, 7];
      for (let s = 0; s < 2; s++) {
        const shelfY = dec.y + s * (dec.h / 2) + 3;
        let bx = dec.x + 3;
        for (let i = 0; i < 8 && bx < dec.x + dec.w - 8; i++) {
          const bw = bookWidths[i];
          const bh = dec.h / 2 - 6;
          ctx.fillStyle = colors[(i + s * 3) % colors.length];
          ctx.fillRect(bx, shelfY, bw, bh);
          bx += bw + 1;
        }
      }
      break;
    }
    default:
      break;
  }
}

export { MAP_W, MAP_H, DESK_POSITIONS };
