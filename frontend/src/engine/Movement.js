/**
 * Movement — controlador de movimiento del avatar del usuario.
 * Soporta WASD/flechas y click-to-move con colisiones.
 */

const MOVE_SPEED = 2.5;     // Pixels por frame
const SEND_INTERVAL = 80;   // ms entre envios de posicion al server

export default class Movement {
  constructor(tileMap) {
    this.tileMap = tileMap;
    this.x = 0;
    this.y = 0;
    this.targetX = null;      // Para click-to-move
    this.targetY = null;
    this.keys = {};           // Teclas pulsadas
    this.moving = false;      // Si el avatar se esta moviendo
    this.enabled = true;
    this.lastSend = 0;
    this.onPositionChange = null; // Callback para enviar al server
    this.onZoneEnter = null;      // Callback al entrar en zona
    this.onZoneLeave = null;      // Callback al salir de zona
    this.currentZone = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
  }

  /** Inicializar posicion y listeners */
  init(startX, startY) {
    this.x = startX;
    this.y = startY;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  /** Limpiar listeners */
  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  _onKeyDown(e) {
    if (!this.enabled) return;
    if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      this.keys[e.key] = true;
      // Cancelar click-to-move si se pulsa tecla
      this.targetX = null;
      this.targetY = null;
    }
  }

  _onKeyUp(e) {
    this.keys[e.key] = false;
  }

  /** Manejar click en el canvas (coordenadas world) */
  handleClick(worldX, worldY) {
    if (!this.enabled) return;
    // No ir a un tile solido
    if (this.tileMap.isSolid(worldX, worldY)) return;
    this.targetX = worldX;
    this.targetY = worldY;
  }

  /** Actualizar posicion cada frame */
  update() {
    if (!this.enabled) return;

    let dx = 0;
    let dy = 0;
    const wasMoving = this.moving;

    // Input por teclado
    if (this.keys['w'] || this.keys['ArrowUp']) dy -= 1;
    if (this.keys['s'] || this.keys['ArrowDown']) dy += 1;
    if (this.keys['a'] || this.keys['ArrowLeft']) dx -= 1;
    if (this.keys['d'] || this.keys['ArrowRight']) dx += 1;

    const hasKeyInput = dx !== 0 || dy !== 0;

    // Click-to-move
    if (!hasKeyInput && this.targetX !== null) {
      const tdx = this.targetX - this.x;
      const tdy = this.targetY - this.y;
      const dist = Math.sqrt(tdx * tdx + tdy * tdy);

      if (dist < MOVE_SPEED * 2) {
        // Llegamos al destino
        this.targetX = null;
        this.targetY = null;
      } else {
        dx = tdx / dist;
        dy = tdy / dist;
      }
    }

    // Normalizar diagonal para que no sea mas rapido
    if (dx !== 0 && dy !== 0 && hasKeyInput) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    this.moving = dx !== 0 || dy !== 0;

    if (this.moving) {
      const newX = this.x + dx * MOVE_SPEED;
      const newY = this.y + dy * MOVE_SPEED;

      // Colision: comprobar los 4 corners del avatar (hitbox ~32x32 centrado)
      const hw = 16; // Half-width del hitbox
      const hh = 16; // Half-height

      // Intentar X e Y por separado (sliding contra paredes)
      let canX = true;
      let canY = true;

      // Check X movement
      if (dx !== 0) {
        const checkX = dx > 0 ? newX + hw : newX - hw;
        if (
          this.tileMap.isSolid(checkX, this.y - hh + 2) ||
          this.tileMap.isSolid(checkX, this.y + hh - 2)
        ) {
          canX = false;
        }
      }

      // Check Y movement
      if (dy !== 0) {
        const checkY = dy > 0 ? newY + hh : newY - hh;
        if (
          this.tileMap.isSolid(this.x - hw + 2, checkY) ||
          this.tileMap.isSolid(this.x + hw - 2, checkY)
        ) {
          canY = false;
        }
      }

      // Limitar al mapa
      if (canX) {
        this.x = Math.max(hw, Math.min(newX, this.tileMap.pixelW - hw));
      }
      if (canY) {
        this.y = Math.max(hh, Math.min(newY, this.tileMap.pixelH - hh));
      }

      // Enviar posicion al server con throttle
      this._sendPosition();
    } else if (wasMoving) {
      // Acabamos de parar — enviar posicion final
      this._sendPosition(true);
    }

    // Comprobar zonas
    this._checkZones();
  }

  /** Enviar posicion al server */
  _sendPosition(force = false) {
    const now = Date.now();
    if (!force && now - this.lastSend < SEND_INTERVAL) return;
    this.lastSend = now;

    if (this.onPositionChange) {
      this.onPositionChange(this.x, this.y, this.moving);
    }
  }

  /** Comprobar si entramos/salimos de una zona */
  _checkZones() {
    const zone = this.tileMap.getZoneAt(this.x, this.y);
    const zoneName = zone ? zone.name : null;

    if (zoneName !== this.currentZone) {
      if (this.currentZone && this.onZoneLeave) {
        this.onZoneLeave(this.currentZone);
      }
      this.currentZone = zoneName;
      if (zoneName && this.onZoneEnter) {
        this.onZoneEnter(zone);
      }
    }
  }
}
