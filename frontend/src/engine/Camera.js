/**
 * Camera — viewport que sigue un target en un mapa mayor que la pantalla.
 * Coordenadas: world (mapa) → screen (canvas).
 */

export default class Camera {
  constructor(viewW, viewH, mapW, mapH) {
    this.viewW = viewW;   // Ancho del viewport en px
    this.viewH = viewH;   // Alto del viewport en px
    this.mapW = mapW;      // Ancho del mapa en px
    this.mapH = mapH;      // Alto del mapa en px
    this.x = 0;            // Posicion top-left del viewport en world coords
    this.y = 0;
    this.zoom = 1;
    this.targetX = 0;
    this.targetY = 0;
    this.smoothing = 0.08; // Lerp factor para seguimiento suave
  }

  /** Reajustar viewport (cuando cambia el tamano del canvas) */
  resize(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
  }

  /** Centrar camara en un punto del mapa */
  follow(worldX, worldY) {
    this.targetX = worldX - (this.viewW / this.zoom) / 2;
    this.targetY = worldY - (this.viewH / this.zoom) / 2;
  }

  /** Actualizar posicion con interpolacion suave */
  update() {
    this.x += (this.targetX - this.x) * this.smoothing;
    this.y += (this.targetY - this.y) * this.smoothing;
    this.clamp();
  }

  /** No salirse del mapa */
  clamp() {
    const vw = this.viewW / this.zoom;
    const vh = this.viewH / this.zoom;
    this.x = Math.max(0, Math.min(this.x, this.mapW - vw));
    this.y = Math.max(0, Math.min(this.y, this.mapH - vh));
  }

  /** Aplicar transformacion al contexto canvas antes de dibujar */
  applyTransform(ctx) {
    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-Math.round(this.x), -Math.round(this.y));
  }

  /** Restaurar transformacion */
  restore(ctx) {
    ctx.restore();
  }

  /** Convertir coordenadas de pantalla a world */
  screenToWorld(sx, sy) {
    return {
      x: sx / this.zoom + this.x,
      y: sy / this.zoom + this.y,
    };
  }

  /** Comprobar si un rect del world es visible en pantalla */
  isVisible(wx, wy, w, h) {
    const vw = this.viewW / this.zoom;
    const vh = this.viewH / this.zoom;
    return (
      wx + w > this.x &&
      wx < this.x + vw &&
      wy + h > this.y &&
      wy < this.y + vh
    );
  }
}
