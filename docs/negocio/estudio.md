# Mad Office como negocio: estudio de viabilidad (2026-11-14)

Hecho con las skills `nuevo-proyecto`, `viabilidad` y `consulta-registros`. Los números del caso
de pago los calcula `kpi.js` a partir de [caso.json](caso.json), y la salida completa está en
[kpi.md](kpi.md). Etiquetas: ✅ fuente primaria · 🔶 fuente secundaria o con cifras dispares ·
⚠️ sin comprobar o corazonada.

## Veredicto

| Pregunta | Veredicto |
|---|---|
| **¿Sacarle dinero ahora?** | ⏸️ **APARCADO, con condición de reapertura** (abajo). No es un no-go, porque el hueco existe, pero hoy no hay comprador que pague ni canal para llegar a él. |
| **¿Cómo usarlo ya?** | 🟢 **Interno en Walmeric**, como iniciativa personal de Álvaro: con invitación, voluntario, cada uno hace y aprueba su propia caricatura y sin datos de la empresa. Pasa a ser la prueba de 0 € del negocio. |
| **¿Usarlo en RRHH para medir o vigilar al equipo?** | 🔴 **NO-GO.** |
| **¿Usarlo para seleccionar personal?** | 🔴 **NO-GO.** El AI Act lo clasifica como alto riesgo y una caricatura cómica no es una evaluación. |
| **¿Comprar `madoffice.app` ya?** | **No hace falta todavía.** Ver «Nombre y dominio». |
| **¿Enlace mágico por correo?** | **Sí, y antes de invitar a nadie, aunque solo sea uso interno.** La alternativa sería repartir a los compañeros la contraseña común de los paneles de Álvaro, que abre todos sus paneles. |

## Las preguntas literales de Álvaro

1. **«¿Podemos sacar provecho económico?»** Hoy no compensa. Vendido por suscripción a empresas
   (49 €/mes con IVA, hasta 20 personas), sale **8 €/hora invertida** a 24 meses, y el break-even
   contando su tiempo **no llega en 24 meses en ningún escenario de sensibilidad**, ni con el
   precio +50 % ni con los clientes +50 % ([kpi.md](kpi.md)). La caja sí se cubre en el mes 8, pero
   con un coste fijo casi nulo eso no dice nada.
2. **«¿Merece la pena comprar el dominio?»** Todavía no, aunque cuesta poco. Ver «Nombre y dominio».
3. **Team building, cachondeo, RRHH o contratar** (los usos que ve él): el **cachondeo y el team
   building voluntario** son el único uso sano. **RRHH como herramienta** (medir el ánimo, ver
   quién hace horas extra…) y **contratar** quedan vetados por la parte legal (abajo).

## Fase 0: ¿estaba estudiado ya?

El barrido de la cartera (`ya-estudiada.sh`, con «oficina virtual», «team building», «equipos
remotos», «agentes autónomos», «simulación social», «personajes IA», «Sandia Village»…) solo
encuentra el propio Mad Office y la idea del buzón del 24-10. El vecino más cercano es
**Umbra/Urdia** (rol con máster de IA):

| Eje | Mad Office | Urdia | ¿Igual? |
|---|---|---|---|
| Comprador | equipos de trabajo y sus empresas | másters de rol | no |
| Problema | entretenimiento y cohesión del equipo | horas de preparar partidas | no |
| Canal | boca a boca dentro de empresas | Discord y foros de rol | no |
| Lo que lo mata | personas reales en un entorno laboral (legal) | ChatGPT gratis y canal copado | no |
| Infra y datos | turnos de IA baratos con reglas por encima | máster de IA con adjudicador | **sí, se reaprovecha la lección** |

**Desenlace: 🧭 VECINA.** Es otra idea, pero comparte la lección de Urdia, que sigue valiendo: un
producto de ocio con IA en un nicho sin dolor de dinero **no cubre el tiempo propio**, y el
sustituto gratuito siempre está a un fork de distancia. No se canibalizan.

## ¿Ya existe? Quién gana y cómo

**Buscado por el hueco** («AI version of your coworkers», «AI NPC coworkers», «digital twin
employees game», «AI simulation of your team»): **no hay ningún producto a la venta que convierta a
tus compañeros en personajes de IA autónomos** (⚠️ ausencia de pruebas tras 5 búsquedas, no una
prueba de ausencia). Lo que hay:

| Quién | Qué es | Cómo gana dinero | Fuente |
|---|---|---|---|
| **Sandia Village** (Sandia Byte) | pueblo de agentes autónomos y susurro nocturno: el modelo de Mad Office | **No lo vende.** Es contenido de su podcast (audiencia → patrocinio). Beta 1: 21 agentes, 7 días, ~88 € de IA (DeepSeek) | ✅ [web](https://sandiabyte.com/sandia-village/) · 🔶 [su X](https://x.com/sandiabyte) |
| **Smallville** (Stanford, 2023) | el origen: 25 agentes en un pueblo; código abierto | los autores fundaron Simile, que vende predicción de comportamiento a empresas, no juego | ✅ [Stanford HAI](https://hai.stanford.edu/news/computational-agents-exhibit-believable-humanlike-behavior) |
| **Demos de código abierto** | AgentOffice, Synergy Labs, agents-in-the-office: oficinas pixel art con agentes | no cobran | 🔶 [AgentOffice](https://dev.to/harishkotra/how-i-built-agentoffice-self-growing-ai-teams-in-a-pixel-art-virtual-office-4o0p) · [Synergy Labs](https://github.com/Cooljett1234567890/office-sim) · [agents-in-the-office](https://github.com/gukosowa/agents-in-the-office) |
| **Gather** | oficina virtual para trabajar (no es un juego) | 12 $/usuario/mes anual, 15 $ mensual (2026); quitó el plan gratis | ✅ [Gather](https://support.gather.town/hc/en-us/articles/39590892978196) |
| **WorkAdventure** | oficina pixel art de código abierto | desde 5 €/usuario/mes; eventos desde 2 €/usuario/día | ✅ [precios](https://workadventu.re/pricing) |
| **Kumospace** | oficina virtual | 16-20 $/plaza/mes | 🔶 [G2](https://www.g2.com/products/kumospace/pricing) |
| **Donut** (Slack) | emparejar compañeros para cafés | gratis hasta 24; pago por usuario activo (cifras dispares) | 🔶 [Donut](https://www.donut.com/pricing) |
| **Team building presencial** | actividades | 16-45 €/persona en España | 🔶 [Yumping](https://www.yumping.com/team-building/espana) |

**El modelo del que ya vive** (exigido antes de un no): Gather y compañía ganan porque son la
**herramienta donde se trabaja** (dolor real: equipos remotos sin oficina) y cobran por puesto.
Sandia gana **audiencia, no dinero directo**: el pueblo es un episodio. Mad Office no sustituye a
ninguna herramienta de trabajo; sería un **extra de ocio**, y eso compite por el presupuesto de
team building (16-45 €/persona, puntual) más que por el de software (12-16 $/puesto, recurrente).

## Los cuatro ángulos de cobro

| Ángulo | Quién paga | Por qué no hoy |
|---|---|---|
| **SaaS por empresa** (el que lleva números) | RRHH o el responsable de un equipo | sin dolor; el canal B2B sin llamada en frío no existe; legal delicado (abajo) |
| **«Temporada» de una semana** (evento) | una empresa, una vez | precio de evento (una cena de equipo); para llegar a ellas hace falta una agencia o a alguien dentro de la empresa |
| **Comunidades, streamers y podcasts** (como Sandia) | el creador, o nadie | su modelo es audiencia propia, y Álvaro no la tiene; la IA la pagaría cada jugador con su clave |
| **Contenido propio** (vídeos de la oficina) | patrocinio o anuncios | ⚠️ con compañeros reales no se puede publicar sin su consentimiento escrito; con ficticios, sí |
| **Código abierto + donaciones** | voluntarios | céntimos; vale como escaparate, no como ingreso |

**La apuesta**, si algún día se reabre: **la temporada de una semana** para equipos que ya se
conocen, vendida por recomendación desde dentro (alguien que lo ha jugado en otra empresa). **El
KPI que decide si existe el negocio:** que una empresa de fuera de Walmeric **pague por adelantado**
una temporada después de verla.

## Legalidad como especificación

Tres capas, como pide la skill:

1. **Lo que hace el usuario.** Caricaturizarse a uno mismo o a otros con su permiso es legal. Hacerlo
   **sin consentimiento** de una persona identificable choca con el derecho al honor y a la propia
   imagen. La excepción de la caricatura (art. 8.2.b) solo ampara a personas con proyección pública,
   no a compañeros de trabajo. ✅ [LO 1/1982](https://www.boe.es/buscar/act.php?id=BOE-A-1982-11196)
2. **Nuestro papel.** Aquí nosotros **generamos** el contenido (la IA escribe lo que hace y dice cada
   caricatura), así que no somos un mero intermediario: no hay puerto seguro que valga para lo que
   genera la IA. Hace falta tono por reglas, retirada inmediata y que cada uno apruebe su ficha.
3. **Los agujeros que hunden el proyecto.**
   - **En el entorno laboral, el consentimiento que da un trabajador a su empresa rara vez es
     libre**: el responsable del tratamiento no puede apoyarse en él cuando la relación es
     desigual. ✅ [EDPB, directrices 05/2020 sobre el consentimiento](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en)
     (apartados sobre empleo). Si **la empresa** lo despliega para su plantilla, necesita otra base
     legal y una participación de verdad voluntaria. Como iniciativa personal entre compañeros, el
     problema es menor, pero la regla sigue: cada uno decide sobre su caricatura.
   - **Selección de personal = alto riesgo.** Los sistemas de IA para contratar o evaluar candidatos
     están en el anexo III.4.a del AI Act, con todas las obligaciones de alto riesgo (gestión de
     riesgos, datos, supervisión humana, registro…). ✅ [Reglamento (UE) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)
     ⚠️ La fecha de aplicación de esas obligaciones está en discusión (propuesta de aplazamiento);
     sin comprobar, y da igual: **veto**.
   - **Usar estados, horas extra o ánimo de caricaturas como dato de RRHH** sería tratar como datos
     del trabajador lo que se inventa un modelo. Decidir algo sobre personas con ello entra en las
     decisiones automatizadas del ✅ [RGPD art. 22](https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807)
     y en el deber de informar al comité de los algoritmos que afectan a las condiciones de
     trabajo (✅ [Estatuto de los Trabajadores, art. 64.4.d](https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430#a64)). **Veto.**
   - **Acoso:** una caricatura que se pase de rosca, por ejemplo con un compañero ridiculizado a
     diario delante de todos, es exactamente lo que persigue un protocolo de acoso. Esto no es
     teoría: el tono tiene que estar blindado por código, no por el prompt.

### Reglas duras del producto (requisitos, no consejos)

1. **Cada persona crea, retoca y aprueba su propia caricatura.** Nadie hace la de otro.
2. **Retirada inmediata:** cualquiera puede pausar o borrar a su personaje y todo lo que ha generado.
3. **Prohibido en el prompt Y en el GM:** salud, sexo, religión, política, sueldos reales,
   despidos, físico y aspecto (ya está en el prompt; falta un filtro por reglas en la salida).
4. **Ningún dato de la empresa:** ni clientes reales, ni proyectos, ni nada de los sistemas de la
   empresa. Todo lo de dentro de la oficina es ficticio.
5. **Nada de usos de RRHH:** ni métricas de personas, ni exportar estados o ánimos, ni selección.
   Va en las condiciones de uso y en el diseño (no hay pantalla que lo permita).
6. **Si lo despliega una empresa:** contrato de encargado del tratamiento, participación
   voluntaria de verdad (no entrar no tiene consecuencias) y aviso al comité si lo hay.
7. **Personas reales en contenido público** (vídeos, redes): solo con consentimiento escrito y
   revocable. Si no, con ficticios.
8. **Enlace mágico por correo** antes de abrirlo a nadie, nunca la contraseña común de los paneles.

### Mínimo legal antes de publicar (casillas)

- [ ] Fuentes autoalojadas: hoy `global.css` carga **Google Fonts** desde Google, así que este punto **no se cumple** (✅ [LG München I, 3 O 17493/20](https://www.gesetze-bayern.de/Content/Document/Y-300-Z-BECKRS-B-2022-N-612)).
- [ ] Edad mínima: 14 años, declarada en el alta (LOPDGDD art. 7). Para un producto de oficina, mejor pedir 18.
- [ ] Analítica y grabación de sesiones solo con consentimiento previo: hoy no hay analítica, así que se cumple.
- [ ] Correos comerciales con consentimiento y baja: hoy no hay; el enlace mágico es transaccional.
- [ ] Desistimiento, si se cobra a consumidores (Directiva 2023/2673; ⚠️ falta comprobar la transposición): no aplica mientras no se cobre.
- [ ] Notificación y acción (DSA art. 16): botón «esto me ofende» y retirada, como regla dura 2.

## Canal

- **Sin llamada en frío**, que está prohibida, y sin anuncios rentables para un producto de 49 €/mes.
  El único canal sano es **el boca a boca desde dentro**: alguien juega en Walmeric, se lo cuenta a
  un amigo de otra empresa y se monta una temporada allí.
- **Tiendas de apps:** no hacen falta, es web.
- **Contenido:** como Sandia, vídeos cortos de lo que pasa en la oficina, **con ficticios**.

## Arranque en frío

Ya está resuelto por diseño: el organigrama se llena de ficticios. Una oficina con una sola persona
ya tiene vida (los C-suite con IA y los demás en piloto automático), y es justo lo que permite
probarlo en Walmeric sin convencer a nadie antes.

## Nombre y dominio

| Comprobación | Resultado | Fecha |
|---|---|---|
| `madoffice.app` | **libre**: registrador de Cloudflare `registrable: true`, 8,20 $ el primer año y 14,20 $ la renovación (≈ 9,90 € y 17,20 € con IVA); RDAP de .app → 404 | ✅ 2026-11-14 |
| `mad-office.app` | libre (Cloudflare) | ✅ 2026-11-14 |
| `madoffice.com` | ocupado desde 2011 (NameBright) | ✅ RDAP |
| `madoffice.es` | sin comprobar (Cloudflare no vende .es; DonDominio rechaza nuestra IP) | ⚠️ |
| Marca nacional «MAD OFFICE», «MADOFFICE», «MAD OFF» | **0 resultados** en el Localizador de la OEPM (criterio por defecto), con el guardia COCA COLA bien antes y después | ✅ 2026-11-14 |
| Marca de la UE «MAD OFFICE» y «MADOFFICE» | **0 resultados** en el eSearch de la EUIPO (guardia COCA-COLA: 84) | ✅ 2026-11-14 |
| «OFFICE» (Microsoft) | ⚠️ sin comprobar. «Office» es casi genérico en software (LibreOffice, OnlyOffice, WPS Office), pero conviene no imitar la identidad de Microsoft Office | ⚠️ |
| Uso anterior sin registrar, OMPI | sin comprobar | ⚠️ |

**¿Comprar `madoffice.app` ya?** **No hace falta.** Para uso interno, `mad-office.alvarosolis.dev`
basta, y el nombre lleva libre desde siempre sin que nadie lo quiera. Si le hace ilusión, cuesta
≈10 € el primer año y ≈17 € los siguientes: no es un riesgo, pero tampoco una inversión. Se compra
**el día que se cumpla la condición de reapertura**, junto con la marca (≈288 € por 3 clases).
**La marca, ni hablar antes**: es dinero sin cliente.

## Números del caso de pago (SaaS por empresa)

Detalle en [kpi.md](kpi.md). Los supuestos son el 54 % de las entradas: lo que decide es la
sensibilidad, no el resultado central.

| KPI | Valor |
|---|---|
| Coste de IA por personaje | **≈0,025 $/día** (calculado a partir de lo medido con Haiku: 3 turnos de 0,0075-0,008 $) |
| Coste de IA por empresa de 20 + 3 C-suite | ≈11,7 €/mes, por API: la suscripción de Claude no se puede revender (✅ [The Register](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access)) |
| Margen bruto a 49 €/mes con IVA | 71 % |
| € por hora invertida (24 meses) | **8 €/h** |
| Break-even contando el tiempo propio | **no llega en 24 meses en ningún escenario** |
| Índice de encaje | **41/100**: hay hueco (4/5), pero no hay dolor (1/5) ni canal (1/5) |

## Recomendación: cómo plantearlo

**Interno en Walmeric**, como iniciativa personal y con las reglas duras de arriba. No como
herramienta de la empresa ni a la venta. Por qué:

- es lo único que **no necesita un comprador** y sí da el dato que falta (¿la gente vuelve? ¿se lo
  cuenta a otros?);
- **no cuesta casi nada**: cada uno pone su IA con su despertador o su clave, y los C-suite
  (~0,075 $/día) los paga Álvaro;
- si funciona, es la demo y el boca a boca que el canal B2B no tiene.

**Antes de invitar a nadie de Walmeric** (en este orden):

1. Enlace mágico por correo y entrada **solo por invitación** (fuera la contraseña común de los
   paneles).
2. Reglas duras 1-3, con el filtro del tono por código.
3. Fuentes autoalojadas.
4. Un aviso de privacidad de una página: qué se guarda, quién lo ve y cómo borrarlo.
5. Mirar si Walmeric tiene alguna política sobre usar IA o hacer apps internas. Aunque no se use
   ningún dato de la empresa, es de compañeros: que no le pille a contrapié.

## Condición de reapertura (para pasar a negocio)

Se reabre **solo** si se cumplen las dos:

1. En Walmeric, al menos **8 personas activas** durante **4 semanas** seguidas (que entren a mirar o
   a mandar sueños al menos 2 días por semana), sin que Álvaro tenga que empujar.
2. **Una empresa de fuera de Walmeric pide una temporada y la paga por adelantado** (aunque sean
   100 €), llegada por recomendación, no por llamada en frío.

**La prueba que cuesta ~0 €** es exactamente la 1. Lo que mata la idea, escrito antes de hacerla:
**si a las 4 semanas quedan menos de 4 activos, como negocio está muerto** y se queda como juego
personal.

**Qué NO hacer para reabrirlo:** comprar marca y dominio «por si acaso», montar pagos o abrir la
web al público a ver qué pasa.

**Condiciones de muerte** (cerrar sin reestudiar): la prueba interna falla; o aparece un producto
grande con lo mismo, como Gather o Slack añadiendo «tus compañeros en IA»; o Walmeric pide que no
se haga.
