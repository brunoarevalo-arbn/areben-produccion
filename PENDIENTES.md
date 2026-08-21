# Pendientes / Roadmap — Areben Producción

> Bitácora de trabajo para no perder el avance ni el rumbo entre sesiones.
> **Actualizar este archivo al cerrar cada sesión de trabajo.**

_Última actualización: 2026-08-20_

> **En esta sesión (20-ago), 2º tramo:** **carga rápida de tizada por el taller.** Un botón
> **"+ Tizada"** debajo del cortador asignado (en el detalle de la OP y en la fila de la Cola) abre
> **el mismo formulario que ve el cortador** y lo carga el taller, para los cortadores que no cargan
> nunca. A diferencia de la carga del cortador, ésta **es cobrable al instante**: hace lo mismo que
> "Validar corte" y suma al saldo pendiente. El precio **se prellena con la tarifa del cortador**,
> que hasta ahora estaba en la base y **no la leía ni la escribía nadie**. Ver abajo.
>
> **En esta sesión (20-ago):** **El plan de órdenes de estampa de lanzamiento, entero de órdenes de estampa de lanzamiento.** Una
> orden de estampa ya no necesita nacer de un producto de Gestión Nube (`gnId` nullable +
> `estampaId` + `origen`), la **receta estampa↔liso ya no exige el escandallo**
> (`lisoEscandalloId` nullable + `lisoSku`) y un **costo final ya conocido se puede cargar a mano,
> con su fecha**. Con eso puesto entró **la orden real de Stunned: 149 prendas** y los 13 productos.
> **El plan quedó cerrado entero.** Ver abajo.
>
> **En la sesión del 18-ago:** Estampería — **marca por estampa** (chip + filtro) y la **carga
> masiva** ahora acepta **foto**, **marca** y el **2º tamaño**, con el costo a la vista por fila.
> Además, el **orden de la lista dejó de moverse** al editar una estampa.
>
> **En la sesión del 3-ago:** tres pedidos sueltos: **cortador predeterminado** (Fernando queda asignado
> solo a cada OP nueva), **pago a cuenta** a cortadores (monto suelto sin imputar a un corte, con
> la cuenta corriente restándolo) y **descripción por foto** en Moodboard / Lanzamientos / moodboard
> de proyecto.

---

## 🎯 A dónde se quiere llegar (objetivo actual)

Producción agrupada por molde cerrada. Próximo foco sugerido: hallazgos de la auditoría
jun-2026 (GET sin auth, guards invertidos, descuadres al deshacer producción, pagos).

---

## 🔴 Pendiente

- [ ] **El predicado "cobrable" está copiado en cuatro lugares.**
  `OR: [{ fichaCorteCargada: true }, { corteEstado: 'validado' }]` + `costoCorte > 0` +
  `pagoCorteId: null` es la definición de qué le debemos a un cortador, y vive textual en
  `app/(dashboard)/produccion/cuenta-cortadores/page.tsx`, `.../cuenta-cortadores/[id]/page.tsx`,
  `app/api/produccion/pagos-cortes/route.ts` y `app/(dashboard)/cortador/page.tsx`. No está
  factorizado en `lib/produccion/cuenta-cortador.ts`, que sí tiene el resto de la cuenta. Cualquier
  estado nuevo de corte hay que acordarse de agregarlo en los cuatro: ahí se va a esconder el
  próximo descuadre.

- [ ] **Blobs huérfanos en la carga masiva de estampas.** La foto se sube a Vercel Blob *antes* de
  que exista la estampa (no hay id todavía), así que si se cancela el panel, se borra la fila o la
  fila queda sin código, el archivo queda subido y sin dueño. Ya pasaba con el form individual; la
  carga masiva multiplica la superficie. Mitigado a medias: al cancelar con fotos sin guardar avisa
  y pide confirmación. El arreglo de fondo sería un sweeper que liste los blobs de `estampas/` y
  borre los que ninguna fila referencia.

- [ ] **La carga masiva de estampas usa `createMany` sin `skipDuplicates`.** El `@@unique` en
  `Estampa.codigoInterno` ya está puesto (20-ago), así que cargar dos veces la misma tanda ya no
  duplica en silencio — pero ahora **falla entera** con el error crudo de Prisma en vez de decir
  qué código está repetido. Falta el mensaje.

- [ ] **Probar a mano lo de esta sesión.** Nada de los tres pedidos del 3-ago se ejercitó contra la
  app corriendo: crear una OP y ver a Fernando preasignado, registrar un pago a cuenta y mirar que
  el saldo baje en las tres pantallas, y escribirle una descripción a una foto vieja (formato
  legado) para confirmar que se migra sola.

- [ ] **No se puede anular un pago de corte.** No hay `DELETE` ni `PATCH` en
  `/api/produccion/pagos-cortes`: un pago cargado por error solo se arregla por SQL. Ahora que se
  pueden cargar pagos a cuenta a mano, es más fácil equivocarse en el monto.

- [ ] **`POST /api/upload-imagen` acepta cualquier sesión** (`app/api/upload-imagen/route.ts:10`),
  o sea que la tablet de costureras puede subir al Blob. No expone datos, pero es la única
  escritura que quedó sin permiso. Ojo antes de gatearla: la usan varios módulos vía `ImageDrop`,
  así que el permiso tiene que ser una lista, no uno solo.

- [ ] **Probar un retiro de tela real.** La escritura nunca se ejercitó: registrar un retiro
  descuenta tela y escribe un `Gasto` de verdad, así que se dejó a propósito para el primer
  retiro de la diseñadora. Si algo falla, aparece ahí.

## 🟡 En progreso

- _(nada activo ahora mismo)_

## ✅ Hecho (referencia)

- **Carga rápida de tizada por el taller (2026-08-20):** botón **"+ Tizada"** debajo del cortador
  asignado, en el detalle de la OP (`app/(dashboard)/produccion/[id]/page.tsx`) y en la fila de la
  Cola. Abre **el mismo componente** que usa el cortador (`CargaCorteForm`, con `modo='interno'`),
  no una copia: lo que ve el taller es literalmente lo que ve el cortador.
  `POST /api/produccion/cola/[id]/carga-tizada` guarda la ficha **y valida en el mismo paso** (lo
  de `validar-corte`): escribe la columna `costoCorte`, deja `corteEstado='validado'` y el corte
  **suma al saldo pendiente al instante**. No toca stock ni rollos — la ficha de tela sigue siendo
  un paso aparte, y la abre precargada.
  - **No pisa la carga del cortador**: si él ya cargó (`corteEstado='cargado'`), el botón no
    aparece y el camino sigue siendo "Validar". La ficha interna se marca con `cargaInterna` +
    `cargadaPor` dentro del `fichaCorteData` (sin migración), y el cartel de la ficha de corte dice
    quién la cargó en vez de mentir "el cortador ya cargó".
  - **`DELETE` deshace**: borra la ficha, `costoCorte` a 0, vuelve a `'asignado'` y **restaura la
    `cantidad` planificada** (se guarda en `cantidadPrevia`), el nombre del cortador y la fecha.
    Bloqueado si ya se pagó o si el taller ya hizo la ficha de tela. Sólo cargas internas.
  - **La tarifa del cortador entró en uso.** `Cortador.tarifaDefault` / `tarifaModo` estaban en el
    schema desde siempre y **no las leía ni las escribía nadie** (ni la pantalla que se anuncia
    "con sus tarifas"). Ahora se cargan en Configuración → Cortadores y **prellenan el precio** de
    la carga interna, siempre editable. De paso, `GET /api/cortadores` (que sale con `getSession`,
    sin permiso, porque lo consume medio módulo) **dejó de devolver la tarifa**: es plata pactada y
    un cortador logueado leería la de todos.
  - Verificado a mano contra la base: tarifa 1234/unidad × 15 u → `costoCorte = 18.510`,
    `corteEstado='validado'`, y **"Cortes pendientes" en `/produccion/cuenta-cortadores/[id]` pasó
    de $22.500 a $41.010**; deshacer lo devolvió a $22.500 y la OP quedó idéntica a como estaba.

- **La orden de Stunned y sus 13 productos, EN LA BASE — Etapas 4 y 5 (2026-08-20):**
  `prisma/migrate-orden-stunned-ago26.ts` creó la orden `cmt1oj06c` — **52 ítems, 149 prendas**,
  `origen: 'lanzamiento'`, y el número cierra contra la base: 149 total, **27 / 48 / 48 / 26** por
  talle. 🔴 **`confirmado = 0` y cero `movimientos_terminado`: el liso no se descontó.** Se
  descuenta al confirmar en Reposición → Órdenes, así que **confirmar sólo lo que se estampó de
  verdad**. Las 13 estampas pasaron a `pedida` (las otras 19 siguen en `pensada`).
  `prisma/migrate-productos-stunned-ago26.ts` creó los 13 `productos_estampados`: **4 con
  escandallo** y **9 con `lisoSku`**, que en `/costos/estampados` aparecen diciendo "falta el
  escandallo" en vez de un total incompleto. Los dos scripts se volvieron a correr con `--aplicar`
  para comprobar que **no duplican**.
  ⚠ Los 13 nacen con **0 minutos** de estampería: `tiempos_estampado` está vacío. Se completa
  cargando una tanda real desde `/estamperia/tiempos` y después en Costos → Editar tiempos.
  ⚠ Los 13 diseños **no existen en Gestión Nube**: cuando salgan a la venta hay que crearlos ahí y
  mapearlos en `reposicion_mapeo`, o nunca entran al cálculo de reposición.

- **Costo final cargado a mano, con fecha — Etapa 3 (2026-08-20):** `ProductoEstampado` sumó
  `costoFinalManual` / `costoFinalFecha` / `costoFinalFuente`, para los costos que ya se conocen de
  la etapa en que no se hacían escandallos. La regla de lectura está en
  `lib/costos/costoFinalEstampado.ts`: **si hay costo derivado manda el derivado** (es vivo: cambia
  con el escandallo); si no, se usa el manual; si no hay ninguno, el costo es `null` y no se rellena
  con 0. 🔑 **La pantalla dice SIEMPRE cuál de los dos está mostrando y de cuándo es el manual** —un
  número sin fecha al lado se lee como si fuera de hoy, que es exactamente lo que hoy pasa con
  `gn_ventas`, congelada al 16-jul y presentándose como "últimos 90 días"—. En la lista el derivado
  va en verde y el manual en gris con `a mano · mar 26` debajo; sin fecha dice **`sin fecha`**, no se
  calla. El CSV sumó una columna **Fuente** (`escandallo (vivo)` / `cargado a mano · <fecha> ·
  <de dónde>`). Los campos del editor sólo aparecen cuando el liso no tiene escandallo, y el
  servidor **no guarda** el manual si hay escandallo: si no, quedarían dos costos compitiendo por el
  mismo nombre. **Verificado en la app:** con fecha muestra `a mano · mar 26`, sin fecha muestra
  `a mano · sin fecha`, y un POST con escandallo + costo manual guarda el escandallo y descarta el
  manual.

- **La receta estampa↔liso ya no depende del escandallo — Etapa 2 (2026-08-20):**
  `productos_estampados` mezclaba dos cosas: **la receta** (qué estampa sobre qué liso, un hecho de
  producción) y **el costeo** (cuánto sale, un hecho de plata). El `NOT NULL` de `lisoEscandalloId`
  obligaba a tener lo segundo para declarar lo primero, y de los 9 lisos de la orden de Stunned
  sólo 4 tienen escandallo. Ahora va **uno de los dos**: `lisoEscandalloId` (trae el costo) o
  `lisoSku` (el liso que sólo existe en `stock_terminado`). La regla vive en `lib/costos/lisoRef.ts`
  y la usan las 3 rutas (`POST`, `PUT`, `bulk`) **y** las pantallas, que muestran un solo select con
  dos grupos —"con escandallo" / "sin escandallo"— en vez de dos controles que se puedan
  contradecir.
  🔑 **Lo importante no es la columna, es que el costo dejó de mentir:** `desglose()` sumaba
  `(liso ?? 0) + dtf + mo`, así que un liso sin costo salía como un **total incompleto con cara de
  costo** —y eso ya pasaba cuando el escandallo no se encontraba—. Ahora `total` es `number | null`
  y la fila **dice qué le falta** (`falta el escandallo` / `escandallo no encontrado` / `sin liso`),
  igual en el detalle, en la grilla de tiempos y en el **CSV**, que es por donde el número se
  escapaba de la pantalla sin la advertencia al lado. El encabezado cuenta cuántos están así.
  El subtítulo de `/costos/estampados` afirmaba "Costo final = liso (escandallo) + …": corregido.
  **Verificado en la app:** un producto con `lisoSku` y sin escandallo muestra "falta el escandallo"
  en la fila y "sin costo · falta el escandallo" en el total, con el DTF y la MO que sí conoce a la
  vista; los 8 productos que ya existían siguen mostrando su total. Las dos combinaciones inválidas
  (los dos lisos juntos, ninguno) dan 400.

- **Órdenes de estampa de lanzamiento — Etapa 1 (2026-08-20):** la premisa que bloqueaba era una
  columna: `ordenes_estampa_items.gnId` era `NOT NULL`, o sea que **toda orden de estampa nacía de
  algo que ya se vende**. Ahora `gnId` es nullable, hay `estampaId` con FK a `Estampa`, y
  `OrdenEstampa.origen` (`'reposicion'` por defecto | `'lanzamiento'`). La regla de "exactamente uno
  de los dos, y coherente con el origen" vive en el `superRefine` del POST, no repartida en las
  pantallas; el nombre del ítem sale de `lib/produccion/ordenEstampa.ts` (`nombreItemOrden`), que
  usan el listado, el remito **y** el `motivo` del `movimientos_terminado` —así el movimiento dice
  `Estampa EST-020 · STARRY` y no un `undefined` ni el `gnId` pelado—. Ciclo de la estampa: crear
  una orden de lanzamiento mueve las que están en `pensada` → `pedida`, y cuando la orden queda
  `hecha` pasan a `recibida` (ese ciclo existía y no lo movía nadie). El alta está en Estampería:
  con estampas tildadas aparecen dos caminos, "Vincular a un liso" (el de antes) y **"Pedir
  estampa"** (`components/estamperia/PedirEstampaPanel.tsx`), que elige liso **por diseño** —una
  tanda de lanzamiento mezcla lisos— contra `GET /api/reposicion/lisos` (los SKU que existen en
  `stock_terminado`, que es el universo que después se descuenta, no el de escandallos). Las
  columnas de talle salen de los lisos elegidos y cada celda muestra el stock que hay.
  **El liso se sigue descontando al confirmar, no al crear.** Ojo con `api/reposicion/reporte`: un
  ítem de lanzamiento no descuenta de ningún sugerido (no tiene producto GN) pero **sí reserva el
  liso**. Esquema aplicado con `db push --accept-data-loss` (el `@@unique` en `Estampa.codigoInterno`
  lo pedía; verificado antes contra la base: 32 estampas, 32 códigos distintos).
  **Verificado ejerciendo el camino contra la app corriendo, sobre datos sintéticos** (estampa y
  liso de prueba, borrados después): la fila queda con `gnId NULL` + `estampaId` + `origen`;
  confirmar 1 bajó el stock del liso exactamente de 5 a 4 y escribió el movimiento con el código de
  estampa; la orden completa dejó la estampa en `recibida`; el camino con `gnId` sigue descontando
  igual (4 → 3) y nombrando por `gnNombre`; las 5 combinaciones inválidas dan 400. Las dos órdenes
  reales de reposición quedaron intactas (10/10 y 49/48) y el remito de lanzamiento dice el diseño,
  no `Producto null`.

- **Orden estable de la lista de estampas (2026-08-18):** `GET /api/estampas` desempata con
  `codigoInterno asc` después de `createdAt desc`. Las 19 estampas viejas entraron juntas por carga
  masiva y comparten `createdAt` al milisegundo, así que el orden entre ellas lo decidía el heap de
  Postgres: editar una la reescribía y la mandaba al final de la lista. Verificado leyendo el orden
  completo antes y después de un PUT: idéntico (antes, EST-007 se iba de la posición 6 a la 18).

- **Cortador predeterminado (2026-08-03):** flag `Cortador.predeterminado` (uno solo; marcarlo
  desmarca al anterior, `lib/produccion/cortador-default.ts`), se elige en Configuración →
  Cortadores. **Fernando ya quedó marcado.** Toda OP nueva —suelta (`POST /api/produccion/cola`) o
  por lote (`POST /api/produccion/lote`)— nace con `cortadorId` y `corteEstado: 'asignado'`. Solo
  la FK: el string `cortador` sigue siendo el snapshot que escriben la ficha y `validar-corte`.
  Además se cerró un bug viejo: en `produccion/[id]/corte`, el cortador ya asignado no viajaba al
  prefill salvo que la ficha estuviera cargada, así que el select arrancaba vacío. No hizo falta
  backfill: había **0 OP sin cortador**. No se autocompleta la tarifa (decisión de
  `RegistrarCorteForm.tsx:116-118`, sigue en pie).

- **Pago a cuenta a cortadores (2026-08-03):** un `PagoCorte` **sin ítems** ahora es válido y es un
  pago a cuenta: exige `cortadorId` (columna nueva) + monto libre. Los pagos con ítems no cambian
  (el monto lo sigue calculando el servidor). La cuenta corriente pasó a ser
  `pendiente por ítems − pagos a cuenta` (`lib/produccion/cuenta-cortador.ts`) y **puede quedar
  negativa** = saldo a favor, mostrado en verde en el hub, el detalle y el panel del cortador.
  No hay doble conteo ni backfill: un pago a cuenta nunca marca ítems, así que nunca se pisa con
  uno imputado. El historial del detalle sumó `{ cortadorId: id }` al `OR` — sin eso los pagos a
  cuenta no aparecían nunca. Las tarjetas de "Pagos de cortes" se renombraron a *Cortes pendientes
  de pago* con link a la cuenta, para que dos pantallas no muestren dos números con el mismo nombre.
  De paso se cerró el último GET de la auditoría: `GET /api/produccion/pagos-cortes` pedía solo
  sesión y devuelve costos y beneficiarios; ahora pide `produccion`.

- **Descripción por foto en el moodboard (2026-08-03):** las fotos pasaron de `string[]` a
  `{ url, descripcion }[]` en `Idea.fotos`, `ProyectoDiseno.moodboard` y `Lanzamiento.fotos`.
  **Sin migración**: `lib/diseno/fotos.ts` (`parseFotos`/`serializeFotos`/`urlsDeFotos`) lee las dos
  formas y cada registro se pasa solo al formato nuevo al guardarse. Todos los `JSON.parse` sueltos
  pasan por ahí — ojo con `KanbanDiseno`, que hacía `a.map(String)` y con objetos hubiera puesto
  `"[object Object]"` de `src`. En la UI: input de descripción bajo cada miniatura de
  `MultiImageDrop` (buffer local, confirma al `onBlur`, para no hacer un PUT por tecla) y pie con
  la descripción en el `Lightbox`, que además alimenta el `alt`. `IteracionMuestra.fotos` queda
  afuera: sigue siendo el textarea de links.

- **Permisos en el listado de rollos (2026-08-02):** `GET /api/insumos/rollos` y
  `GET /api/insumos/rollos/[id]` pedían **solo sesión** — o sea que la tablet de costureras y
  estampadores también los podía leer, con `costoUnitario` incluido. Ahora la lista exige
  `requireAlguno(['insumos','produccion','muestras'])` y la ficha (costo + historial de
  movimientos) `['insumos','produccion']`. El costo se **omite en la query** (`omit` de Prisma)
  para quien solo tiene `muestras`: la diseñadora registra el retiro sin ver plata, misma regla
  que `GET /api/produccion/muestras`. Ningún consumidor se rompe: `RetiroTelaForm` no lee costo;
  `RegistrarCorteForm` sí, pero va con `produccion`.

- **Barrido de GET sin permiso (2026-08-02):** además de rollos, se cerraron `insumos/lotes`
  (`insumos|produccion` — gemelo de rollos, con `costoUnitario`), `produccion/cortes-muestra`
  (`produccion` — devuelve el pago con beneficiario) y `costos/etiquetas/[id]/movimientos`
  (`insumos|costos` — `costoUnitario` por movimiento). **Los que siguen en `getSession` son a
  propósito:** `tiempos/*` y `estampado/*` son la tablet (postea sin sesión admin) e
  `insumos/movimientos` es dato de referencia cross-rol, decidido en la auditoría jun-2026.

- **Permiso `muestras` otorgado a la diseñadora (2026-08-02).**

- **Retiro de tela para muestras (2026-08-02):** permiso propio `muestras` (no obliga a dar todo
  Producción) · sección `/muestras` con guard `requirePaginaAlguno(['muestras','produccion'])`,
  la ruta vieja redirige · marca **obligatoria**, que ahora sí viaja al `Gasto` de desarrollo
  (antes quedaba en `null`) y a una columna nueva `MovimientoInsumo.marca` (nullable, aplicada a
  mano con `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, sin `db push`) · modal de retiro desde la
  ficha y el listado de rollos + acceso rápido en el inicio · buscador de rollo por código/tela/
  color · "guardar y seguir" manteniendo la marca · el costo lo manda el backend **solo con
  permiso `gastos`**. Componentes en `components/muestras/`.

- **Producción agrupada por molde — las 3 fases (jun-2026):**
  - **Fase 1 — Nueva producción:** `LoteProduccion` madre (por molde/prenda) + una `OrdenProduccion`
    por color, con SKU autogenerado. Form en `ColaAdmin`; las OP quedan hermanadas por `loteId`.
  - **Fase 2 — Cortar lote:** una pantalla registra la ficha de todos los colores a la vez.
    Receta de tizadas + avíos + cortador/costo compartidos arriba; rollos + talles por color abajo.
    El costo del corte se reparte entre colores según unidades. Corte parcial permitido.
    `lib/produccion/corte.ts` (`registrarCorteOrden`), `tizada.ts` (`calcTizada`),
    `AviosSelector.tsx`; `POST /api/produccion/lote/[loteId]/corte`; botón "✂ Cortar lote".
  - **Fase 3 — Costura por molde:** "→ Costura" (avanza todos los colores elegibles), pantalla
    "✓ Terminar lote" (conteo por color/talle prellenado del corte → stock + avíos, parcial) y
    "Cerrar lote". `lib/produccion/costura.ts` (`terminarCosturaOrden`); endpoints batch
    `POST /api/produccion/lote/[loteId]/terminar` y `/estado`.
  - Patrón clave: el corte/terminar por OP se extrajo a helpers transaccionales reutilizables; los
    endpoints de lote los invocan 1 vez por color en una sola transacción. Revertir/editar/terminar
    por color individual siguen funcionando igual.
- Cortadores y motivos de descarte como tablas
- Costo de corte (total o por unidad) + pagos masivos a cortadores
- Revertir/editar corte ya cargado (admin + diseñadora)
- Ficha + consumo unificados en "Registrar corte" con desglose por talle
- Rinde por insumo + consumo de tela en metros
- Estados granulares de OP (Fase 2)
- Modelo InsumoColor + gestión de colores
- Módulo Capital de Producción base (Fase 1): insumos, compras, rollos, lotes

---

## 📝 Notas / decisiones abiertas

- **Alta manual de tiempos — auth:** el botón es admin-only en la UI, pero el `POST /api/tiempos`
  sigue siendo abierto (la tablet de costureras postea sin sesión admin). No se agregó enforcement
  server-side para no romper la tablet. Si en algún momento se quiere blindar, habría que separar
  el endpoint o agregar un flag/sesión distinta. Hoy no expone nada nuevo (la tablet ya posteaba).
- _(agregar acá más dudas o decisiones que queden por resolver)_
