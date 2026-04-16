/**
 * TileMap — carga un mapa JSON y renderiza sus capas tile a tile.
 * Formato compatible con Tiled (simplificado).
 */

import { getTile, TILE_SIZE } from './TileSet';

export default class TileMap {
  constructor(mapData) {
    this.width = mapData.width;     // Tiles en X
    this.height = mapData.height;   // Tiles en Y
    this.tileW = mapData.tilewidth || TILE_SIZE;
    this.tileH = mapData.tileheight || TILE_SIZE;
    this.pixelW = this.width * this.tileW;
    this.pixelH = this.height * this.tileH;
    this.layers = mapData.layers || [];
    this.zones = mapData.zones || [];
    this.desks = mapData.desks || [];
    this.collisions = new Set(mapData.collisions || []);

    // Pre-renderizar capas estaticas en offscreen canvases
    this.layerCaches = {};
    this.cacheLayers();
  }

  /** Pre-renderiza cada capa en un offscreen canvas grande */
  cacheLayers() {
    for (const layer of this.layers) {
      if (layer.type === 'entities') continue; // Capa dinamica, no cachear

      const canvas = document.createElement('canvas');
      canvas.width = this.pixelW;
      canvas.height = this.pixelH;
      const ctx = canvas.getContext('2d');

      const data = layer.data;
      for (let i = 0; i < data.length; i++) {
        const tileId = data[i];
        if (tileId === 0) continue; // Vacio

        const tx = (i % this.width) * this.tileW;
        const ty = Math.floor(i / this.width) * this.tileH;
        const tileCanvas = getTile(tileId);
        ctx.drawImage(tileCanvas, tx, ty);
      }

      this.layerCaches[layer.name] = canvas;
    }
  }

  /** Renderizar una capa cacheada (blit rapido) */
  renderLayer(ctx, camera, layerName) {
    const cached = this.layerCaches[layerName];
    if (!cached) return;

    // Solo dibujar la porcion visible (viewport clipping)
    const sx = Math.max(0, Math.floor(camera.x));
    const sy = Math.max(0, Math.floor(camera.y));
    const vw = Math.ceil(camera.viewW / camera.zoom);
    const vh = Math.ceil(camera.viewH / camera.zoom);
    const sw = Math.min(vw, this.pixelW - sx);
    const sh = Math.min(vh, this.pixelH - sy);

    if (sw > 0 && sh > 0) {
      ctx.drawImage(cached, sx, sy, sw, sh, sx, sy, sw, sh);
    }
  }

  /** Comprobar si una posicion world colisiona con un tile solido */
  isSolid(worldX, worldY) {
    const tx = Math.floor(worldX / this.tileW);
    const ty = Math.floor(worldY / this.tileH);
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return true;

    // Comprobar en todas las capas
    for (const layer of this.layers) {
      if (layer.type === 'entities') continue;
      const idx = ty * this.width + tx;
      const tileId = layer.data[idx];
      if (this.collisions.has(tileId)) return true;
    }
    return false;
  }

  /** Obtener la zona en la que esta un punto */
  getZoneAt(worldX, worldY) {
    for (const zone of this.zones) {
      if (
        worldX >= zone.x && worldX < zone.x + zone.w &&
        worldY >= zone.y && worldY < zone.y + zone.h
      ) {
        return zone;
      }
    }
    return null;
  }

  /** Obtener posicion world del centro de un desk */
  getDeskPosition(deskIndex) {
    const desk = this.desks[deskIndex];
    if (!desk) return null;
    return {
      x: desk.x * this.tileW + this.tileW,  // Centro del desk (2 tiles ancho)
      y: desk.y * this.tileH - 8,            // Justo encima del desk
    };
  }
}
