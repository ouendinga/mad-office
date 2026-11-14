#!/usr/bin/env python3
# Genera frontend/src/assets/maps/office.json: rejilla (# pared, . suelo, D puerta, = tarima, , césped),
# salas, mesas, zonas y muebles. Tras cambiarlo: actualizar backend/src/world/places.js (lo vigila
# backend/test/places.test.js). Uso: python3 frontend/scripts/genmap.py frontend/src/assets/maps/office.json
import json, sys
W, H = 40, 26
g = [[' ' for _ in range(W)] for _ in range(H)]
def rect(x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            g[y][x] = c
# Edificio x0..31, y0..25: todo suelo y luego paredes
rect(0, 0, 31, 25, '.')
for x in range(0, 32): g[0][x] = '#'; g[25][x] = '#'
for y in range(0, 26): g[y][0] = '#'; g[y][31] = '#'
# Fila de salas de arriba (y1..7) cerrada por la pared y=8
for x in range(0, 32): g[8][x] = '#'
for y in range(1, 8):
    for x in (8, 15, 24): g[y][x] = '#'
# Puertas de las salas de arriba al pasillo
for x in (4, 11, 12, 19, 20, 27): g[8][x] = 'D'
# Cocina (x20..30, y12..17): pared arriba y=11, a la izquierda x=19, abajo y=18
for x in range(19, 32): g[11][x] = '#'; g[18][x] = '#'
for y in range(11, 26): g[y][19] = '#'
for x in (24, 25): g[11][x] = 'D'      # cocina <- pasillo
for y in (14, 15): g[y][19] = 'D'      # cocina <- open space
for x in (22, 23): g[18][x] = 'D'      # descanso <- cocina
for y in range(18, 26): g[y][27] = '#' # baños a la derecha
g[21][27] = 'D'
for y in (22, 23): g[y][19] = 'D'      # descanso <- open space
# Salida a la terraza y entrada principal
for y in (9, 10): g[y][31] = 'D'
for x in (9, 10): g[25][x] = 'D'
# Exterior: terraza x32..37, césped x38..39
rect(32, 0, 39, 25, ',')
rect(32, 1, 37, 24, '=')
rows = [''.join(r) for r in g]
for r in rows: assert len(r) == W
rooms = [
    {"id": "recepcion", "label": "Recepción", "x": 1, "y": 1, "w": 7, "h": 7, "floor": "marble", "wall": "#E7E0D2"},
    {"id": "despacho", "label": "Despacho del jefe", "x": 9, "y": 1, "w": 6, "h": 7, "floor": "parquet", "wall": "#D9C7A8"},
    {"id": "reuniones", "label": "Sala de reuniones", "x": 16, "y": 1, "w": 8, "h": 7, "floor": "wood", "wall": "#DDE6EC"},
    {"id": "servidores", "label": "Servidores", "x": 25, "y": 1, "w": 6, "h": 7, "floor": "server", "wall": "#A9B3C2"},
    {"id": "pasillo", "label": "", "x": 1, "y": 9, "w": 30, "h": 2, "floor": "wood", "wall": "#E9DFCC"},
    {"id": "openspace", "label": "Open space", "x": 1, "y": 11, "w": 18, "h": 14, "floor": "carpet", "wall": "#E9DFCC"},
    {"id": "cocina", "label": "Cocina", "x": 20, "y": 12, "w": 11, "h": 6, "floor": "tiles", "wall": "#F2E6C9"},
    {"id": "descanso", "label": "Zona chill", "x": 20, "y": 19, "w": 7, "h": 6, "floor": "wood", "wall": "#E4D3EE"},
    {"id": "banos", "label": "Baños", "x": 28, "y": 19, "w": 3, "h": 6, "floor": "bath", "wall": "#CFE6EA"},
    {"id": "terraza", "label": "Terraza", "x": 32, "y": 1, "w": 6, "h": 24, "floor": "deck", "wall": None},
]
desks = []
for row in (13, 16, 19, 22):
    for x in (2, 6, 10, 14):
        desks.append({"x": x, "y": row})
O = []
def o(t, x, y, **k): O.append({"type": t, "x": x, "y": y, **k})
# Recepción
o("counter", 2, 4, w=4); o("plant_big", 1, 1); o("plant", 7, 7); o("armchair", 5, 6); o("armchair", 6, 6)
o("wall_logo", 2, 0, w=3); o("wall_window", 6, 0)
# Despacho del jefe
o("rug", 9, 4, w=6, h=3, color="#8E3B46"); o("boss_desk", 10, 3, w=3); o("bookshelf", 13, 1, w=2)
o("plant_big", 9, 1); o("trophy", 14, 6); o("wall_window", 11, 0, w=2)
# Reuniones
o("meeting_table", 17, 3, w=6, h=2); o("wall_window", 16, 0, w=2); o("wall_screen", 18, 0, w=3); o("wall_kanban", 22, 0, w=2)
o("plant", 16, 1); o("plant", 23, 7); o("chairs_row", 17, 2, w=6); o("chairs_row", 17, 5, w=6)
# Servidores
for x in (25, 26, 27, 28, 29): o("rack", x, 1)
o("ac_unit", 30, 1); o("cable_floor", 25, 4, w=5); o("small_desk", 28, 6, w=2)
# Pasillo
o("water_cooler", 15, 9)
# Pared del pasillo (fila 8): pantallas con métricas, cuadros y kanban del equipo
o("wall_screen", 13, 8, w=3); o("wall_art", 2, 8); o("wall_art", 7, 8); o("wall_kanban", 22, 8, w=2)
o("wall_screen", 28, 8, w=2); o("wall_art", 17, 8)
# Más ventanas al exterior
# Open space
for d in desks: o("desk", d["x"], d["y"], w=2)
o("kanban", 17, 12, w=2); o("plant_big", 1, 23); o("plant_big", 17, 23); o("plant", 1, 17)
o("plant", 9, 24); o("lamp", 17, 18); o("printer", 17, 15)
# Cocina
o("kitchen_counter", 20, 12, w=6); o("fridge", 26, 12); o("vending", 27, 12); o("plant_big", 30, 12)
o("kitchen_table", 22, 15, w=3); o("stools", 22, 14, w=3); o("stools", 22, 16, w=3)
o("wall_clock", 29, 11); o("wall_menu", 21, 11, w=2)
# Zona chill
o("rug", 21, 21, w=5, h=3, color="#4E7FB8"); o("sofa", 21, 20, w=3); o("tv", 22, 18, w=2)
o("beanbag", 25, 22); o("beanbag", 21, 23, color="#E1A23B"); o("plant_big", 20, 19); o("plant", 26, 24); o("coffee_table", 22, 22, w=2)
# Baños
o("sink", 28, 19); o("sink", 29, 19); o("stall", 30, 19); o("plant", 28, 24)
# Terraza
for y in (2, 7, 12, 17, 22): o("planter", 32, y); o("planter", 37, y)
o("terrace_table", 34, 5, w=2); o("terrace_table", 34, 15, w=2); o("bench", 33, 10, w=3); o("bench", 33, 20, w=3)
for y in (0, 4, 8, 12, 16, 20, 24): o("tree", 38, y)
o("string_lights", 32, 1, w=6); o("string_lights", 32, 13, w=6)
zones = {
    "recepcion": {"x": 2, "y": 5, "w": 5, "h": 2},
    "despacho": {"x": 10, "y": 5, "w": 4, "h": 2},
    "reuniones": {"x": 17, "y": 2, "w": 6, "h": 4},
    "servidores": {"x": 25, "y": 4, "w": 5, "h": 2},
    "cafe": {"x": 21, "y": 14, "w": 8, "h": 3},
    "descanso": {"x": 21, "y": 21, "w": 5, "h": 3},
    "lavabo": {"x": 28, "y": 21, "w": 3, "h": 3},
    "terraza": {"x": 33, "y": 3, "w": 4, "h": 20},
}
json.dump({"cols": W, "rows": H, "tile": 16, "grid": rows, "rooms": rooms, "desks": desks, "zones": zones, "objects": O},
          open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
print('\n'.join(rows))
