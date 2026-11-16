# Revisión de UX/UI y de flujos (2026-11-15)

Hecha recorriendo la app con Playwright en la pila de pruebas, a 1280×800 y a 390×844. No sale
scroll horizontal en ninguna pantalla. Cada punto está sin hacer hasta que se marque con ✅.

## Flujos

**P1**
1. ✅ **Invitación tapada.** El aviso «Te han invitado» queda debajo de la cabecera fija
   (`.invite-banner`, landing.css:382). Con invitación, abrir directamente «Únete a X».
2. ✅ **Botón principal de la portada.**
   - «Entrar a la oficina» abre el login, y una persona nueva recibe «No hay nadie con ese correo»
     sin forma de seguir.
   - Lo mejor sería un solo campo «Tu correo» que entre o registre según el caso. Como mínimo, el
     enlace cruzado entre login y registro.
3. ✅ **«Atrás» del navegador o de Android saca de la app.** Las vistas no tienen URL (App.js:21).
   Arreglo: `pushState` por vista, o al menos un `popstate` que vuelva a la oficina.
4. ✅ **«Cambiarme» en el organigrama actúa al primer toque.** Quita a alguien de su cargo sin
   avisar (OrgChart.js:46). Tiene que confirmar.
5. ✅ **El organigrama no se ve entero.**
   - En escritorio el árbol mide 1652 px: necesita «ajustar a pantalla» y zoom.
   - En móvil, mejor una lista sangrada con ramas plegables.
6. ✅ **«Puesto» de la ficha y cargo no coinciden.** Elegí QA y la ficha dice «Desarrollador», y la
   entrevista vuelve a preguntar «¿A qué te dedicas?». Hay que rellenar el puesto con el cargo, o
   renombrar el campo.

**P2**
7. ✅ Con una sola empresa, entrar directo en ella, sin pulsar «Entrar».
8. ✅ Quien crea la empresa, de CEO por defecto (con «Seguir como CEO» o elegir otro cargo antes de la entrevista).
9. ✅ «Invitar», en la cabecera del dueño, con valores por defecto, para copiar o compartir el
   enlace. Hoy está escondido en Empresa, en la quinta sección.
10. ✅ Fusionar 🌦️ Oficina y 🏢 Empresa en «Ajustes», y que no se vea si no eres el dueño.
11. Cosas que no casan:
    - ✅ el feed marca la hora real mientras el reloj de la oficina va movido;
    - ✅ el avatar dice «Luego viene la entrevista», pero antes vienen la empresa y el cargo;
    - ✅ en el avatar, «← Salir» cierra la sesión y es más grande que «Guardar».
12. ✅ Oficina en móvil:
    - el lienzo (390×254) queda tapado por la tarjeta del día y la lupa;
    - los 6 botones de la cabecera ocupan dos filas;
    - el feed queda a 1.300 px de scroll.

    Arreglo: barra inferior con pestañas (Oficina · Mi personaje · Sueño · Feed) y un menú «⋯».

**P3**
- En Pruebas, en móvil, la casilla «IA» no se explica.
- ✅ «16 De Noviembre» lleva «De» en mayúscula.
- ✅ Los nombres del organigrama se cortan aunque quepan.

## Visual

**P1**
- ✅ (botones) **Iconos:** todo son emojis, y la norma de la casa es Lucide. Además, «✏️ ➕ 🗑️» en cada tarjeta
  del organigrama hace ruido.
- ✅ **Foco:** no hay `:focus-visible` en ningún botón.

**P2**
- ✅ **Un solo botón primario por pantalla.** Hoy hay 15 «Cambiarme» en morado. Faltan una variante
  secundaria y una `btn-danger`. `.btn` y `.btn-sm` deberían pasar a global.css.
- ✅ **Tamaño táctil:** `.btn-sm` mide 26-28 px y los botones del organigrama, 22 px. El mínimo son 44.
- ✅ **Contraste:** `--text-muted` #6C6C8A da 3,4:1 en textos pequeños. Subirlo a ~#9494B4.
- ✅ **Tipografía:** (escala `--fs-xs/sm/md/lg` en global.css)
  - la pixel art solo en el logo y el reloj, con `nowrap`, porque hoy parte «Mad / Office»;
  - escala de 4 tamaños.
- ✅ **Avatar en móvil:**
  - las filas se salen de la tarjeta;
  - «1 / 4» y «1 / 6» tendrían que ser muestras de color.
- ✅ **Empresa:** (ahora «Ajustes»)
  - hay 3 «Guardar» distintos;
  - una etiqueta gris parece desactivada;
  - el calendario no tiene leyenda.

**P3**
- ✅ Las sugerencias del sueño, con borde discontinuo, parecen desactivadas.
- ✅ El campo de contraseña del login, plegado bajo «Tengo contraseña».

## Mayor impacto con menos esfuerzo
1. Invitación visible, que abra directamente el registro.
2. Un campo de correo único, o el enlace cruzado.
3. Confirmar «Cambiarme» y CEO por defecto.
4. Lucide, `:focus-visible` y un solo primario.
5. Organigrama en lista en móvil y botón «Invitar».

Capturas de la revisión: en `/tmp/claude-1000/ux/` (temporales). Las del antes y después de lo
hecho el 16-11: en `/tmp/claude-1000/ux2/`.
