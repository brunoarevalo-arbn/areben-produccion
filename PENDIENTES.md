# Pendientes / Roadmap — Areben Producción

> Bitácora de trabajo para no perder el avance ni el rumbo entre sesiones.
> **Actualizar este archivo al cerrar cada sesión de trabajo.**

_Última actualización: 2026-08-18_

> **En esta sesión (18-ago):** Estampería — **marca por estampa** (chip + filtro) y la **carga
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

- [ ] **Blobs huérfanos en la carga masiva de estampas.** La foto se sube a Vercel Blob *antes* de
  que exista la estampa (no hay id todavía), así que si se cancela el panel, se borra la fila o la
  fila queda sin código, el archivo queda subido y sin dueño. Ya pasaba con el form individual; la
  carga masiva multiplica la superficie. Mitigado a medias: al cancelar con fotos sin guardar avisa
  y pide confirmación. El arreglo de fondo sería un sweeper que liste los blobs de `estampas/` y
  borre los que ninguna fila referencia.

- [ ] **`Estampa.codigoInterno` no tiene `@@unique`** y la carga masiva usa `createMany` sin
  `skipDuplicates`: cargar dos veces la misma tanda duplica en silencio. Es preexistente, pero
  ahora la carga masiva es más cómoda (foto + marca + 2º tamaño) y se va a usar más.

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
