#!/usr/bin/env bash
# Prueba por API de la puerta, la entrada con invitación y contraseña propia, y el modo pruebas.
# Contra una pila APARTE con la puerta encendida y vacía (nunca contra la oficina de verdad):
#   docker compose -p mad-office-puerta --env-file puerta.env up -d --build   (GATE=on, GATE_INSECURE_COOKIE=true)
#   printf 'clave-de-prueba-123\n' | docker compose -p mad-office-puerta --env-file puerta.env exec -T backend node src/cli.js clave
#   BASE=http://localhost:8084 tests/puerta-y-pruebas.sh
# Cada línea dice qué se espera; el script falla si algún código no cuadra.
set -u
R=$(mktemp); trap "rm -f $R" EXIT; fallos=0
B=${BASE:-http://localhost:8084}/api; J='Content-Type: application/json'; CK=$(mktemp)
st() { curl -s -o $R -w '%{http_code}' "$@"; }
# ok <n> <esperado> <obtenido> <texto>
ok() { if [[ "$3" == "$2"* ]]; then echo "  ✓ $1 $4"; else echo "  ✗ $1 $4: esperaba $2, salió $3"; fallos=1; fi; }
c=$(st -X POST -H "$J" -d '{"email":"a@b.es","name":"X","password":"12345678"}' $B/auth/register); ok 1 403 "$c" "registro sin puerta ni invitación"
c=$(st -c $CK -X POST -H "$J" -d '{"password":"clave-de-prueba-123"}' $B/gate); ok 2 200 "$c" "puerta"
c=$(st -b $CK -X POST -H "$J" -d '{"email":"dueno@x.es","name":"Dueño"}' $B/auth/register); ok 3 201 "$c" "dueño se registra con puerta"
OT=$(python3 -c "import json;print(json.load(open('$R'))['token'])")
A="Authorization: Bearer $OT"
c=$(st -H "$A" $B/me); ok 4 200 "$c" "dueño, /me con su sesión y SIN cookie"
st -H "$A" -X POST -H "$J" -d '{"days":7,"max_uses":5}' $B/companies/1/invitations >/dev/null
CODE=$(python3 -c "import json;print(json.load(open('$R'))['code'])")
c=$(st $B/invitations/$CODE); ok 5 200 "$c" "ver invitación sin puerta"
c=$(st -X POST -H "$J" -d "{\"email\":\"compi@x.es\",\"name\":\"Compi\",\"invite\":\"$CODE\"}" $B/auth/register); ok 6 400 "$c" "registro con invitación sin contraseña"; echo "    $(cat $R)"
c=$(st -X POST -H "$J" -d "{\"email\":\"compi@x.es\",\"name\":\"Compi\",\"invite\":\"$CODE\",\"password\":\"compi-pass-1\"}" $B/auth/register); ok 7 201 "$c" "registro con invitación y contraseña"
CT=$(python3 -c "import json;print(json.load(open('$R'))['token'])")
c=$(st -H "Authorization: Bearer $CT" $B/me); ok 8 200 "$c" "compi /me sin cookie"; echo "    $(python3 -c "import json;d=json.load(open('$R'));print([c['name'] for c in d['companies']])")"
c=$(st -X POST -H "$J" -d '{"email":"compi@x.es"}' $B/auth/login); ok 9 401 "$c" "entrar solo con correo, fuera"
c=$(st -X POST -H "$J" -d '{"email":"compi@x.es","password":"compi-pass-1"}' $B/auth/login); ok 10 200 "$c" "entrar con contraseña"
c=$(st -X POST -H "$J" -d '{"email":"dueno@x.es"}' $B/auth/login); ok 11 401 "$c" "dueño sin contraseña, fuera"
c=$(st -b $CK -X POST -H "$J" -d '{"email":"dueno@x.es"}' $B/auth/login); ok 12 200 "$c" "dueño sin contraseña, con puerta"
c=$(st -H "Authorization: Bearer $CT" $B/companies/1/pruebas); ok 13 403 "$c" "compi al modo pruebas"
c=$(st -H "$A" -X POST -H "$J" -d '{"name":"Probador"}' $B/companies/1/pruebas/jugadores); ok 14 201 "$c" "dueño crea jugador"; echo "    $(python3 -c "import json;d=json.load(open('$R'));print(d['players'])")"
PID=$(python3 -c "import json;print(json.load(open('$R'))['players'][0]['id'])")
c=$(st -H "$A" -X PUT -H "$J" -d '{"hhmm":"11:30","day":"laborable","speed":10}' $B/companies/1/pruebas/reloj); ok 15 200 "$c" "reloj a laborable 11:30 ×10"; echo "    $(python3 -c "import json;d=json.load(open('$R'));print(d['now'],d['moved'],d['speed'])")"
c=$(st -H "$A" -X POST $B/companies/1/pruebas/jugadores/$PID/entrar); ok 16 200 "$c" "entrar como jugador"
PT=$(python3 -c "import json;print(json.load(open('$R'))['token'])")
c=$(st -H "Authorization: Bearer $PT" $B/companies/1/me); ok 17 200 "$c" "jugador /me"; echo "    $(python3 -c "import json;d=json.load(open('$R'));print(d['character']['name'],d['character']['approved'])")"
c=$(st -b $CK -X POST -H "$J" -d "{\"email\":\"x\"}" $B/auth/login); ok 18 401 "$c" "jugador no entra por login"
for i in 1 2 3 4 5; do st -X POST -H "$J" -d '{"email":"compi@x.es","password":"mal-mal-mal"}' $B/auth/login >/dev/null; done
c=$(st -X POST -H "$J" -d '{"email":"compi@x.es","password":"compi-pass-1"}' $B/auth/login); ok 19 429 "$c" "tras 5 fallos"
c=$(st -H "$A" -X DELETE $B/companies/1/pruebas/jugadores/$PID); ok 20 200 "$c" "borrar jugador"; echo "    $(python3 -c "import json;print(json.load(open('$R'))['players'])")"
c=$(st -H "$A" -X PUT -H "$J" -d '{"reset":true}' $B/companies/1/pruebas/reloj); ok 21 200 "$c" "reloj real"; echo "    $(python3 -c "import json;d=json.load(open('$R'));print(d['now'],d['moved'])")"
# Interruptor del modo pruebas: apagado vuelve a la hora real y pausa a los jugadores de prueba.
st -H "$A" -X POST -H "$J" -d '{"name":"Pausable"}' $B/companies/1/pruebas/jugadores >/dev/null
st -H "$A" -X PUT -H "$J" -d '{"hhmm":"11:30","day":"laborable","speed":5}' $B/companies/1/pruebas/reloj >/dev/null
c=$(st -H "$A" -X PUT -H "$J" -d '{"on":false}' $B/companies/1/pruebas/modo); ok 22 200 "$c" "apagar modo pruebas"
python3 -c "import json;d=json.load(open('$R'));assert d['active'] is False and d['moved'] is False, d" && echo "    apagado: hora real" || { echo "  ✗ sigue con el reloj movido"; fallos=1; }
c=$(st -H "$A" $B/companies/1/org); python3 -c "import json;d=json.load(open('$R'));names=[h['name'] for p in d['positions'] for h in p['holders']];assert 'Pausable' not in names, names" && echo "    el jugador de prueba no está en la oficina" || { echo "  ✗ el jugador pausado sigue en el organigrama"; fallos=1; }
c=$(st -H "$A" -X PUT -H "$J" -d '{"on":true}' $B/companies/1/pruebas/modo); ok 23 200 "$c" "encender modo pruebas"
c=$(st -H "$A" $B/companies/1/org); python3 -c "import json;d=json.load(open('$R'));names=[h['name'] for p in d['positions'] for h in p['holders']];assert 'Pausable' in names, names" && echo "    vuelve" || { echo "  ✗ no vuelve al encender"; fallos=1; }

# Sin despertador, rehacer la ficha no gasta intentos: se reutiliza el turno que espera en la cola.
IV='{"answers":{"a":"La montaña","b":"Café","c":"Programar"}}'
T1=""; for i in 24 25 26 27; do
  c=$(st -H "$A" -X POST -H "$J" -d "$IV" $B/companies/1/me/interview); ok $i 202 "$c" "entrevista nº$((i-23)) sin despertador"
  T=$(python3 -c "import json;print(json.load(open('$R')).get('turnId'))"); [ -z "$T1" ] && T1=$T
  [ "$T" = "$T1" ] && echo "    mismo turno ($T), quedan $(python3 -c "import json;print(json.load(open('$R'))['attemptsLeft'])")" || { echo "  ✗ turno nuevo $T (esperaba $T1)"; fallos=1; }
done
rm -f $CK
exit $fallos
