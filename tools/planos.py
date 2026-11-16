#!/usr/bin/env python3
"""Genera las plantillas de oficina (backend/src/layouts/<id>.json) a partir de una descripción
por salas: cada sala es un rectángulo (interior) con su suelo; las paredes salen solas alrededor,
las puertas se marcan aparte y los muebles van con su casilla. La Clásica no sale de aquí (es la de
siempre, hecha a mano); estas sí: python3 tools/planos.py

Rejilla: '#' pared, '.' suelo, 'D' puerta, '=' tarima de terraza, ',' césped de fuera.
"""
import json, os, sys

OUT = os.path.join(os.path.dirname(__file__), '..', 'backend', 'src', 'layouts')


def build(spec):
    cols, rows = spec['cols'], spec['rows']
    out_from = spec.get('outdoorFromCol', cols)
    grid = [['#' if x < out_from else ',' for x in range(cols)] for _ in range(rows)]
    for r in spec['rooms']:
        ch = '=' if r['id'] == 'terraza' else '.'
        for y in range(r['y'], r['y'] + r['h']):
            for x in range(r['x'], r['x'] + r['w']):
                grid[y][x] = ch
    for x, y in spec['doors']:
        grid[y][x] = 'D'
    plan = {
        'id': spec['id'], 'name': spec['name'], 'description': spec['description'],
        'cols': cols, 'rows': rows, 'tile': 16, 'outdoorFromCol': out_from,
        'grid': [''.join(row) for row in grid],
        'rooms': spec['rooms'], 'desks': spec['desks'], 'zones': spec['zones'],
        'zoneSpots': spec.get('zoneSpots', {}), 'own': spec.get('own', {}), 'spots': spec.get('spots', {}),
        'objects': spec['objects'],
    }
    check(plan)
    return plan


def check(p):
    """Lo mínimo para no publicar un plano roto: nada de gente ni mesas sobre paredes."""
    g = p['grid']
    def floor(x, y, what):
        xi, yi = int(x), int(y)
        assert 0 <= yi < p['rows'] and 0 <= xi < p['cols'], f"{p['id']}: {what} fuera del plano ({x},{y})"
        assert g[yi][xi] in '.D=', f"{p['id']}: {what} sobre '{g[yi][xi]}' en ({x},{y})"
    for d in p['desks']:
        floor(d['x'], d['y'], 'mesa'); floor(d['x'] + 1, d['y'], 'mesa'); floor(d['x'] + 1, d['y'] - 1, 'silla de la mesa')
    for name, z in p['zones'].items():
        for y in range(z['y'], z['y'] + z['h']):
            for x in range(z['x'], z['x'] + z['w']):
                floor(x, y, f'zona {name}')
    for group in ('zoneSpots', 'own', 'spots'):
        for name, lst in p[group].items():
            for x, y in lst:
                floor(x, y, f'{group}.{name}')
    for o in p['objects']:
        if o['type'].startswith('wall_') or o['type'] in ('tv', 'string_lights', 'tree'):
            continue
        floor(o['x'], o['y'], o['type'])


def room(id_, label, x, y, w, h, floor, wall):
    return {'id': id_, 'label': label, 'x': x, 'y': y, 'w': w, 'h': h, 'floor': floor, 'wall': wall}


# ---------- Loft: para ~8, todo a la vista, sin despacho ni terraza ----------
def loft():
    desks = [{'x': x, 'y': y} for y in (4, 8, 12) for x in (2, 7, 11)][:8]
    objs = [
        {'type': 'rug', 'x': 18, 'y': 11, 'w': 4, 'h': 3, 'color': '#C2477A'},
        *[{'type': 'office_chair', 'x': d['x'], 'y': d['y'] - 1, 'w': 2} for d in desks],
        *[{'type': 'desk', 'x': d['x'], 'y': d['y'], 'w': 2} for d in desks],
        {'type': 'wall_window', 'x': 3, 'y': 0, 'w': 2}, {'type': 'wall_window', 'x': 9, 'y': 0, 'w': 2},
        {'type': 'wall_art', 'x': 14, 'y': 0}, {'type': 'wall_kanban', 'x': 6, 'y': 0, 'w': 2},
        {'type': 'kanban', 'x': 14, 'y': 4, 'w': 2}, {'type': 'printer', 'x': 14, 'y': 12},
        {'type': 'water_cooler', 'x': 14, 'y': 15}, {'type': 'rack', 'x': 1, 'y': 15},
        {'type': 'plant_big', 'x': 1, 'y': 1}, {'type': 'plant', 'x': 15, 'y': 1}, {'type': 'plant', 'x': 5, 'y': 15},
        {'type': 'lamp', 'x': 9, 'y': 15},
        # cocina (isla y barra)
        {'type': 'kitchen_counter', 'x': 17, 'y': 1, 'w': 5}, {'type': 'fridge', 'x': 22, 'y': 1}, {'type': 'vending', 'x': 23, 'y': 1},
        {'type': 'wall_menu', 'x': 25, 'y': 0}, {'type': 'stools', 'x': 18, 'y': 3, 'w': 3},
        {'type': 'kitchen_table', 'x': 18, 'y': 4, 'w': 3}, {'type': 'stools', 'x': 18, 'y': 5, 'w': 3}, {'type': 'plant', 'x': 26, 'y': 6},
        # zona chill
        {'type': 'tv', 'x': 18, 'y': 8, 'w': 2}, {'type': 'console', 'x': 18, 'y': 9, 'w': 2}, {'type': 'sofa', 'x': 18, 'y': 10, 'w': 3},
        {'type': 'beanbag', 'x': 21, 'y': 14}, {'type': 'plant_big', 'x': 17, 'y': 15},
        # baños
        {'type': 'stall', 'x': 24, 'y': 9}, {'type': 'stall', 'x': 25, 'y': 9}, {'type': 'stall', 'x': 26, 'y': 9},
        {'type': 'urinal', 'x': 26, 'y': 12}, {'type': 'sink_side', 'x': 24, 'y': 15},
    ]
    return build({
        'id': 'loft', 'name': 'Loft', 'cols': 28, 'rows': 18,
        'description': 'Pequeño y con encanto: 8 mesas a la vista, isla de cocina, sofá con consola y un solo baño. Sin despacho: aquí el jefe se sienta con todos.',
        'rooms': [
            room('openspace', 'Loft', 1, 1, 15, 16, 'wood', '#E9DCC8'),
            room('cocina', 'Cocina', 17, 1, 10, 7, 'tiles', '#F0E6D6'),
            room('descanso', 'Zona chill', 17, 9, 6, 8, 'wood', '#E4D3EE'),
            room('banos', 'Baño', 24, 9, 3, 8, 'bath', '#CFE6EA'),
        ],
        'doors': [(16, 4), (16, 12), (23, 12), (8, 17)],
        'desks': desks,
        'zones': {'cafe': {'x': 18, 'y': 6, 'w': 6, 'h': 1}, 'descanso': {'x': 18, 'y': 12, 'w': 4, 'h': 3}, 'lavabo': {'x': 25, 'y': 11, 'w': 1, 'h': 4}},
        'zoneSpots': {'lavabo': [[24, 11], [25, 13], [26, 15]]},
        'spots': {'impresora': [[14, 13]], 'fuente': [[13, 15]], 'kanban': [[14, 6]], 'maquina': [[23, 2]], 'consola': [[18.5, 10], [19.5, 10]]},
        'objects': objs,
    })


# ---------- Cubículos: para ~12, la oficina de antes, con mamparas ----------
def cubiculos():
    desks = [{'x': x, 'y': y} for y in (4, 9, 14, 19) for x in (3, 9, 15)]
    cubs = [{'type': 'cubicle', 'x': d['x'] - 1, 'y': d['y'] - 2, 'w': 4, 'h': 4} for d in desks]
    objs = [
        *cubs,
        *[{'type': 'office_chair', 'x': d['x'], 'y': d['y'] - 1, 'w': 2} for d in desks],
        *[{'type': 'desk', 'x': d['x'], 'y': d['y'], 'w': 2} for d in desks],
        {'type': 'wall_window', 'x': 5, 'y': 0, 'w': 2}, {'type': 'wall_window', 'x': 13, 'y': 0, 'w': 2},
        {'type': 'wall_clock', 'x': 10, 'y': 0}, {'type': 'printer', 'x': 20, 'y': 8}, {'type': 'water_cooler', 'x': 20, 'y': 13},
        {'type': 'rack', 'x': 21, 'y': 1}, {'type': 'plant', 'x': 1, 'y': 21}, {'type': 'plant', 'x': 21, 'y': 21}, {'type': 'lamp', 'x': 20, 'y': 17},
        # reuniones
        {'type': 'wall_screen', 'x': 26, 'y': 0, 'w': 3}, {'type': 'chairs_row', 'x': 25, 'y': 2, 'w': 6},
        {'type': 'meeting_table', 'x': 25, 'y': 3, 'w': 6, 'h': 1},
        # despacho
        {'type': 'office_chair', 'x': 26, 'y': 8, 'w': 3, 'color': 'boss'}, {'type': 'boss_desk', 'x': 26, 'y': 9, 'w': 3},
        {'type': 'guest_chair', 'x': 26, 'y': 11}, {'type': 'guest_chair', 'x': 28, 'y': 11}, {'type': 'bookshelf', 'x': 31, 'y': 8, 'w': 2},
        # cocina pequeña
        {'type': 'kitchen_counter', 'x': 24, 'y': 14, 'w': 4}, {'type': 'vending', 'x': 28, 'y': 14}, {'type': 'fridge', 'x': 29, 'y': 14},
        {'type': 'kitchen_table', 'x': 25, 'y': 16, 'w': 3},
        # baños
        {'type': 'stall', 'x': 24, 'y': 19}, {'type': 'stall', 'x': 25, 'y': 19}, {'type': 'urinal', 'x': 32, 'y': 20},
        {'type': 'sink_side', 'x': 27, 'y': 21},
    ]
    return build({
        'id': 'cubiculos', 'name': 'Cubículos', 'cols': 34, 'rows': 24,
        'description': 'La oficina de antes: 12 cubículos con mamparas grises, sala de reuniones, despacho del jefe, cocina pequeña y baños al fondo. Sin terraza ni zona chill.',
        'rooms': [
            room('openspace', 'Cubículos', 1, 1, 21, 22, 'carpet', '#D9D4C7'),
            room('reuniones', 'Sala de reuniones', 23, 1, 10, 5, 'carpet', '#D9C7A8'),
            room('despacho', 'Despacho del jefe', 23, 7, 10, 5, 'parquet', '#D9C7A8'),
            room('cocina', 'Cocina', 23, 13, 10, 4, 'tiles', '#F0E6D6'),
            room('banos', 'Baños', 23, 18, 10, 5, 'bath', '#CFE6EA'),
        ],
        'doors': [(22, 3), (22, 9), (22, 15), (22, 20), (11, 23)],
        'desks': desks,
        'zones': {
            'reuniones': {'x': 25, 'y': 4, 'w': 6, 'h': 1}, 'despacho': {'x': 25, 'y': 11, 'w': 6, 'h': 1},
            'cafe': {'x': 24, 'y': 15, 'w': 8, 'h': 1}, 'lavabo': {'x': 28, 'y': 20, 'w': 4, 'h': 2},
        },
        'own': {'despacho': [[27, 9]]},
        'zoneSpots': {'despacho': [[26, 11], [28, 11]], 'reuniones': [[25, 4], [27, 4], [29, 4], [31, 4]]},
        'spots': {'impresora': [[20, 9]], 'fuente': [[20, 14]], 'maquina': [[28, 15]]},
        'objects': objs,
    })


# ---------- Planta grande: para ~30, de todo y de lujo ----------
def planta():
    desks = [{'x': x, 'y': y} for y in (14, 17, 20, 23, 26, 29) for x in (2, 7, 12, 17, 22)]
    objs = [
        {'type': 'rug', 'x': 11, 'y': 4, 'w': 5, 'h': 3, 'color': '#8E3B46'},
        {'type': 'rug', 'x': 29, 'y': 23, 'w': 4, 'h': 3, 'color': '#4E7FB8'},
        *[{'type': 'office_chair', 'x': d['x'], 'y': d['y'] - 1, 'w': 2} for d in desks],
        *[{'type': 'desk', 'x': d['x'], 'y': d['y'], 'w': 2} for d in desks],
        {'type': 'office_chair', 'x': 2, 'y': 3, 'w': 4},
        # recepción
        {'type': 'counter', 'x': 2, 'y': 4, 'w': 4}, {'type': 'armchair', 'x': 6, 'y': 6}, {'type': 'armchair', 'x': 7, 'y': 6},
        {'type': 'wall_logo', 'x': 2, 'y': 0, 'w': 3}, {'type': 'plant_big', 'x': 1, 'y': 1}, {'type': 'plant', 'x': 8, 'y': 7},
        # despacho
        {'type': 'office_chair', 'x': 12, 'y': 2, 'w': 3, 'color': 'boss'}, {'type': 'boss_desk', 'x': 12, 'y': 3, 'w': 3},
        {'type': 'guest_chair', 'x': 12, 'y': 5}, {'type': 'guest_chair', 'x': 14, 'y': 5}, {'type': 'bookshelf', 'x': 15, 'y': 1, 'w': 2},
        {'type': 'trophy', 'x': 16, 'y': 6}, {'type': 'wall_window', 'x': 12, 'y': 0, 'w': 2},
        # reuniones
        {'type': 'wall_screen', 'x': 22, 'y': 0, 'w': 3}, {'type': 'wall_window', 'x': 19, 'y': 0, 'w': 2},
        {'type': 'chairs_row', 'x': 20, 'y': 2, 'w': 8}, {'type': 'meeting_table', 'x': 20, 'y': 3, 'w': 8, 'h': 2},
        {'type': 'chairs_row', 'x': 20, 'y': 5, 'w': 8}, {'type': 'plant', 'x': 28, 'y': 7},
        # servidores
        *[{'type': 'rack', 'x': x, 'y': 1} for x in range(31, 36)], {'type': 'cable_floor', 'x': 31, 'y': 2, 'w': 5},
        {'type': 'ac_unit', 'x': 36, 'y': 1}, {'type': 'small_desk', 'x': 33, 'y': 5, 'w': 2},
        # pasillo y open space
        {'type': 'wall_art', 'x': 4, 'y': 8}, {'type': 'wall_screen', 'x': 14, 'y': 8, 'w': 3}, {'type': 'wall_art', 'x': 30, 'y': 8},
        {'type': 'water_cooler', 'x': 19, 'y': 9}, {'type': 'kanban', 'x': 24, 'y': 12, 'w': 2}, {'type': 'printer', 'x': 24, 'y': 16},
        {'type': 'plant_big', 'x': 1, 'y': 12}, {'type': 'plant', 'x': 26, 'y': 30}, {'type': 'plant', 'x': 1, 'y': 30}, {'type': 'lamp', 'x': 26, 'y': 21},
        # cocina grande
        {'type': 'kitchen_counter', 'x': 28, 'y': 12, 'w': 8}, {'type': 'fridge', 'x': 36, 'y': 12}, {'type': 'vending', 'x': 37, 'y': 12},
        {'type': 'vending', 'x': 38, 'y': 12}, {'type': 'wall_menu', 'x': 40, 'y': 11},
        {'type': 'stools', 'x': 29, 'y': 14, 'w': 3}, {'type': 'kitchen_table', 'x': 29, 'y': 15, 'w': 3}, {'type': 'stools', 'x': 29, 'y': 16, 'w': 3},
        {'type': 'stools', 'x': 35, 'y': 14, 'w': 3}, {'type': 'kitchen_table', 'x': 35, 'y': 15, 'w': 3}, {'type': 'stools', 'x': 35, 'y': 16, 'w': 3},
        {'type': 'plant_big', 'x': 41, 'y': 18},
        # zona chill
        {'type': 'tv', 'x': 30, 'y': 20, 'w': 2}, {'type': 'console', 'x': 30, 'y': 21, 'w': 2}, {'type': 'sofa', 'x': 29, 'y': 22, 'w': 4},
        {'type': 'coffee_table', 'x': 30, 'y': 24, 'w': 2}, {'type': 'pingpong', 'x': 34, 'y': 25, 'w': 2, 'h': 2},
        {'type': 'beanbag', 'x': 29, 'y': 28}, {'type': 'beanbag', 'x': 31, 'y': 28, 'color': '#E1A23B'}, {'type': 'plant', 'x': 36, 'y': 30},
        # baños
        *[{'type': 'stall', 'x': x, 'y': 21} for x in range(38, 42)],
        *[{'type': 'urinal', 'x': 41, 'y': y} for y in (24, 25, 26)], {'type': 'sink_side', 'x': 38, 'y': 28}, {'type': 'sink_side', 'x': 38, 'y': 29},
        # terraza
        {'type': 'string_lights', 'x': 44, 'y': 1, 'w': 6}, {'type': 'string_lights', 'x': 44, 'y': 16, 'w': 6},
        *[{'type': 'planter', 'x': x, 'y': y} for y in (2, 8, 14, 20, 26) for x in (44, 49)],
        {'type': 'terrace_table', 'x': 46, 'y': 5, 'w': 2}, {'type': 'terrace_table', 'x': 46, 'y': 12, 'w': 2},
        {'type': 'terrace_table', 'x': 46, 'y': 23, 'w': 2}, {'type': 'bench', 'x': 45, 'y': 18, 'w': 3}, {'type': 'bench', 'x': 45, 'y': 29, 'w': 3},
        *[{'type': 'tree', 'x': 50, 'y': y} for y in range(0, 32, 4)],
    ]
    return build({
        'id': 'planta', 'name': 'Planta grande', 'cols': 52, 'rows': 32, 'outdoorFromCol': 43,
        'description': 'Para ~30 y con lujos: recepción, despacho con alfombra, sala de reuniones grande, cocina con dos mesas y dos máquinas, zona chill con ping-pong y consola, cuatro baños y una terraza larga.',
        'rooms': [
            room('recepcion', 'Recepción', 1, 1, 8, 7, 'marble', '#E7E0D2'),
            room('despacho', 'Despacho del jefe', 10, 1, 8, 7, 'parquet', '#D9C7A8'),
            room('reuniones', 'Sala de reuniones', 19, 1, 10, 7, 'wood', '#E3E7EE'),
            room('servidores', 'Servidores', 30, 1, 8, 7, 'server', '#B9C0CD'),
            room('pasillo', '', 1, 9, 41, 2, 'wood', '#E9DCC8'),
            room('openspace', 'Open space', 1, 12, 26, 19, 'carpet', '#E6E8EE'),
            room('cocina', 'Cocina', 28, 12, 14, 7, 'tiles', '#F0E6D6'),
            room('descanso', 'Zona chill', 28, 20, 9, 11, 'wood', '#E4D3EE'),
            room('banos', 'Baños', 38, 20, 4, 11, 'bath', '#CFE6EA'),
            room('terraza', 'Terraza', 43, 1, 7, 30, 'deck', '#C9A06A'),
        ],
        'doors': [(5, 8), (13, 8), (14, 8), (23, 8), (24, 8), (33, 8), (13, 11), (14, 11), (34, 11), (27, 20), (37, 24), (42, 9), (42, 10), (13, 31)],
        'desks': desks,
        'zones': {
            'recepcion': {'x': 2, 'y': 5, 'w': 5, 'h': 2}, 'despacho': {'x': 11, 'y': 5, 'w': 5, 'h': 2},
            'reuniones': {'x': 20, 'y': 6, 'w': 8, 'h': 1}, 'servidores': {'x': 31, 'y': 4, 'w': 6, 'h': 2},
            'cafe': {'x': 29, 'y': 17, 'w': 12, 'h': 2}, 'descanso': {'x': 29, 'y': 26, 'w': 4, 'h': 3},
            'lavabo': {'x': 39, 'y': 23, 'w': 2, 'h': 5}, 'terraza': {'x': 45, 'y': 3, 'w': 4, 'h': 26},
        },
        'own': {'despacho': [[13, 3]], 'recepcion': [[3.5, 4]]},
        'zoneSpots': {'despacho': [[12, 5], [14, 5], [13, 6]], 'recepcion': [[6, 6], [7, 6], [4, 6]]},
        'spots': {'impresora': [[24, 17]], 'fuente': [[19, 10]], 'kanban': [[25, 13]], 'maquina': [[37, 13]],
                  'pingpong': [[34.5, 24], [34.5, 27]], 'consola': [[29.5, 22], [30.5, 22]]},
        'objects': objs,
    })


if __name__ == '__main__':
    for gen in (loft, cubiculos, planta):
        p = gen()
        path = os.path.join(OUT, f"{p['id']}.json")
        with open(path, 'w') as f:
            json.dump(p, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print(f"{p['id']}: {p['cols']}×{p['rows']}, {len(p['desks'])} mesas, {len(p['objects'])} muebles → {os.path.relpath(path)}")
