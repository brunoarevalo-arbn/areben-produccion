# Pendientes / Roadmap — Areben Producción

> Bitácora de trabajo para no perder el avance ni el rumbo entre sesiones.
> **Actualizar este archivo al cerrar cada sesión de trabajo.**

_Última actualización: 2026-09-23_

> 🔴 🔑 **FASE 3 (repetir producción): sacar el `@unique` SOLO rompe la plata, callado** (23-sep, medido,
> sin código). **`TiemposProduccion` ⛔ no tiene `ordenId`**: la tablet elige la OP por `id` y **manda
> sólo el SKU** (`components/tiempos/FormTiempos.tsx:134`) ⇒ con dos OP del mismo SKU,
> `minutosSinImputar`/`minutosSinImputarPorParte` (`lib/produccion/loteCorte.ts:84-98, 141-160`)
> suman los minutos de TODA la vida del SKU y restan sólo los lotes de ESTA OP ⇒ **el 1er lote de la
> 2ª OP cobra de nuevo la MO de la 1ª, y lo CONGELA**. Además: reportes por SKU (`api/reportes/sku`,
> `reportes/sku`, `reportes/tiempo-sku`, `api/produccion/tiempo-sku`) inflados, y `aplicar-lote` /
> `productos-producidos` / `fichaDetalleSku` toman UNA tanda (a veces sin `orderBy`).
> ⇒ **La Fase 3 de verdad es**: 1) `ordenId` en `tiempos_produccion`, lo manda la tablet (y el flujo de
> corrección) · 2) **backfill por SKU — HOY es EXACTO porque cada SKU tiene UNA OP; tras la primera
> repetición ya ⛔ no se puede** · 3) recién ahí sacar el `@unique` + opción "repetir este SKU" al crear
> · 4) reemplazar la defensa de carrera: `retryOnUniqueConflict` (lib/db/retry.ts) depende del índice.
> ⚠️ **Hoy repetir YA anda, pero con SKU NUEVO**: `siguienteNumeroSku` (lib/produccion/sku.ts) da
> `ZAT-BIK-MAR-002` solo ⇒ stock partido y el `-002` ⛔ distingue "otro modelo" de "otra tanda".
> 🗣️ **Bruno (23-sep): el plan es un corte con VARIOS lotes (cortar 50, lote de 25 y otro de 25 —
> eso YA ANDA, Fase 1) y más adelante repetir producción; ⛔ decidió aún si repetir = nuevo SKU o
> nuevo corte del mismo SKU.** Recomendado: mismo SKU, corte nuevo (es el vocabulario del 17-sep).
> ▶️ **Mano de Bruno para el 1er lote real (0 lotes en prod al 23-sep):** ficha de corte de MAR y VER
> **+ el % de material corpiño/bombacha** — 🔴 **cargar la ficha VUELVE OBLIGATORIO el %**
> (`loteCorte.ts:269`, `afirmable:false`) ⇒ con ficha y sin % el ingreso queda SIN SALIDA.
> 📊 Collareta del marrón al 23-sep 10:19: **485,5 min = 7,83 min/u** (62), sigue en curso. El corte
> de 60 del 23-sep todavía ⛔ existe como OP a esa hora.

> 📊 **REMALLADO DE LAS DOS BIKINIS, CERRADO** (dictado por Bruno el 21-sep 11:55; el último
> registro cerró 11:36). **623,04 min = 10,4 h** para **104 bikinis** (62 marrón + 42 verde) ⇒
> **5,99 min por bikini**, todo de **Marisol** (es la única que registra: 261 de 261 desde el
> 1-ago). Reparto: **bombacha 3,48 min/u** · **corpiño 2,39 min/u** · **0,13** de cortacollareta
> compartida (13 min, cargados en `Compartido`). **Defectos: 0 en los 11 registros.**
>
> 🔑 **Contra el ÚNICO punto de comparación que existe —el relevamiento del 7-sep— viene por
> DEBAJO**: corpiño 2,39 contra **2,90** (−18%), bombacha 3,48 contra **7,36** (−53%).
> ⚠️ **Y esa vara casi no vale**: es **UNA unidad, talle L, la primera vez**, en modo
> `relevamiento` —que sirve para descubrir los pasos, ⛔ no para fijar el estándar— y nunca pasó
> por medición. **No hay estándar medido de la bikini**: sigue abierto el ▶️ del relevamiento REAL.
>
> 🔴 **La curva de aprendizaje aparece en la bombacha y ⛔ NO en el corpiño**: bombacha
> **3,83 → 2,97** (−22% del marrón al verde), corpiño **2,29 → 2,53** (**+10%**, al revés).
> El verde se partió entre el viernes a la tarde y el lunes a la mañana; no hay con qué separar
> el arranque en frío del ruido con dos colores de muestra.
>
> ⚠️ **El denominador es `cantidadCortada` (62 y 42) y las dos OP siguen con la FICHA DE CORTE SIN
> CARGAR** ⇒ si el conteo real no es ése, todos los min/u se mueven en la misma proporción.
>
> ▶️ **Lo que falta de estas dos: collareta (tubo) y recta (atraques/ruedo).** Proyectado con el
> mismo relevamiento: **17,3 h** crudo, **12,3 h** si se repite la misma ventaja que en el
> remallado ⇒ **entre 2 y 2,5 jornadas** de Marisol (el viernes 18 hizo 433 min productivos).
> ⚠️ Es una **proyección desde una sola unidad relevada**, ⛔ no una medición.
>
> 📊 **COLLARETA DEL MARRÓN, casi cerrada** (dictado por Bruno el 22-sep 16:10: «por terminar,
> quedarían ~4 h»). En la tablet: **342,6 min collareta + 32,5 cortacollareta = 375 min (6,25 h)**
> entre el 21 (70 min) y el 22 (305 min), todo Marisol, 0 defectos ⇒ **6,05 min por bikini** (62).
> 🔴 **Bruno aclaró: las ~4 h (o algo menos) son para el MARRÓN**, no para la verde. Contra la muestra
> (relevamiento 7-sep, talle L, 1 u, el modelo de la OP: triangulito con ruedo **3,20** + bombacha para
> atar **3,01** = **6,21 min/u** de collareta, sin cortacollareta) el marrón entero serían **385 min** y
> ya van **342,6** ⇒ a ritmo de muestra le faltarían **~45 min**. Con 3-4 h más, la collareta saldría
> **8,4-9,4 min/u (+35-50% sobre la muestra)**: al revés que el remallado, que vino por debajo.
> ▶️ **El dato que decide: cuántas bikinis tienen ya la collareta hecha.** Después falta la **recta**.
>
> 🗓️ **PLAN DICTADO por Bruno (22-sep):** ⛔ **no se suma otra costurera**: Marisol, con la bikini
> como PRIORIDAD. **Mañana 23-sep entra un corte nuevo de 60 bikinis** (Bruno estima ~2,5 días; con
> 15,6-19,4 min/u y 433 min/día da **2,2-2,7** ⇒ cierra). **Después de ese corte, la producción de
> lo SUBLIMADO, en SERIE** («por lo menos remallado y eso»). Orden: terminar las 104 (1,5-2,5
> jornadas) → las 60 → sublimado ⇒ el sublimado arranca **~mar 29 / mié 30-sep** (lun-vie, sin desvíos).
>
> 🔑 **¿Los tiempos están bien? (22-sep):** el **remallado sí** (5,99 vs 10,5 de muestra, curva −22%,
> 0 defectos, ~433 de ~437 min disponibles registrados). La **collareta es la sospechosa** (+35-50%
> sobre la muestra si quedan 3-4 h). ▶️ **1) el conteo de marrones con collareta hecha** ·
> ▶️ **2) una corrida en modo `medicion` de 3-5 bikinis al arrancar la collareta del verde** (23-sep)
> ⇒ el primer estándar REAL. ⚠️ Los 146,65 min sin SKU del 21-sep siguen sin explicar.
> ⚠️ **146,65 min del 21-sep (13:33–16:00) en Remalladora SIN SKU**: ⛔ no se sabe de qué fueron.
>
> 📊 **VERDE CONTRA MARRÓN: el TOTAL es parecido, el reparto POR PIEZA no.** Por bikini completa,
> **marrón 6,11 min · verde 5,50 min (−10%)** —sin contar los 13 min de cortacollareta, que
> quedaron cargados sólo en el marrón y son de los dos; con ellos, 6,32 vs 5,50 (−13%)—. En todo el
> corte verde eso son **26 minutos**, ⛔ no una jornada.
> 🔴 🔑 **Pero por pieza las dos diferencias van para lados OPUESTOS**: bombacha **−22%** (3,83 →
> 2,97) y corpiño **+10%** (2,29 → 2,53). Que el total sea más estable que sus dos mitades es la
> firma de un **reparto entre piezas ruidoso, ⛔ no de aprendizaje**: la costurera elige la pieza
> **al cerrar** el tramo, así que un tramo de transición cae entero de un lado. ⇒ **con dos colores
> la lectura por pieza no se sostiene; la que se sostiene es la de la bikini entera.**
> ✅ **Lo que sí quedó DESCARTADO es la mezcla de talles**: marrón **S26/M26/L10** y verde
> **S18/M18/L6** son la misma proporción (**42/42/16** contra **43/43/14**) ⇒ el marrón ⛔ no venía
> cargado de talles grandes.
> ⚠️ **Lo que queda abierto: 293 min SIN SKU el jueves 17**, el mismo día que se cortó el verde
> (70 + 166 + 57, sin máquina, sin detalle). Si algo de eso fue bikini verde, la ventaja del verde
> es en parte un agujero de registro. Por el orden de los tramos ⛔ no parece, pero nada lo prueba.
>
> 🔴 🔑 **Y de paso: los talles ESTÁN y las tres pantallas no coinciden.** `fichaCorteCargada` es
> **false** en las dos OP y `cortes_por_talle` está **VACÍA**, pero **`fichaCorteData` trae los
> talles y suman EXACTO lo cortado** (62 y 42). ⇒ el dato existe, el flag dice que no, y la tabla
> que todos leen está vacía. **Un mismo hecho en tres lugares, dos de ellos negándolo.**

> 🔴 🔑 **LA TABLET SE CAÍA ENTERA AL TOCAR EL SKU DE LA BIKINI** (21-sep, `2c32bcf`, EN PROD).
> Lo levantó Bruno desde la tablet: *«no me deja tipear lo de bikinis, me aparece una notificación
> de Vercel, creo que dice this page couldn't load»* — y **apretás un SKU y tira el error**.
> 📊 **Reproducido en producción** (Chrome, `/tiempos`, tocar `ZAT-BIK-VER-001`): pantalla en blanco
> con el cartel de Next **"This page couldn't load"** y, en consola, **React error #31** con el
> argumento que lo delata entero: `object with keys {nombre, skuAbrev, porcentajeMaterial}`.
>
> 🔑 **La causa la dejó `aa8ed5a`, el 18-sep, en el commit que la trajo**: `partesDeSku` pasó de
> `string[]` a `ParteDePrenda[]` —el lote por pieza necesita `skuAbrev` y `porcentajeMaterial`— y
> en ESE MISMO commit nació **`nombresDePartes()`, escrito justamente para la tablet**… que nunca
> se enchufó: `GET /api/tiempos/cola` siguió mandando los objetos y `FormTiempos` los dibuja con
> `{p}`. 🏁 Ahora manda `nombresDePartes(partesDeSku(...))`.
>
> 🔴 **Por qué ⛔ no lo cazó nada de lo que se corrió el 18-sep** (`tsc` + `lint` + `build`, los
> tres verdes, y una caminata en Chrome): **entre la API y el cliente no hay contrato que el
> compilador pueda mirar** — la ruta serializa a JSON y `FormTiempos` vuelve a tipear el resultado
> **a mano** (`const data: OrdenActiva[] = await r.json()`, con `partes?: string[]`). Una anotación
> a mano ⛔ no verifica nada: afirma. ⚠️ Y la caminata del 18-sep tocó la pantalla del LOTE, que sí
> consume las partes como objeto y está bien; la tablet quedó del otro lado del mismo cambio.
> 🔑 **El único oráculo era TOCAR EL SKU en la pantalla** — y era un clic.
>
> 🔴 **Lo caro ⛔ no fue el selector de pieza: fue que se lleva la TABLET ENTERA.** Un objeto
> dibujado revienta el render, el error boundary global tapa todo y la costurera ⛔ no puede ni
> arrancar el reloj. Un defecto en un bloque opcional apagó la herramienta completa.
>
> ▶️ **Queda abierto (mismo patrón, otra punta): lo que se DIBUJA se manda ya listo para dibujar.**
> Si la tablet alguna vez necesita el SKU de la pieza, va un **campo nuevo**, ⛔ no el objeto crudo.
>
> 🏁 **Y de paso se CAMINÓ la pantalla de lote que faltaba** (el ▶️ del 18-sep, "falta el CLIC en
> prod"): `/produccion` → "Terminar lote" abre bien, muestra las dos piezas y sus SKU
> (`ZAT-COR-VER-001` y `ZAT-BOM-VER-001`, `…-MAR-…`), sin errores de consola. **La caminata
> encontró otras dos cosas, las dos arregladas y en prod:**
>
> 🔴 **(1) El rótulo decía "Cortadas" sobre lo PLANIFICADO** (`fa6b9f0`). La pantalla mostraba
> `orden.cantidad`, que desde la Fase 0 es **lo planificado**; lo cortado vive en
> `cantidadCortada`. 📊 En la bikini los dos difieren: **42 cortadas contra 40 planeadas** (VER) y
> **62 contra 60** (MAR) ⇒ el que ingresa comparaba su conteo contra un número **2 unidades corto**,
> con el rótulo afirmándole que era el corte — y **la cola de producción, en la otra pantalla, ya
> mostraba 42**. 🔑 Ahora sale de **`baseDeRepartoConOrigen`**, el mismo dueño que reparte el costo,
> que además devuelve **de dónde vino el número** ⇒ el rótulo puede decir la verdad: "Cortadas" con
> corte cargado, **"Planificadas"** sin él, y "Sin cantidad cargada" cuando no hay ninguna.
> 🔑 **Un número sin su procedencia ⛔ no se puede rotular.**
>
> 🔴 **(2) Terminar lote SIN ficha de corte era un callejón sin salida** (`3e63766`). El freno por
> falta de ficha es **AFIRMABLE** —se ingresa igual, marcando el lote sin costo de material— pero
> esa puerta existía **sólo en el modal por color** de la cola: la ruta del lote devolvía el error
> **sin `requiereAfirmar`**, el form ⛔ no mandaba `permitirSinCosto` y no tenía casilla. ⚠️ **Y es
> el caso de hoy**: las dos OP de bikini están en COSTURA con la **ficha de corte SIN CARGAR** (el
> taller cargó la tizada y los talles —S 18 · M 18 · L 6 = 42— pero el corte ⛔ no se registró) ⇒
> ingresarlas por la pantalla del lote habría rebotado sin puerta. 🔑 **El mismo freno tiene que
> tener la misma salida en las dos pantallas.**
> ⚠️ **Lo único NO caminado a mano: la casilla misma**, porque la única forma de hacerla aparecer es
> mandar el ingreso, y eso ESCRIBE. Compilado y verificado el resto de la pantalla; **el oráculo es
> el próximo ingreso real de Bruno** — si en vez de la casilla ve un error pelado, es esto.
>
> 📊 **Caminado además, sin errores**: `/produccion` (cola + lote expandido), la ficha de corte de
> `ZAT-BIK-VER-001`, y `/tiempos` con las dos OP de bikini.

> 🔴 🔑 **UN CAMPO QUE NADIE TOCA NO ESTÁ VACÍO: AFIRMA EL DEFAULT.** (18-sep, 2ª tanda del día)
> `cantidad` en la tablet venía prellenada con `OrdenProduccion.cantidad` —lo **PLANIFICADO**— al
> elegir la orden, y nadie la tocaba nunca. 📊 Los 7 registros de bikini del 18-sep decían **60**
> sobre un corte de **62**, y el reporte del día sumaba **462 "prendas"** en una jornada donde
> **entraron CERO**: la misma tanda contada una vez por proceso. Septiembre entero: **806**.
> 🔑 **Es el mismo defecto que la pieza preseleccionada, en otro campo** — un valor que pone la
> pantalla queda indistinguible de uno que eligió la persona.
> 🏁 **Decisión de Bruno**: contar en la mesa **⛔ no es viable** con estas cantidades y una sola
> costurera ⇒ **el campo se saca**. El denominador del min/prenda ⛔ no se pierde: ya sale de lo
> **INGRESADO o CORTADO** de la OP (`lib/produccion/cantidades.ts`), que es el número real.
>
> 🏁 **Lo que se hizo:**
> 1. **`cantidad` afuera de la tablet.** `TiemposProduccion.cantidad` queda en la base (historia) y
>    pasa a opcional en `types/tiempos.ts`. Los registros nuevos van en **0 = "no se contó"**,
>    ⛔ no "cero prendas".
> 2. **Las pantallas que la mostraban dejaron de mostrarla**, ⛔ no se las dejó ir a 0 —el cero
>    AFIRMA—: el KPI "Prendas" y la columna por costurera de `/produccion/reportes`, las "pzas" del
>    log de la tablet y de `/produccion/reportes/sku`. En su lugar el KPI **"Con SKU"**: qué % de
>    los minutos productivos dice **qué** se cosió, que es lo que traba el costo por prenda.
> 3. 🔴 **`cantidad: { gt: 0 }` era un FILTRO en `/api/produccion/tiempo-sku`** ⇒ sacar el campo
>    habría hecho **DESAPARECER** los minutos de la pantalla que existe para mostrarlos. Se quitó.
>    📊 Sobre lo histórico ⛔ no cambia nada: **0 de 448** registros con SKU caían ahí.
> 4. **MÁQUINA OBLIGATORIA con orden de producción elegida**, con `'Sin máquina'` (`MAQUINA_NINGUNA`)
>    para el trabajo que de verdad no usa ninguna. Tres condiciones, y las tres importan:
>    **(a)** traba el **GUARDAR**, ⛔ **nunca el arranque del reloj** —la orden se elige AL FINAL—;
>    **(b)** **vacía, ⛔ sin default**, porque un obligatorio prellenado no pregunta, afirma;
>    **(c)** `'Sin máquina'` es una **AFIRMACIÓN** y `null` es **"no dijo"** ⇒ ⛔ **los `null`
>    históricos NO se rellenan**. Va **última** en la lista: es la salida fácil.
>    ⚠️ Se llama **'Sin máquina'** y ⛔ no 'Libre' porque el selector de orden **ya tiene** un
>    "Sin orden — trabajo libre": dos "Libre" en la misma pantalla queriendo decir cosas distintas
>    es justo la ambigüedad que se está sacando.
> 5. 🔴 **De paso, el defecto que cazó CORREGIR A MANO**: Bruno le puso la máquina al registro de
>    las 15:19 y **los minutos pasaron de 41,37 a 41**. Dos causas, las dos arregladas en
>    `lib/tiempos/minutos.ts` (dueño único): el `Math.floor` que el cronómetro ya había dejado el
>    18-sep seguía vivo en el **alta manual** y en la **edición del admin**; y el PATCH recalculaba
>    los minutos con que la hora **VINIERA** en el body, aunque fuera **idéntica** ⇒ corregir sólo
>    la máquina **pisaba un dato MEDIDO con uno DERIVADO**. Ahora recalcula sólo si la hora CAMBIÓ.
>
> ▶️ **NO se hizo, y es deliberado: "terminé este paso".** Es lo único que falta para que el
> min/u **se cierre solo**; hoy se cierra mirando la secuencia (cuándo pasó a la otra pieza) o la
> mesa. ⚠️ Mientras tanto: **un parcial se ve idéntico a un total** —a las 12:00 la bombacha daba
> 3,1 min/u y a las 12:27 daba 3,83—. Bruno lo pospuso porque **la parte de pasos no está lista**.
> ▶️ `/api/costos/productividad` **quedó sin tocar**: no lo consume ninguna pantalla, pero su
> `totalUnidades` suma un campo que ya nadie escribe ⇒ **si alguien lo engancha, va a leer 0**.
>
> 📊 **El día 18-sep, medido** (`ZAT-BIK-MAR-001`, 62 cortadas, Marisol): remallado de **bombacha
> 237,3 min** y **corpiño 141,7 min** + **13 min** de cortacollareta (Compartido), y a las 15:19
> arrancó la verde. Contra las muestras del 4-sep (talle L, **n=1**): **6,11 min/u contra 10,26**,
> **−40%**. ⚠️ Lo comparable es **sólo el remallado**; el tubo/collareta y el atraque en recta
> —9,74 min/u por muestra— todavía no se hicieron, y **el cortacollareta ⛔ no está en ninguna de
> las dos muestras**, así que toda estimación que salga de ellas viene corta por ese lado.

> 🔴 🔑 **EN PRODUCCIÓN, EL MISMO DÍA: preseleccionar una opción es AFIRMAR algo que
> nadie dijo.** La tablet preseleccionaba la primera pieza al elegir la orden. Pero la
> orden **se elige AL FINAL** —se arranca a coser y recién después se dice qué era—, así
> que con **82 minutos ya corridos** apareció "Corpiño" solo. Y como cambiar de pieza
> **cierra el registro anterior**, la única salida era guardar esos 82 minutos en la
> pieza equivocada. 🔑 **El defecto ⛔ no era el cambio de parte: era el default.** Un
> valor puesto por la pantalla se vuelve indistinguible de uno elegido por la persona, y
> desde ahí toda la mecánica que lo sigue ⛔ ya no puede ayudar.
> 🏁 Dos arreglos: (1) **⛔ no se preselecciona con el reloj corriendo** (parado sí: ahí
> se está configurando antes de arrancar); (2) **con la pieza vacía, el primer toque sólo
> ETIQUETA y ⛔ no cierra nada** — no hay pieza anterior que cerrar, y cerrar una
> inventaría un tramo que nunca existió. Recién el segundo toque es un cambio de verdad.
> 📊 Los 4 registros del 18-sep quedaron corregidos a mano (13 min de cortacollareta →
> `Compartido`; los otros tres → `Bombacha` + `Remalladora`, dictado por Bruno).

> 🔴 🔑 **UN CORTE PRODUCE DOS ARTÍCULOS: el lote entra POR PIEZA** (18-sep, decidido por Bruno).
> 🏁 **EN PRODUCCIÓN el 18-sep**, en el orden correcto: SQL aplicado y verificado (`migrate diff`
> deja **sólo** el drift viejo de `compras_dtf`; el índice quedó **`NULLS NOT DISTINCT`** de verdad,
> Postgres es **17.6**, así que el fallback del `DO` block ⛔ no se disparó) → `skuAbrev` sembrado y
> releído ("sin cambios") → push `aa8ed5a` → deploy **Ready**.
> ⚠️ **Y mordió el 🔴 conocido, pero al revés de como se cuenta: Vercel no perdió el push, lo procesó
> TARDE.** A los 20 minutos del push ⛔ no existía ningún deployment de `aa8ed5a`
> (`vercel ls --meta githubCommitSha=…` → "No deployments found") y había otro trabado en `Queued`
> hacía 19 minutos con `Builds: . [0ms]`. Se destrabó con un **commit vacío** (`e25cab2`), que
> disparó en 5 segundos — y **después** apareció el de `aa8ed5a`, más nuevo que el del re-trigger.
> 🔑 **El delator ⛔ no es que el sitio responda** (un GET sin cookie da 307 igual con código viejo):
> es `vercel ls --meta githubCommitSha=<sha>`, que dice si ESE commit tiene deploy.
> 🔴 **Lo que ⛔ NO se pudo verificar y queda abierto: que la PANTALLA de prod muestre las dos
> piezas.** El clasificador bloquea leer producción por HTTP, así que lo único afirmado es que el
> deployment del commit está Ready. **Es un clic: abrir una OP de bikini y tocar "Terminar lote".**
>
> La bikini se tiza junta y **se vende por pieza**, pero hasta acá una OP tenía un SKU y todo lo que
> entraba iba ahí. Ahora un ingreso deja **un `LoteCorte` por parte** —mismo número de lote, "Lote 2 ·
> Corpiño" y "Lote 2 · Bombacha"—, cada uno con su SKU (`ZAT-COR-VER-001` / `ZAT-BOM-VER-001`), su
> conteo por talle y **su propio costo**.
>
> 🔑 **Dónde se parte lo decidió el conteo, ⛔ no el costo.** Se evaluó partir en el pasaje a la marca
> (cero código) y en dos OP hermanas dentro de la tizada (cero código nuevo, pero la tela se parte a
> mano en cada corte). Lo que descartó las dos es que **40 corpiños y 39 bombachas se tiene que poder
> decir**: si el conteo no admite piezas desparejas, una rotura obliga a mentir en el ingreso. La OP
> se queda con **TODO el material**, que es lo que el corte consumió de verdad.
>
> **Decisiones de Bruno (18-sep):** los **avíos se descuentan por PIEZA** (40 bikinis descuentan 80
> etiquetas: cada pieza sale sola a la venta con su etiqueta) · los minutos que la tablet **no
> etiquetó** —los `Compartido` y los que quedaron sin pieza— se reparten **mitad y mitad**.
> ▶️ **El % de material lo va a preguntar Bruno al cortador**; hasta entonces queda **en NULL**.
>
> 🔑 **Y no traba nada hoy**: el % sólo decide algo cuando hay material que repartir, y las dos OP de
> bikini están en `costoTotal` $0. Mientras no haya ficha de corte, entran igual (afirmándolo).
>
> 🔴 **Los dos frenos se parecen y NO son lo mismo, y la pantalla los distingue.** Falta la **ficha de
> corte** = falta una DECISIÓN ⇒ se puede entrar afirmándolo (`requiereAfirmar: true`, la casilla).
> Falta el **% de cada pieza** o su **abreviatura de SKU** = falta un DATO ⇒ `afirmable: false` y la
> pantalla **no ofrece salida**: tildar una casilla no conseguiría el dato, sólo congelaría un
> reparto inventado.
>
> 🔴 **El descuadre que esto podía dejar, y por qué no lo deja**: `cantidadIngresada` suma los
> movimientos de la orden, y un corte de 40 bikinis que entra entero produce **80** movimientos.
> Sumarlos daría la orden por COMPLETA con el primer lote y la mitad de las piezas afuera — el mismo
> patrón que ya mordió tres veces acá (**un denominador que cambió de significado y nadie siguió**).
> Ahora el avance lo marca **la pieza que MENOS entró** (`cantidadIngresadaPorPartes`), y la pantalla
> lo dice: *"Van 8 de 32 cortadas"*.
>
> 🔴 **El SKU de la pieza se GUARDA, ⛔ no se deriva al leer** (`LoteCorte.sku`). Se compone una vez
> al ingresar —2º segmento del SKU reemplazado por `PartePrenda.skuAbrev`, el mismo único dueño de
> esa lectura, `lib/produccion/conjuntos.ts`— y queda congelado con el costo. **Falla cerrado**: si
> no se puede componer, el ingreso se planta, porque `stockTerminado.upsert` **crea la fila que le
> pidan** y mercadería en un código inventado no se nota hasta que alguien la busque y no esté. Por
> eso además **el modal MUESTRA los dos SKU antes de ingresar**.
>
> 🏁 `prisma/sql/2026-09-18-lote-por-parte.sql` (idempotente, ⛔ **sin `db push`**).
> ⚠️ El único de `lotes_corte` pasó a `(ordenId, numero, parte)` **con `NULLS NOT DISTINCT`**: para un
> unique de Postgres dos NULL son **distintos**, así que sobre las órdenes sin partes —todas las de
> hoy— un unique común **no defendería nada**. Prisma no lo sabe expresar; el SQL lo hace y avisa si
> la base es < PG 15.
>
> 📊 **Ejercido, ⛔ no sólo tipado.** `prisma/check-lote-corte-ejercicio.ts` pasó de 24 a **38
> chequeos**, verde **tres corridas seguidas** contra `areben_test`. Los nuevos: las dos piezas suman
> exactamente el unitario del corte (si no, repartir pierde o inventa plata, y el lote lo congela) ·
> los minutos medidos van a su pieza y los sueltos mitad y mitad, con el oráculo armado por SQL crudo
> desde `tiempos_produccion` · una sola pieza entera **no** completa el corte · un conteo sin pieza se
> planta · y el **chequeo 14**, que parsea con los validadores REALES lo que arman las dos pantallas:
> sin eso, un cambio de forma del payload (`talles` → `conteos`) dejaba todo lo demás en verde.
>
> ✅ **Y se CAMINÓ con el dedo**, que es lo que faltaba de la Fase 1: `next start -p 3002` contra la
> copia local (⛔ **no** el `next dev` del 3000, que apunta a PRODUCCIÓN), con una cookie de sesión
> firmada a mano porque Chrome no tiene login. Se vio: la **ficha logueada de la OP** —lo que nunca se
> había abierto— con las dos piezas y sus SKU · el form de terminar lote con **una columna por pieza**
> · el freno del % **en pantalla, con su texto** · y el ingreso bueno: 6 corpiños + 5 bombachas,
> $500/u y $750/u (40/60 de $1.250), *"Van 8 de 32"*. La copia local quedó restaurada.
>
> ▶️ **Lo que falta**:
> - 🔴 **El % de material corpiño/bombacha** — mano de Bruno, hablándolo con el cortador. Se carga con
>   `npx tsx prisma/seed-conjuntos-prenda.ts --aplicar --porcentajes BIK=40/60`.
> - 🔴 **La ficha de corte de las dos OP de bikini** (sigue abierta del 18-sep a la mañana).
>   📊 Medido en prod al cerrar: `ZAT-BIK-VER-001` **ya tiene `cantidadCortada = 42`** pero
>   `costoTotal` sigue en **$0** ⇒ falta la parte de la ficha que carga la TELA.
> - ✅ ~~Sembrar `skuAbrev` en PRODUCCIÓN~~ — hecho el 18-sep.
> - 🔴 **Abrir la pantalla en PROD y contar una tanda de verdad**: es el único paso que no se pudo
>   ejercer desde acá.
> - ⚠️ **Los SKU de pieza (`ZAT-COR-…` / `ZAT-BOM-…`) no existen todavía en ningún lado**: ni en
>   `sku_catalogo` (que sólo tiene "Bikini/BIK"), ni como escandallo, ni en Gestión Nube. El stock los
>   crea al entrar. **Hay que decidir si ésos son los códigos con los que Zattia los va a vender.**
> - **El ABM del catálogo de conjuntos** (hoy se siembra por script) — ahora tiene dos campos más.
> - **Un umbral para el residuo de redondeo** del cartel de "quedan N minutos" (sigue abierto).

> **En esta sesión (18-sep): LA TABLET REGISTRA POR PARTE — corpiño y bombacha en la misma sesión.**
> Bruno decidió que la bikini **se vende por pieza** aunque **se tiza junta** (entran 6 en un espacio
> en metros). Las dos OP de bikini (`ZAT-BIK-VER-001` 40 · `ZAT-BIK-MAR-001` 60) **arrancan producción
> ya**, sin otra muestra de por medio ⇒ el cambio fue en la **tablet de producción**, ⛔ no en la
> calculadora.
>
> 🔴 **El problema medido**: la cola le mostraba a Marisol una sola fila (`ZAT-BIK-VER-001`) y todo lo
> que cronometrara caía bajo ese SKU. Para cambiar de pieza tenía que **parar, guardar, volver a
> elegir y arrancar** — cuatro gestos, con el tiempo del medio perdido. 📊 Y no es teórico: el **82%**
> de los minutos de la semana del 7-sep y el **96%** de la del 31-ago ⛔ no dicen qué prenda se hizo.
>
> 🏁 Ahora: `TiemposProduccion.parte` (nullable), catálogo `ConjuntoPrenda`/`PartePrenda`, y en la
> tablet **dos botones que cierran el registro anterior y abren el siguiente de un solo toque**
> (`FormTiempos.cambiarParte`). El mecanismo ⛔ no se inventó: es el mismo de `CorridaTablet.accion()`,
> y `useTiempos` ya exponía `obtenerTiempos`/`descartar`/`iniciar`.
> ⚠️ **El reloj SÍ vuelve a 00:00:00 al cambiar de parte, y está bien**: el registro anterior se
> cerró. Lo que se evita es el hueco, ⛔ no el reinicio.
>
> 🔑 **EL SUPUESTO, explícito porque se rompe solo dentro de seis meses**: el conjunto se engancha a
> la orden por el **2º segmento del SKU** (`ZAT-`**`BIK`**`-VER-001` → `prendaAbrev = 'BIK'`), la
> convención de `AGENTS.md` que ya usa `lote/agrupar/route.ts:72`. Dos cosas:
> **(a)** se lee **por POSICIÓN**, y un SKU fuera de formato devuelve el segmento equivocado **sin
> avisar** ⇒ por eso `ConjuntoPrenda` es una **lista blanca** y no una derivación: lo mal leído no
> matchea, la orden queda sin partes y la tablet se comporta como siempre. **Falla cerrado.**
> **(b)** se deriva **SIEMPRE del SKU y ⛔ NUNCA de `LoteProduccion.prenda`**, que admite override
> manual ⇒ ahí el mismo molde puede estar guardado como otra cosa. El único dueño de esa lectura es
> **`lib/produccion/conjuntos.ts`**.
>
> 🔴 **`parte` ⛔ NO arregla el 82% sin SKU, y no hay que leerlo como si lo arreglara.** Un registro
> sin SKU tampoco tiene conjunto ni parte ⇒ separar por pieza **no agrega observaciones, sólo parte
> las pocas que hay**. El cuello para el costo por pieza sigue siendo **que la tablet cargue el SKU**.
> Por eso `/api/produccion/tiempo-sku` devuelve `minutosSinParte` aparte: los minutos sin pieza **⛔ no
> se reparten entre las partes**, se informan.
>
> ⛔ **NO se resolvió acá (es de la otra sesión)**: que **una OP produzca DOS SKU**. Este diseño está
> hecho para no prejuzgarlo — ⛔ no agrega ninguna columna a `OrdenProduccion`, y cuando el corte se
> parta en dos artículos el campo `parte` sigue valiendo y empalma.
>
> 🔴 **La migración ⛔ NO se aplica con `db push`**: `prisma/sql/2026-09-18-parte-y-conjuntos.sql`, con
> `psql` o `db execute`. Se verificó con `migrate diff` que lo único que queda afuera es el **drift
> preexistente de `compras_dtf`** (2 FK + un índice renombrado), que `db push` arrastraría solo.
>
> ✅ **Caminado contra una COPIA de producción en Postgres local** (`areben_test`), ⛔ no contra prod:
> 🔴 hasta ahora **el localhost apuntaba a la base real** (`.env` tiene una sola), que es lo que dejó
> 3 relevamientos cerrados con clicks de prueba el 4-sep. ⚠️ **`prisma.config.ts` lee `.env`, ⛔ no
> `.env.local`** ⇒ a los comandos de prisma hay que pasarles `DIRECT_URL` en la línea o van a prod.
> Oráculo: `horaFin` de una parte == `horaInicio` de la siguiente (sin huecos) — verde en 2 de 2.
>
> ▶️ **Falta**: caminar la tablet **con el dedo** (se ejerció la escritura por API, ⛔ no el click);
> sembrar el conjunto en **producción** (`prisma/seed-conjuntos-prenda.ts --aplicar`, dry-run por
> defecto); y el **ABM del catálogo** (hoy se siembra por script, que para una fila alcanza).

> **En esta sesión (18-sep): FASE 1 — EL LOTE QUE ENTRA, CON EL COSTO CONGELADO.**
> Un corte ya puede entrar **de a partes**: cada parte es un `LoteCorte` con **talles adentro** y con
> el costo **congelado el día que entró**. Antes una OP entraba entera de una sola vez y su costo se
> recalculaba para siempre contra la ficha de hoy.
>
> 🔑 **La mano de obra llega a la prenda por primera vez.** `costoManoObra` era una **columna muerta
> medida**: 0 escrituras en todo el repo, **0 de 67 OP** con un valor distinto de cero. Los minutos
> existían —`TiemposProduccion`, **34.906 minutos**, de los cuales **18.787 (53,8%) tienen SKU**— y
> **ninguno llegaba nunca a un costo**. 📊 Y matchean: de esos 18.787, **0 son huérfanos**, todos caen
> en una OP real. A $134,71/min son **~$2,53M** de mano de obra que estaba medida y sin imputar.
>
> 🔴 🔑 **Los minutos de MUESTRA quedan AFUERA, y no por prolijidad: ya se cobran.**
> `crearTiempoConGasto` le crea un `Gasto` de categoría 'desarrollo' a cada registro de muestra.
> Sumarlos al costo de la prenda cobraría los mismos minutos **dos veces**. Quién es muestra lo decide
> **`marcaDeMuestra`, el mismo juez que los cobra** — duplicar la lista de actividades en el costeo
> sería media regla en dos lados. ⚠️ Sólo cuentan los `estado: 'guardado'`: un 'pendiente' es un
> cronómetro sin confirmar (hay 5 hoy).
>
> **Decisiones de Bruno (18-sep):**
> 1. **La MO se congela con lo que REALMENTE costó hasta ese día**, ⛔ no al estándar: los minutos que
>    ningún lote anterior se llevó, sobre las unidades de ese lote. Es **desparejo a propósito** — el
>    primer lote se lleva el arranque, el último lo que quedó.
> 2. **Una orden sin costo de material se PLANTA** al ingresar. Se puede entrar igual, pero
>    **afirmándolo**: el lote queda marcado (`sinCostoMaterial`) y la casilla aparece **recién después
>    del freno**, para que nadie la tenga tildada por costumbre.
>
> 🔴 **Y eso muerde YA: las dos OP de bikini están en COSTURA con `costoTotal` $0 y `cantidadCortada`
> en NULL** (ficha de corte sin cargar) ⇒ hoy todo lo que entre de ellas se congela **sin material**.
> ▶️ **Mano de Bruno: cargar la ficha de corte de `ZAT-BIK-VER-001` y `ZAT-BIK-MAR-001` antes de que
> entre el primer lote**, o esas 100 bikinis quedan valuadas sólo por mano de obra.
>
> 🔴 🔑 **El agujero conocido de la regla elegida: los minutos que llegan DESPUÉS del último lote no
> tienen quién se los lleve.** Si la orden ya completó, ningún lote más va a entrar y esa plata no
> entra al costo de ninguna unidad. ⛔ No se tapó con un promedio: la ficha de la OP **lo dice**
> («quedan N minutos que no se llevó ningún lote, $X al $/min de hoy»). Si molesta en la práctica, la
> salida es re-congelar el último lote, ⛔ no repartir para atrás.
>
> 🏁 **Lo que entró.** `LoteCorte` + `LoteCorteTalle` (`prisma/sql/2026-09-18-lotes-corte.sql`,
> idempotente, ⛔ **sin `db push`** por el drift de `compras_dtf`). El núcleo es
> **`lib/produccion/loteCorte.ts`**, con `permitirSinCosto` **obligatorio** para que el typechecker
> señale a los llamadores. `terminarCosturaOrden` pasó a ingresar **un lote**: si lo ingresado no
> alcanza lo cortado, la OP **sigue en COSTURA** y puede recibir otro; el parcial deja su propia
> `EstadoTransicion` (sin eso, 30 de 100 no aparecían en ningún historial).
>
> 🔴 **Tres descuadres que aparecieron y se arreglaron, los tres del mismo tipo — un denominador que
> cambió de significado y nadie siguió:**
> - **Los avíos se descontaban una sola vez por ORDEN** (guard `aviosDescontados`). Con ingreso
>   parcial el **primer lote se llevaba el descuento y los siguientes no descontaban nada, en
>   silencio**: 100 bikinis en tres tandas descontaban las etiquetas de la primera. El evento que
>   consume avíos es **el lote**, no la orden.
> - **`lib/costos/fichaCostos.ts` era el ÚNICO camino de costo unitario que seguía dividiendo por
>   `cantidad`** (lo planificado) después de 81251ca. Una OP planificada en 100 y cortada en 80
>   mostraba un costo **20% más barato** ahí que en `ficha-resumen`, que ya dividía por lo cortado.
>   Dos pantallas, dos números, la misma OP.
> - **`lib/costos/aviosStock.ts` descontaba por `op.cantidad`**: mientras ese campo se pisaba con lo
>   producido descontaba bien, y desde 81251ca descuenta **lo planificado**. Ahora va por lo ingresado
>   y, si no hay movimientos, por lo cortado.
>
>
> 🔴 🔑 **Y un descuadre más, que iba a quedar CONGELADO: el denominador no decía de cuál venía.**
> `cantidadCortada()` cae a lo planificado cuando no hay corte cargado, y **el número solo no dice
> cuál de las dos es**: 40 puede ser «se cortaron 40» o «nadie cortó y hay 40 planificadas». El lote
> **congela** el unitario ⇒ repartir por el plan cuando se cortó menos deja el costo mal **para
> siempre**, sin forma de encontrar cuáles mirar. 📊 **Medido en el ejercicio: $1.000/u (÷40
> planificadas) contra $1.250/u (÷32 cortadas) — 25%.** Y la ficha **afirmaba «repartido por lo
> cortado»** sin saber si era cierto. 🏁 Ahora la procedencia sale del núcleo **una sola vez**
> (`baseDeRepartoConOrigen` en `lib/produccion/cantidades.ts`, y `baseDeReparto` se implementa con
> ella), el lote la **guarda** (`unidadesBase` + `baseMaterial`) y la ficha muestra **«÷32 cortadas»**
> en gris o **«÷40 PLANIFICADAS»** en ámbar. 🔑 **La forma natural de equivocarse es derivarlo de
> `unidades > 0`** —da 'cortado' para una orden con el campo en NULL—, así que el chequeo 8a es
> justamente ése. Lo levantó la sesión de la tablet, que se había equivocado así.
> 🔑 **El rojo lo encontró correr el ejercicio DOS VECES, no escribirlo.** La primera corrida dio todo
> verde sobre una base limpia. La segunda destapó que **una orden que vuelve a costura se quedaba con
> el `terminadoAt` de su vuelta anterior** — y `aviosStock.ts:22` busca las terminadas justamente por
> `terminadoAt: { not: null }` ⇒ figuraba **terminada en una pantalla y en costura en otra**. Ahora el
> ingreso parcial lo limpia, y el caso quedó como chequeo 7.
>
> 📊 **Ejercido de verdad, ⛔ no sólo tipado**: `prisma/check-lote-corte-ejercicio.ts` corre el ingreso
> real contra una **copia local** (`areben_test`) y **lee el resultado con SQL crudo**, no con los
> helpers que prueba. 24 chequeos, verde **tres corridas seguidas**. Se planta si `DIRECT_URL` no
> apunta a localhost. `prisma/check-fase1-lote.ts` es la medición read-only de la base.
> ⚠️ 🔴 **`.env` apunta a PRODUCCIÓN y `.env.local` está vacío** ⇒ cualquier prueba local escribe datos
> reales; y `prisma.config.ts` lee `.env`, ⛔ no `.env.local`, así que a los comandos de prisma hay que
> pasarles `DIRECT_URL` en la línea. (Lo levantó la sesión de la tablet.)
>
> 🗑️ **LA FASE 2 (el dije) QUEDA DESCARTADA — la decidió Bruno el 18-sep, y el motivo importa más
> que la decisión.** El plan del 17-sep era que el lote entrara `RETENIDO` a `stock_terminado` con
> **`tipo: 'retenido'`**, invisible para reposición y para el pasaje. **No se construye.**
>
> 🔑 **Porque la Fase 1 ya lo cubre sin código**: si lo ingresado no alcanza lo cortado, la OP **se
> queda en COSTURA y acepta otro lote después**. Si el dije no llegó, **no se ingresa ese lote** — y
> cuando llega, se ingresa y ahí la orden termina. Es exactamente el comportamiento que hoy defiende
> el chequeo 3 del ejercicio (15 de 40 → sigue en costura, sin `terminadoAt`).
>
> 🔑 **Y es MÁS correcto en el costo, ⛔ no sólo más barato.** El lote congela los minutos **al
> ingresar**: esperando al dije, los minutos de ponerlo **entran** al costo de esas prendas. Con
> `tipo: 'retenido'` el lote ya habría congelado antes y esos minutos quedaban **afuera**.
>
> ⚠️ **Lo que costaba de verdad**: un `tipo` nuevo en `stock_terminado` obliga a revisar **toda**
> consulta que hoy asume `liso | estampado` —reposición, el pasaje, los ajustes— para un caso que
> Bruno describe como **ocasional**.
>
> 🔴 **El caso ÚNICO que la reviviría, anotado para no re-derivarlo**: que haga falta mandar a la
> marca **una parte** del corte mientras la otra espera el dije. Ahí sí hacen falta las dos mitades
> en stock con distinto estado. Mientras el dije sea de **la tanda entera**, no pasa.
>
> ⚠️ **Lo que queda sin resolver, y a propósito sin código**: una OP parada esperando el dije **se ve
> igual** que una que la costurera está cosiendo. Se escribe *«esperando dije»* en `notas`, que ya
> existe. No se le pone código hasta que moleste.
>
> 🏁 **EN PRODUCCIÓN el 18-sep.** Bruno aplicó el SQL, el push (`0ea53d1`, 11:20) se llevó los tres
> commits de esta línea en la misma cadena y el deploy quedó **Ready 2 segundos después**, sirviendo
> `produccion.arebensrl.com`. **El orden se respetó: SQL primero, deploy después** ⇒ la tablet nunca
> se rompió (y ⛔ nunca iba a romperse: lo que consulta `lotes_corte` son **tres** lugares, los tres de
> Producción —la ficha de OP y los dos `terminar`—, medido por `grep`, ⛔ no deducido).
> 📊 **Verificado contra prod por tres caminos**: las dos tablas con sus 15 y 4 columnas, 5 índices y
> 2 FK (incluidas `unidadesBase`/`baseMaterial`, agregadas al final y por eso las más fáciles de
> perder) · `prisma migrate diff` deja **sólo** el drift viejo de `compras_dtf` · y el
> `include: { lotesCorte }` de la ficha —lo que reventaba— corrido con el cliente Prisma **contra la
> base de producción**.
>
> ▶️ **Lo que falta**:
> - 🔴 **LA FICHA DE CORTE de las dos OP de bikini** (mano de Bruno). Es lo único que separa a las 100
>   bikinis de tener costo real: hoy entran valuadas **sólo por mano de obra**.
> - ⚠️ **La pantalla LOGUEADA nunca se abrió.** Chrome no tiene sesión; un GET sin cookie da **307 al
>   login**, que ⛔ **no prueba la query** porque el guard corta antes. Es un clic:
>   `/produccion/cmu5s8ldu000104l55m12itqp`.
> - **Caminar el modal con el dedo** — se ejerció el núcleo y el contrato del endpoint, ⛔ no el click
>   ni el checkbox del freno.
> - **Un umbral para el residuo de redondeo**: `minutosImputados` se guarda a 2 decimales contra una
>   suma cruda, así que el cartel de «quedan N minutos» puede salir diciendo **0**. Ruido con cara de
>   dato; es una línea. (Apareció cuando la tablet pasó a guardar decimales: antes 30 seg valían 0.)
> - **Fase 4**: que el **pasaje a la marca valorice por el costo del LOTE** en vez del escandallo.
>   🔴 **le cambia el número a Darío: hablarlo antes**.

> **En esta sesión (17-sep): EL DENOMINADOR DEL COSTO, y los dos descuadres que estaban vivos.**
> Arranca el trabajo de producir **por LOTE** para la temporada de bikinis (~20 artículos que van a
> entrar de a partes). El vocabulario quedó: **artículo → corte → lote**. `OrdenProduccion` ya **es**
> el corte (admite una sola ficha); lo que se llama `LoteProduccion` ⛔ no es un lote, es **la tizada
> compartida** (varias OP del mismo molde, distinto color, cortadas en la misma mesa).
>
> 🔴 🔑 **`cantidad` era UN campo con TRES significados, y se pisaba solo.** Nacía planificado, lo
> pisaban las **tres** cargas de corte —el cortador (`api/cortador/carga`), el taller
> (`carga-tizada`) y la ficha de tela (`registrarCorteOrden`)— con lo **cortado**, y al terminar
> costura lo pisaba lo **producido**. Como el costo unitario es `costoTotal / cantidad`, **entrar 20
> de un corte de 100 dejaba la tela de las 100 dividida por 20**: ésa era la "progresión a ojo" que
> había que hacer a mano. 🏁 Ahora `cantidad` es **sólo lo planificado**, lo cortado vive en
> **`cantidadCortada`** (columna nueva) y lo ingresado **se DERIVA** de los `MovimientoTerminado` de
> la orden — no se guarda, para que no pueda desincronizarse de los movimientos que lo producen.
> Helper único: **`lib/produccion/cantidades.ts`**.
>
> 📊 **Medido antes de tocar: la corrección ⛔ no mueve ningún costo hacia atrás.** De 67 OP, 25 sin
> corte cargado, **41 con `cantidad` ya IGUAL a lo cortado** y **1 sola que difiere**
> (`ZAT-BUZ-CH-001`: cortó 20, ingresó 14 — y su `costoTotal` es $0). Verificado por otro camino
> sobre las **40 OP con ficha de tela**: **0 costos unitarios movidos**. Y sobre los **2 cortes
> pendientes de validar**: **0 montos del cortador cambiados**. `prisma/migrate-cantidad-cortada.ts`
> (dry-run por defecto), 42 escritas y **releído: 0 OP con corte y `cantidadCortada` en NULL**.
>
> 🔴 **Descuadre vivo #1, arreglado: el botón de la tablet hacía DESAPARECER producción.**
> `PATCH /api/tiempos/cola/[id]` avanzaba la OP de `COSTURA` a `TERMINADO_SIN_ESTAMPA` **sin contar
> por talle, sin ingresar a `stock_terminado` y sin descontar avíos** — y encima la dejaba en un
> estado desde el que `terminarCosturaOrden` ya ⛔ no la acepta (exige `COSTURA`), así que el taller
> **no podía ingresarla ni dándose cuenta**. 🏁 Ahora es un **aviso** (`avisoCosturaAt` /
> `avisoCosturaPor`): saca la OP de la cola de la tablet, ⛔ no toca estado ni stock, y la cola de
> producción muestra **«Marisol avisó: falta contar»**. Se puede deshacer (`DELETE`).
> 🔑 **No alcanzaba con borrar el botón**: le sacaba a la costurera la forma de sacarse la orden de
> encima, que es para lo que lo usa.
>
> 🔴 **Descuadre vivo #2, arreglado: el avío que faltaba se comía en silencio.**
> `Math.max(0, stock - consumido)` dejaba el stock en 0 y **el faltante se perdía sin que nada lo
> dijera** — la tela sí se planta cuando los kg no alcanzan, los avíos no lo hacían. 🏁 Ahora se
> juntan **todos** los faltantes y se nombra cada uno con cuánto falta (plantarse en el primero
> obligaría a descubrirlos de a uno). ⚠️ **Esto puede frenar un ingreso real si el stock de un avío
> está mal cargado**: el mensaje dice qué avío y cuánto, y se destraba ajustando el stock.
>
> 🔴 🔑 **Lo que se midió en la base y dio vuelta una decisión: partir el corte POR COLOR ⛔ no
> compra precisión de costo.** En **8 de los 9** cortes multicolor la tela por unidad da **idéntica**
> entre colores (spread **0,0%**); el noveno da 1,3%. **El precio ⛔ no sigue al COLOR, sigue a la
> COMPRA**: Rústico Invisible gris/negro/azul al mismo $/kg, Ribb Remera **8 colores a $14.580** en
> una sola compra — y al revés, Morley c/ Lycra pasó de **$13.200 (22-may) a $14.580 (11-jun)** en
> los mismos tres colores (**+10,5%**) y Microfibra Stella XL de **$9.543 (1-jun) a $10.211
> (16-jul)** en el **mismo chocolate** (**+7%**). El 1,3% de los buzos sale de mezclar las dos
> compras de Morley, ⛔ no del color. ⇒ **la OP por color se queda porque da IDENTIDAD** (el SKU
> lleva el color, el stock se acumula por color, se puede repetir sólo el que vende), **⛔ no por
> precisión**; y el eje que mueve la plata es **cuándo se compró la tela**, que es justo lo que un
> costo congelado por corte hace visible.
>
> ⚠️ **Lo que apareció de paso y ⛔ no se tocó:** `Jersey 16.1` tiene **3 precios con 210% de
> spread** entre rollos del mismo artículo (o carga mal hecha, o compra en USD sin convertir) — es
> plata mal contada en todo escandallo que use esa tela.
>
> ⚠️ **Drift preexistente en la base**: `prisma migrate diff` pide dropear y recrear dos FK de
> `compras_dtf` y renombrar `compras_dtf_orden_idx` → `compras_dtf_ordenId_idx`. ⛔ **No usar
> `db push`** mientras eso siga ahí: las columnas nuevas se aplicaron con `prisma db execute` y un
> `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
>
> ▶️ **Lo que sigue (decidido con Bruno, sin empezar):** la **Fase 1** es el modelo `LoteCorte` —
> lotes planificados al cortar, **con talles adentro**, y **costo congelado al ingresar** (incluida
> la mano de obra, que hoy ⛔ nunca llega a la OP: `costoManoObra` es una **columna muerta**).
> **Fase 2**: el **dije** traba **sólo la venta** ⇒ el lote entra `RETENIDO` en `stock_terminado`
> con **`tipo: 'retenido'`**, invisible para reposición y para el pasaje sin tocar esas pantallas.
> **Fase 3**: **repetir producción** — sacar el `@unique` de `OrdenProduccion.sku` (medido: **ninguna
> consulta busca la OP por SKU**, todos los `findUnique` van por `id`). **Fase 4**: **FIFO por lote**
> en la salida a la marca — 🔴 **le cambia el número al pasaje, que hoy valoriza al escandallo** ⇒
> **hablarlo con Darío antes**.
>
> 🔴 ▶️ **Y una que no estaba prevista**: la bikini se tiza **junta** (corpiño + bombacha, 6 bikinis
> por espacio) pero **se vende POR PIEZA** ⇒ un corte tiene que poder producir **dos artículos**, y
> hoy una OP tiene **un solo SKU**. Falta decidir cómo.

> **En esta sesión (7-sep), 8º tramo: PRECIOS DE LANZAMIENTO, DECIDIDOS Y PUESTOS EN GESTIÓN
> NUBE.** Los 13 quedaron con precio de lista en GN, que es la que empuja a Tienda Nube — ⛔ a
> Tienda Nube no se le escribe directo. Remeras **$36.990-41.990**, buzos **$66.990-74.990**,
> campera **$81.990**; markup 101-151%. Venta a lista **$7.340.510** contra $2.731.876 de costo.
>
> 🔑 **Lo que definió el margen ⛔ no fue una opinión: fue lo que ya cobra la marca.** Los 25
> productos de Stunned en GN dan **markup mediana 128%**, y `config_costos` trae 130% ⇒ la casa ya
> corre a ~130 y no había nada que inventar. 🔴 **Pero ese 128% era falso**: se calcula con
> `precios_producto.costoManual` cargados el **14-jul** y nunca actualizados, entre **13% y 24% por
> debajo** de los costos de hoy ⇒ con los costos reales y los precios de la calle el markup caía a
> 58-124%. ▶️ **`/precios` sigue mostrando los markups inflados**: lee el manual, no el escandallo.
>
> 🔑 **La forma de pago cambia más que el margen**: transferencia y efectivo están configuradas
> como venta SIN factura ⇒ no descuentan IVA, IIBB ni DREI ⇒ **un 10% de descuento sin factura deja
> más plata que el precio entero con factura**. Pero con `saldoIvaFavor` activo se da vuelta: lista
> $4,36M contra $3,87M de transferencia. ⚠️ **$1,28M de diferencia entre las dos lecturas del IVA.**
> ⚠️ La config dice **Efectivo 10%**, y Bruno trabaja con **15%**: ▶️ hay que corregir `comisiones_pago`.
>
> 🏁 **La planilla para decidir**: `prisma/export-precios-stunned.ts` genera un `.xlsx` con fórmulas
> vivas (se toca el precio y se mueven markup, margen, precios con descuento y totales). Editable el
> precio y los parámetros; **el costo va bloqueado** y es una FOTO del día ⇒ si cambia la tela o el
> DTF hay que regenerarla, y lo dice adentro.
>
> 🔴 🔑 **EL TOKEN DE PRODUCCIÓN NO ESCRIBE, Y EL 403 NO DICE ESO.** `GESTIONNUBE_TOKEN` (51
> caracteres, generación vieja) lee perfecto y contesta **403 «Invalid ability provided»** en
> cualquier PATCH: es el mensaje de **Sanctum cuando al token le falta la ability**, o sea que ⛔ no
> es el campo ni el producto ni el permiso del usuario. El que escribe es **`GN_TOKEN_ZATTIA` del
> monitor** (52 caracteres), el mismo con el que `api/_liquidacion.js` pisa precios promocionales
> — **Stunned es una LÍNEA de Zattia**, así que sus productos viven en esa cuenta.
> ⚠️ La escritura contra GN **la bloquea el clasificador** ⇒ el script lo corre Bruno con `!`.
>
> 🔑 **En GN el SKU ⛔ NO está en el producto: está en la VARIANTE por talle** (`STU-REM-0024-S/M/L/XL`)
> y el `code` del producto viene en **null** ⇒ los 12 creados el 7-sep no aparecían buscando por
> código; **se los encuentra por INVENTARIO**. Y sin proveedor eran **invisibles para todo el
> sistema**: el cliente de GN filtra por proveedor propio, así que un producto con `provider: ""`
> no lo ve ni Reposición ni Precios.
> 🏁 `prisma/migrate-integrar-gn-stunned.ts` (aplicado, 13/13): `productos_estampados.sku` = la
> familia de SKU de GN, y `reposicion_mapeo` (gnId → skuLiso) = qué liso consume cada uno.
> 🔑 **La tabla va a mano con el nombre de GN al lado, ⛔ no derivada por texto**: «MADE» es a la vez
> una remera y un buzo.
> 🏁 `prisma/gn-precios-stunned.ts` (dry-run por defecto) escribe proveedor y precio con **dos
> seguros, los dos porque el fallo ⛔ no se ve mirando un 200**: compara el **NOMBRE contra el id**
> antes de tocar, y **relee lo que devolvió el PATCH** después. 📊 **Verificado por otro camino**:
> releyendo GN, los 13 con su precio y el proveedor intacto.
>
> 🏁 🔴 🔑 **LA VIDRIERA: escribir en GN ⛔ no basta, y el interruptor está POR VARIANTE.**
> El precio quedó bien en GN y Tienda Nube siguió en $1. La causa ⛔ no era el `code`, ni el
> proveedor, ni el vínculo (en Productos figuraban **«Vinculadas»** en verde): en
> **Integraciones → Tienda Nube → Stock y Precios → Precios**, las **48 variantes** (12 productos ×
> 4 talles) estaban en **«No configurado»** con el checkbox **«Act. precio» sin marcar**, y el botón
> dice *«Envía los precios **seleccionados**»* ⇒ mandaba **cero**.
> 🔑 **Y el delator fue CIRCLE BROWN**: es la única de las 13 que ⛔ NO aparecía entre las 48, y su
> $37.990 **había bajado solo**. Existe desde abril y ya tenía la variante configurada ⇒
> **una variante configurada SÍ sincroniza sola al cambiar el precio en GN; una nueva nace apagada.**
> Eso corrige el *«fila por fila y a mano»* del monitor: **a mano se prende el interruptor, una vez
> por variante**; después el precio viaja solo.
> ⚠️ **«proponer» ⛔ no era el botón**: esa acción es para productos que faltan **crear** en TN.
> 🏁 Aplicado (7-sep, por Chrome, con Bruno autorizando): marcadas las 48 y **«Guardar y Enviar»**.
> 📊 **Verificado: el filtro de diferencias pasó de 48 a 0 de 1289**, y SKATE $41.990 y CIRCLE BROWN
> $37.990 con **Precio TN = Precio GN**. ▶️ Queda mirar **«Filtrar Vínculos Rotos: 103»**, que es
> otra cosa y nadie revisó.
>
> 🔴 🔑 **Y el PATCH de GN acepta EXACTAMENTE TRES CAMPOS — lo dice él con un 422**:
> `retailer_price`, `wholesaler_price`, `tiendanube_promotional_price`. ⇒ **`unit_cost` y `provider`
> ⛔ NO se pueden escribir por API**, se cargan a mano (por eso el proveedor de los 12 hubo que
> ponerlo a mano). Con eso queda cerrado el *«nunca se probó que GN acepte esos dos campos»* del
> monitor, **medido en las dos direcciones**. ⚠️ `unit_cost` **tampoco vuelve** en
> `/productos/obtener` ⇒ el 0 que muestra el catálogo de bdi-catalogo para **todos** los productos
> es su default defensivo, ⛔ no un dato.
>
> 🔴 ▶️ **Lo que quedó abierto y es urgente: los 13 estaban en $1,00 y `activo = 1`.** El precio ya
> está puesto, pero **falta saber si estaban publicados en Tienda Nube** mientras tanto.
> ▶️ **CIRCLE BROWN tiene 0 de stock en GN**: las otras 12 ya suman 137 en Local, que son las 149 de
> la orden menos sus 12.

> **En esta sesión (7-sep), 7º tramo: EL LISO ENLAZADO — 6 productos decían «falta el
> escandallo» y el escandallo estaba.** De las **149 prendas** de la orden de lanzamiento sólo
> **35 tenían costo**. `productos_estampados` guarda el liso de dos formas —`lisoEscandalloId`
> (hay costo) o `lisoSku` (sólo la receta)— y los 13 de Stunned nacieron el **20-ago** apuntando
> al SKU porque todavía no había escandallo. Los escandallos aparecieron el **25-ago** y nadie
> volvió a apuntar.
>
> 🔴 🔑 **Lo peor no era el número faltante: era el cartel.** La pantalla decía «falta el
> escandallo» de 6 productos cuyo escandallo **existía, con ese mismo SKU** ⇒ mandaba a **rehacer
> un trabajo ya hecho**. Y la pantalla ya sabía que el escandallo manda (`lisosSoloSku` esconde el
> SKU pelado cuando hay uno con ese sku): la mitad del arreglo es que **lo diga**.
> Ahora dice **«el escandallo existe: enlazalo»** y el desglose **«Liso (sin enlazar)»**.
>
> 🏁 `prisma/migrate-liso-escandallo-por-sku.ts` (dry-run por defecto, `--aplicar` escribe) enlaza
> por **SKU exacto, ⛔ no por nombre**, y **se planta si hay dos escandallos con el mismo SKU**:
> eso es una ambigüedad real y elegir uno sería inventar cuál. **Aplicado: los 6.**
>
> 📊 **Medido después: 10 de 13 productos y 107 de 149 prendas con costo — $2.176.354** (y con los dos escandallos boxy de más abajo, **13 de 13 y 149 de 149**).
> Costo por prenda (liso + DTF + MO de estampería, márgenes 10/5, ya los únicos):
> CAMPERA WEAR $32.732 · BUZO FLECK $28.347 · BUZO MADE $25.730 · BUZO STND $25.588 ·
> BUZO PHRASE $23.056 · SKATE $16.334 · CIRCLE BROWN $15.656 · LONG BROWN $14.169 ·
> LONG OFF WHITE $14.122 · GRAPH $14.067.
>
> 🏁 **Y las 42 que faltaban también quedaron** (`53a9d4b`, `prisma/migrate-escandallo-remera-boxy.ts`):
> los lisos **STU-REM-BOXY-BL y -NG** tenían **97 u en stock**, **ningún escandallo** y ⛔ **ninguna
> OP de donde sacar el consumo medido** — la boxy quedó afuera de la tanda de 7 del 25-ago.
> 🔴 🔑 **El consumo de tela es ESTIMADO y se marca en TRES lugares que se ven** —el nombre del
> escandallo, las `notas` (la lista y la ficha las muestran) y el nombre de la tela—: **un número
> cargado sin marca pasa por medido**, y éste no lo es.
> 🔑 **Sale de la relación que dio Bruno** (planilla: oversize $9.400 · boxy $9.000 ⇒ **−4,26%**), y
> como todo lo demás es idéntico entre las dos —mismo taller, mismas operaciones— **la única
> variable es la TELA**: el script la **DESPEJA en vez de tipearla**, buscando el consumo que hace
> que el total dé 0,9574 del de la oversize del mismo color ⇒ **0,887 m** (blanca) y **0,890 m**
> (negra), contra 0,97 y 0,98.
> 🔴 ▶️ **Ese es el número a verificar con la prenda en la mano**: si la boxy no consume ~0,89 m, el
> costo está mal **en la misma proporción**. ⚠️ La boxy de Zattia gasta 0,70 m, bastante menos, pero
> es **otro molde y otra marca** ⇒ ⛔ no sirve de oráculo.
> 📊 **Cerrada la orden: 13 de 13 productos y las 149 prendas con costo — $2.731.881.**
> MADE $12.568 · STARRY $12.524 · TIME $14.940 (dos caras).
>
> 🏁 🔑 **UN SOLO MARGEN, y la idea que lo ordena: el escandallo FOTOGRAFÍA la config, ⛔ no opina.**
> El mismo liso valía dos números —la oversize blanca daba **$9.384** en la ficha y **$10.022** en
> `/costos/estampados`— y abajo ⛔ no había ningún costo distinto: la **base es $8.677 en las dos**.
> Eran los márgenes: la ficha usa los **congelados** en el escandallo (5/3) y estampados los de
> **config** (10/5), y eso está escrito a propósito en `lib/costos/costoSku.ts`.
> 📊 **Lo que decidió cuál**: 51 de 60 escandallos van **10/5**, igual que `config_costos` desde el
> 17-jul, y **los 9 de 5/3 son exactamente los del 25-ago, en LAS DOS marcas** (7 Stunned + 2
> Zattia) ⇒ ⛔ no es un criterio de marca, es **una tanda**. ⚠️ **El código de hoy no tiene ningún
> camino que escriba 5/3** (el editor estampa la config, `parseDatos` cae en 10): de dónde salió ese
> día **no se pudo determinar**.
> 🔑 **Se conserva el congelado** —existe para que un pasaje cerrado ⛔ no se mueva si mañana cambia
> la config— pero tiene que ser **una foto de la config, no una segunda opinión**.
> 🏁 `prisma/migrate-margenes-a-config.ts` (dry-run por defecto). **Aplicado a los 9: +6,8%** en la
> ficha y el PDF. `/costos/estampados` ⛔ no se movió (ya calculaba con config) y `pasaje_items` ⛔ no
> se toca (0 filas, y ahí el costo está congelado por ítem). **Verificado: la 2ª corrida da 0.**
>
> ⚠️ `STU-REM-OVER-BL` tiene los rubros cruzados contra sus hermanas: **corte $800 · tizada $450 ·
> lavadero $0**, donde las otras tres van **corte $450 · lavadero $800**. El total coincide
> ($1.250) así que ⛔ no cambia ningún costo, pero el desglose por rubro miente.

> **En esta sesión (7-sep), 6º tramo: LOS MINUTOS DE ESTAMPERÍA, CARGADOS Y MARCADOS COMO
> ESTIMADOS.** Los 13 de Stunned iban en **0 min**, y un 0 ahí ⛔ no dice «falta el dato»: **AFIRMA
> que estampar sale gratis**. Bruno: **~5 PLANCHADOS por hora ⇒ 12 min cada uno**.
>
> 🔴 🔑 **La unidad era la pregunta, y valía el doble.** 7 de los 13 diseños llevan **dos caras** ⇒
> las 149 prendas son **225 planchados**. Si «5 por hora» hubieran sido PRENDAS, la orden salía
> **$123.750**; siendo planchados sale **$247.500**. Es la misma trampa del 5º tramo (el ítem nombra
> una cara, el consumo es de la prenda) ⇒ **preguntar la unidad ANTES de multiplicar**.
>
> 🆕 🔑 **`minEstimado: true` en la línea del producto**, y **se marcaron los 32, no los 13**:
> `tiempos_estampado` está **VACÍO (0 tandas)**, así que **ninguno** de los minutos del sistema está
> medido — incluidos los **6 min** que los 19 de Zattia tenían tipeados desde antes. Marcar sólo los
> nuevos habría hecho parecer **medidos** a los viejos, que es peor que no marcar nada.
> La pantalla lo dice: chip **«≈ tiempo estimado»** y la MO con **≈** adelante. La marca **se apaga
> sola** al traer el valor con el ↓, que sale de tandas reales.
> ⚠️ El script **se niega a correr si ya hay tandas medidas**: una estimación ⛔ no pisa una medición.
>
> 📊 Estampado por prenda (DTF + MO): SKATE $6.312 · FLECK $6.827 · CIRCLE BROWN $5.587 · TIME $5.343
> · BUZO MADE $4.309 · LONG $4.100 · GRAPH $3.998 · CAMPERA $3.200 · BUZO STND $2.997 · STARRY $2.976
> · MADE $2.972 · PHRASE $1.456. **La orden: 45 h ≈ $247.500 de MO contra $394.011 de DTF** ⇒ la mano
> de obra es el **39%** del costo de estampar.
>
> ▶️ **Lo que lo reemplaza con un dato de verdad: UNA sola tanda.** El estándar del sistema sale de
> `Σ minutos ÷ Σ estampas` de `/estamperia/tiempos` y está en 0 porque **nunca se cargó ninguna**.
> Que el estampador anote hora de inicio, hora de fin y cuántas salieron.

> **En esta sesión (7-sep), 5º tramo: LA COMPRA DE DTF ENTRA A CUENTAS POR PAGAR, Y LA ORDEN
> CONTRASTA LO PEDIDO CONTRA LO COMPRADO** (puntos 3 y 4 del plan del precio).
>
> **3 · La plata entra UNA sola vez.** `POST /api/dtf/compras` con `crearGasto` crea el `Gasto`
> (`produccion`/`insumos`, monto = metros × $/m + flete, con proveedor, nº de factura y estado de
> pago) y guarda su id en `CompraDtf.gastoId` — que es **TRAZABILIDAD, no un monto**: el mismo
> criterio que arregló la cuenta de los cortadores, donde dos formas de restar lo mismo lo contaban
> dos veces. 🔴 **Y el DELETE se lleva el gasto con la compra**: si sólo se borrara la compra, la
> plata quedaría en cuentas por pagar sin nada que la explique.
>
> **4 · `lib/costos/ordenEstampaDtf.ts`**: cuánto rollo pide una orden según la TIRA, contra lo que
> se compró para ella (`CompraDtf.ordenId`, nuevo). Se ve en `/reposicion/ordenes`:
> **«la tira dice 41,5 m · se compraron 43,0 m (+4%)»**, en verde hasta 10% de desvío y en ámbar
> arriba. 🔑 Es el chequeo que caza al primero que se rompa —una medida mal, un precio mal, o un
> encastre peor del previsto—: era un script que había que acordarse de correr, y ahora está en la
> pantalla. Las órdenes de reposición dicen **«DTF sin medir»** con el motivo, porque van por
> producto de Gestión Nube y no tienen estampa con medida.
>
> 🔴 🔑 **Y el oráculo encontró un agujero que el código nuevo tenía**: la orden daba **40,0 m**
> cuando a mano daban 41,5. El ítem de la orden apunta a **UNA** estampa —la espalda—, pero la
> prenda lleva también el **frente**: otro planchado y otra área. Contando sólo la del ítem salía un
> número **creíble y 4% corto**, del que no se nota nunca. Se resuelve por la relación REAL
> (`ProductoEstampado`, que es donde vive qué caras lleva cada prenda), ⛔ **no por el sufijo `-F`**:
> atar la cuenta a una convención de nombres es esperar a que alguien la rompa.
> ⚠️ **La curva la manda el TALLE del ítem** (`curvaDeTalle`: S/M → T1, el resto → T2), no el
> `tamano` que tenga elegido el producto: acá se costea lo que se PIDIÓ, y lo pedido tiene talle.
>
> ✅ **Los dos verbos que escriben, ejercidos por HTTP contra el dev con cookie de admin** —no
> imitados—: POST con `crearGasto` (gasto atado, $10.500 = $10.500, `produccion/insumos/PENDIENTE`),
> el precio vigente **sin moverse** (la compra de prueba iba con fecha vieja), DELETE devolviendo
> `gastoBorrado: true`, **cero gastos huérfanos**, y la base igual que antes (1 compra, 148 gastos).
>
> 🏁 **La compra del 20-ago YA ESTÁ en cuentas por pagar y PAGADA** (Bruno lo confirmó el 7-sep):
> gasto de **$408.500**, `produccion/insumos`, `montoPagado` = el total, vinculado a la orden de
> lanzamiento. Se recargó **por la API** (borrar + crear con el tilde) en vez de parchear la fila:
> así el Gasto lo arma el mismo código que lo va a armar siempre.
> ⚠️ `fechaPago` quedó en **null**: está pagado pero ⛔ no se dijo cuándo. Se completa editando el
> gasto — un `PAGADA` sin fecha no miente, pero no sirve para un corte por período.

> **En esta sesión (7-sep), 4º tramo: EL PRECIO DEL DTF DEJÓ DE TIPEARSE — SALE DE LA COMPRA, Y LA
> ORDEN LO CONGELA.**
>
> 🔴 **El hallazgo que lo motivó: esa compra NO ESTABA CARGADA EN NINGÚN LADO.** Se buscó en
> `proveedores`, `compras` y `gastos`: **cero**. Los $408.500 (43 m × $9.500) no existían en el
> sistema, y el único rastro del precio era un número tipeado en `config_costos`. Por eso pudo
> quedar en **$11.500 contra $9.500** sin que nada avisara: 🔑 **un número tipeado no tiene fecha,
> así que no se puede ver viejo.**
>
> **1. `compras_dtf`** (fecha, metros, $/metro, **flete**, proveedor, nº de factura). El `$/metro` de
> todo el módulo sale de la **más reciente**, con el **flete adentro** — antes el flete no lo contaba
> nadie. Va liviana y no por `Compra`+`Insumo`+`Rollo` a propósito: nadie lleva stock de DTF, y es el
> mismo criterio con el que `EtiquetaCatalogo` reemplazó a Insumo+Lote para los avíos.
> ⚠️ Guarda la **MEDIDA, no la plata**: `gastoId` queda para linkear el Gasto si la factura tiene que
> entrar a cuentas por pagar (3er punto del plan, sin hacer) — **trazabilidad, no monto**.
>
> 🔑 **UN SOLO DUEÑO del precio: `lib/costos/dtfPrecio.ts`.** `config_costos.dtfPrecioMetro` no se
> borró pero **dejó de mandar**: es el **fallback** para el ambiente sin ninguna compra. Y la pantalla
> **dice cuál de los dos muestra** (*«de la compra del 20-ago · 43 m»* / *«cargado a mano · sin
> compra»*), más un aviso si el precio tiene **más de 90 días**. Dos fuentes conviviendo sin que se
> vea cuál manda es cómo se llega a la equivocada.
>
> **2. `ordenes_estampa.precioMetroDtf`**: snapshot del $/metro al crear la orden, como
> `pasaje_items.costoUnitario` y como el avío en el escandallo ⇒ **subir el precio de hoy ya no
> reescribe lo que ya se produjo**. Se ve en `/reposicion/ordenes`. ⚠️ Backfilleada **sólo la orden
> del 20-ago**, que es la de esa compra; las de jun/jul quedan en **0** (= «cae al vigente») porque de
> ésas ⛔ no se sabe el precio: **un snapshot inventado es peor que no tenerlo, parece medido**.
>
> 🔑 **Y de paso, `costoEstampa()` devuelve `null` también cuando NO HAY PRECIO.** Antes multiplicaba
> por 0 y devolvía **$0**, que es la misma mentira que el área nunca diciendo «no entra»: afirma que
> estampar sale gratis.
>
> ✅ Ejercido a mano contra la base: las 3 fuentes (compra / manual / ninguna), el precio vencido, dos
> compras del mismo día (gana la cargada después), el flete adentro (10 m a $9.000 + $5.000 = $9.500),
> el 30×30 sin precio dando `null`, y los 3 snapshots de órdenes.
>
> ▶️ **Queda sin hacer, del plan de 4:** el **3** (linkear la compra a un `Gasto` para cuentas por
> pagar) y el **4** (que la orden compare *«la tira dice 41,5 m · se compraron 43 m»*, que es lo que
> convierte en instrumento fijo la medición que hoy se corre a mano).

> **En esta sesión (7-sep), 3er tramo: EL PRECIO DEL DTF ESTABA MAL CARGADO — $11.500 contra
> $9.500 reales.** Lo corrigió Bruno junto con el metraje: pidió **43 m**, no ~44.
> `config_costos.dtfPrecioMetro` pasó a **9.500** ⇒ **todo el DTF baja 17%**.
>
> 🔑 **Y ese −17% casi cancela el +17% que había traído la tira en Stunned**: el costo por prenda
> queda parecido al de antes de los dos cambios, pero ahora **cada mitad es correcta** — antes se
> compensaban dos errores, un precio 21% alto contra un consumo 14% bajo. ⚠️ Es el caso clásico de
> [dos errores que se tapan](../../memory/feedback_areben_numero_que_parece_confirmar_otro.md):
> el total parecía sano y ninguna de las dos mitades lo estaba.
>
> 📊 **Con el precio bueno, la tira le erra 4% a lo que Bruno compró de verdad**: 41,5 m ($394.011)
> contra 43 m ($408.500), 1,5 m de sobra ($14.489). Es la validación más fuerte que tiene el modelo.
>
> ⚠️ `dtfPrecioMetro` es **un solo precio vigente, sin historial**: cambiarlo reescribe el costo de
> los 32 productos con estampa, también los ya producidos. Hoy es así en todo el módulo; si alguna
> vez hace falta costear a precio de la fecha, ahí entra `Estampa.precioMetroDtf`, que está dormido.

> **En esta sesión (7-sep), 2º tramo: EL COSTO DTF DEJÓ DE SER POR ÁREA Y PASÓ A SER POR TIRA.**
> Lo levantó Bruno: *«a veces no entra por tamaño, entonces si es por área se rompe»*. Tenía razón.
>
> 🔑 **El rollo se paga por METRO LINEAL a un ancho FIJO ⇒ lo que se cobra no es el ÁREA del diseño,
> es el LARGO DE ROLLO que se lleva.** Un 30×30 sobre 58 cm deja 28 cm muertos y esos 28 se pagan.
> Ahora `lib/costos/estampaCosto.ts` calcula cuántas entran a lo ancho —probando **las dos
> orientaciones**— y cuánto largo consume una unidad. `tiraEstampa()` devuelve `{porFila, girada,
> largoCm}` y la pantalla lo muestra: **«2/fila girada · 20,9 cm de rollo»**.
>
> 📊 **Medido contra la orden de 149 prendas, que es el único caso con una compra real al lado:**
> el área daba **36,9 m**, la tira da **41,5 m**, y Bruno pidió **43 m**. La tira le erra **4%**; el
> área erraba **14% para abajo**. 🔴 **Y no erraba parejo: iba de −7% a +93% según cómo cae la pieza contra los 58 cm** ⇒
> ninguna merma única lo tapa, subirla al promedio deja unas cortas y otras largas. Por marca: Zattia
> **+0%** (las baby tee son chicas y llenan la fila), Stunned **+17%**, GRAPH **+71%**.
>
> 🔴 **`mermaPercent` cambió de significado y por eso se puso en CERO en las 39.** El desperdicio de
> encastre ya está adentro de la tira; dejar el 15% viejo lo contaría **dos veces**. Lo que queda es
> el **RECHAZO** (planchas que salen mal) y **nadie lo midió**, así que va 0 y está dicho acá. Las
> fallas de PRENDA no se perdieron: ya viven aparte en `margenFallas`.
> ▶️ **Mano de Bruno: decir qué % de planchas sale mal**, o dejarlo en 0 a sabiendas.
>
> 🔑 **`costoEstampa()` ahora devuelve `number | null`**, y eso es la mitad del arreglo: el área
> **nunca decía «no entra»** —un diseño de 60×60 devolvía un costo tan campante—. `null` es
> «sin medida» o «no entra ni girada», y **el tipo obligó a atender los 11 lugares** que hubieran
> mostrado $0. En `/costos/estampados` una sola estampa sin número deja el DTF entero en «—» con el
> motivo (`EST-0XX sin medida` / `no entra en el rollo`), igual que ya hacía el liso.
>
> 🆕 `config_costos.dtfSeparacionCm` (default **0,5 cm**): el margen de corte entre estampas. En un
> diseño chico pesa tanto como el diseño (un 9×1 con 0,5 de margen es 50% más largo). Se edita en el
> banner de `/estamperia`. 🔴 **Va SIEMPRE junto al ancho y al precio**: `ProductosEstampados` lo
> tomaba sin él y calculaba distinto que `/estamperia`, sin que ninguna avisara cuál estaba bien.
>
> ⛔ **Lo que NO se hizo, y no por olvido: el ENCASTRE (mezclar diseños para llenar el hueco).**
> Se probó un empaquetado greedy por filas sobre las 225 estampas reales y dio **45,3 m — PEOR que
> la tira**. La ocupación real es 71-74% contra un piso teórico de 32,1 m, así que el ahorro existe
> (**9,4 m ≈ $89.000** en esta orden), pero **no está demostrado** y hace falta un nester de verdad.
> 🔑 Y cuando se haga, ese ahorro **cae entre dos cortes: es DEL PAÑO, no de la prenda** —igual que la
> merma del ribete en el tubo— ⇒ ⛔ no vuelve al escandallo, va en la pantalla de la orden de estampa.

> **En esta sesión (7-sep): LAS MEDIDAS DE LAS 13 ESTAMPAS DE STUNNED, y el FRENTE pasó a ser una
> estampa propia.** Las 13 estaban en `anchoCm = largoCm = 0`, así que el costo DTF de esos 13
> productos salía **$0** y el total no decía «falta»: decía un número más chico que el real.
>
> 🔑 **T1/T2 son las dos CURVAS del mismo diseño** (T1 = S/M, T2 = L/XL), que es lo que el escandallo
> elige con `tamano: 1 | 2`. **La otra CARA no entra ahí**: un diseño con espalda + frente son dos
> planchados y dos áreas de DTF ⇒ **dos filas en `estampas` y dos líneas en el `ProductoEstampado`**.
> Se crearon 7 estampas `-F` (`EST-021-F`, `EST-022-F`, `EST-025-F`, `EST-026-F`, `EST-027-F`,
> `EST-029-F`, `EST-030-F`) y la principal pasó a llamarse `… ESPALDA`. Script:
> `prisma/migrate-medidas-estampas-stunned.ts` (dry-run por defecto, `--aplicar` escribe).
>
> 📊 **Medido, con las 149 prendas de la orden y ninguna sin medida.** Deja de ser una estimación a
> ojo: el número sale de las medidas. ⚠️ La cuenta por ÁREA de este tramo quedó vieja en el 2º tramo
> (área → tira) y el precio se corrigió después: **el número bueno es 41,5 m ≈ $394.000** contra los
> **43 m ≈ $408.500** que se pidieron.
>
> 🔴 🔑 **BUZO FLECK vino MAL en el primer dictado, y lo delató una RAZÓN, no un ojo.** En los otros
> 12 diseños el L/XL es el S/M × **1,10**; los 4 números de FLECK daban 0,83 / 0,94 / 0,90 / 0,90 —el
> L/XL más CHICO que el S/M— y encima su espalda S/M era **carácter por carácter la de SKATE**. Se
> frenó la carga y Bruno los rectificó: la espalda L/XL es **38,9 × 48** (lo que decía «L/XL» era en
> realidad el S/M) y el frente tenía **las dos filas dadas vuelta**. Ahora las 4 razones dan 1,11.
> ⇒ **el chequeo quedó en el oráculo**: si alguna estampa sale de la banda 1,05–1,25 hay que mirarla.
>
> ⚠️ `EST-028 BUZO STND` mide **59,4 / 66 cm de ancho** contra un rollo de **58**: entra **girado**.
> El costo es por área, no cambia, pero el que arme el paño lo tiene que saber.
>
> ⚠️ Sigue abierto lo de siempre: los 13 productos van con **0 minutos** de estampería
> (`tiempos_estampado` está vacío), así que la mano de obra de estampado sigue en cero.

> **En esta sesión (4-sep), 5º tramo: SE PUEDE CAMBIAR EL NOMBRE DE UNA CORRIDA YA CREADA.** El
> nombre se tipeaba al encenderla y quedaba clavado con el error adentro. Ahora en la lista de
> `/calculadora` hay un **✎** al lado del nombre: se edita ahí mismo (Enter guarda, Escape cancela) y
> el `PATCH` acepta `nombre`. Vale también con la corrida terminada.
> ⚠️ **Lo que NO se reescribe es el `detalle` del registro del día**: se copia al cerrar, así que un
> relevamiento renombrado DESPUÉS de terminarlo deja el nombre viejo en el registro de la costurera.

> **En esta sesión (4-sep), 4º tramo: RELEVAMIENTOS EN SU PROPIA PANTALLA, EL RELOJ QUE NO VUELVE A
> CERO, Y UN GASTO QUE NO SEGUÍA A SU REGISTRO.**
>
> **`/tiempos/relevamientos`**: la lista se fue a su propia pantalla y en la home queda **una sola
> fila** («Relevamientos · 3 →»). Con varios cargados, la home quedaba larguísima. La consulta de
> «cuáles están abiertas» pasó a `corridasAbiertasDe()` en el núcleo, y la usan **la pantalla y la
> API**: una sola definición de qué ve cada una.
>
> 🔑 **El reloj grande dejó de ser el del TRAMO y pasó a ser el del PASO.** Al reanudar —y al cambiar
> de máquina, que también corta el tramo— volvía a **00:00:00** aunque los minutos sí se sumaran por
> detrás: el número contradecía a la costurera. Ahora `serializar` devuelve **`acumuladoSeg`** (los
> segundos cerrados de ese paso en esa prenda) y la tablet muestra `acumulado + lo que corre`. En
> pausa **se congela** y el reloj de la pausa corre chiquito abajo, que es lo que va aparte.
>
> 🔴 💵 **Y apareció uno de plata, VIEJO y no de la calculadora: editar un registro NO tocaba su
> gasto.** El `PATCH /api/tiempos/[id]` recalcula `minutosNetos` desde las horas y el `Gasto` de la
> muestra **quedaba con el valor viejo**. Medido en vivo: `Bombacha entera` quedó con el registro en
> **0 min** y el gasto en **20 min / $2.694**. ⇒ `sincronizarGastoDeMuestra()` en el núcleo, llamado
> desde el PATCH: el gasto sigue al registro y **se borra si quedan 0 minutos**. Sólo toca los gastos
> **automáticos** (sin proveedor ni seguimiento de pago). Mismo criterio que el `movimientoId` de un
> retiro de tela, que ya estaba escrito así. ▶️ **Queda el gasto de $2.694 del 4-sep para decidir**:
> es de una prueba y su corrida ya no existe.
>
> ⚠️ **Los 20 minutos salieron del tramo que quedó abierto** a las 10:20 mientras Bruno probaba:
> volvió a la corrida 15 minutos después y el paso se comió el rato. Es exactamente el agujero de
> **no tener reloj maestro**, y ahora se ve en la pantalla de relevamientos («⏱ el reloj está
> corriendo»).

> **En esta sesión (4-sep), 3er tramo: EL SELECTOR NO SE VEÍA PORQUE NO HABÍA QUÉ ELEGIR.**
> Bruno volvió a decir que no podía elegir con cuál arrancar. Medido en la base: **quedaba UNA sola
> corrida abierta**; las otras cuatro estaban terminadas —tres de ellas por los clicks de prueba de
> la mañana—. 🔑 **La lista no estaba rota: no había nada que listar.** Se recrearon las dos que se
> habían cerrado probando (`Corpiño triangulito con ruedo` y `Bombacha regulable`, con `notas` que
> lo dicen); las viejas quedan terminadas y se pueden anular. ⇒ ahora hay **3 abiertas**.
>
> 🔴 **Y lo clavado arriba le comía la pantalla.** El selector y el «Terminado hoy» estaban fuera del
> área que desliza. Ahora **el bloque de «Terminado hoy» no existe más** —lo terminado es un
> **registro del día**, al mismo nivel que un `Proceso Completado`— y el selector **bajó adentro del
> scroll**, arriba de «Registros de hoy». 🔑 **Pedido de Bruno como regla: en la tablet, lo único
> clavado es el cronómetro; el resto desliza.**
>
> 🆕 **Columna nueva `TiemposProduccion.detalle`** (`db push`, nullable, 717 registros intactos): sin
> ella el registro decía `Muestra - Relevamiento` y **no cuál prenda**. La llena el cierre de la
> corrida con `nombre · talle` y se ve abajo del título en el log.

> **En esta sesión (4-sep), 2º tramo: EL RELEVAMIENTO DEJA REGISTRO, Y LA PAUSA DEJA DE SER UN PASO.**
> Dos cosas que pidió Bruno después de usarla.
>
> 🔴 **Una corrida terminada no dejaba rastro en ningún lado.** Ni historial en la tablet, ni registro
> del día, ni costo: el rato que la costurera estuvo cosiendo la muestra **salía gratis**, mientras
> que la misma muestra cargada a mano con el cronómetro genera un `Gasto` de desarrollo. ⇒ al cerrar,
> la corrida **deja el registro de costura que ella hubiera cargado**: actividad
> **`Muestra - Relevamiento`** (o `Muestra - Medición`), marca y sku de la corrida, la máquina en la
> que MÁS tiempo estuvo, y **los minutos de TRABAJO sin las paradas** —el taller ya está adentro del
> `costoMinuto` absorbente—. 🔑 **La regla vive en UN solo lugar** (`lib/tiempos/registrar.ts`): si
> quedaba en el route handler, la muestra medida con el cronómetro costaba plata y la misma muestra
> medida con la corrida salía gratis. 💵 **Genera `Gasto` igual que `Muestra Zattia`.**
> ⚠️ **Marisol hoy carga el rato a mano** (el 2-sep: `Muestra Zattia`, 36 min) ⇒ **hay que avisarle
> que cuando use la corrida NO cargue además el registro**, o se cuenta dos veces.
> Y la tablet ahora muestra **«Terminado hoy»** con lo relevado, que es el historial que faltaba.
>
> 🔴 **La pausa se comportaba como un paso nuevo.** Tocar «Paré un momento» abría un tramo de parada
> y para volver había que **declarar de nuevo** qué se estaba haciendo. Ahora **Pausa** y **▶ Reanudar**
> viven pegados al cronómetro, la pantalla **no cambia**, y reanudar **vuelve al mismo paso** —
> `serializar` devuelve `reanudar` (el último tramo de trabajo de esa prenda, con su máquina). El
> tiempo de pausa se **junta y se muestra aparte** («pausas de esta corrida: X min»): sigue sin
> entrar al estándar. ⚠️ No se puede pausar si no hay nada corriendo.
>
> ▶️ **Falta ejercerlo en la tablet real** (terminar una corrida y ver el registro del día): acá no
> se pudo, el clasificador no deja firmar una sesión para probar de punta a punta.

> **En esta sesión (4-sep): LA TABLET MOSTRABA UNA SOLA CORRIDA.** Bruno cargó 4 relevamientos de
> bikini para Marisol y desde la tablet sólo podía entrar al primero. **La causa era un `findFirst`**:
> `GET /api/tiempos/corrida` devolvía **la corrida más vieja** de las abiertas, no la lista. ⇒ la
> única forma de llegar a la segunda era **terminar la primera**, y eso fue lo que pasó: quedaron
> `Corpiño triangulito con ruedo` (0,15 min) y `Bombacha regulable` (0,25 min) **cerradas con clicks
> de prueba**. 🔑 **Un endpoint que devuelve UNA fila donde hay muchas no se ve como un bug: se ve
> como que no hay nada más.**
> Ahora la tablet lista **todas** las corridas abiertas de esa costurera, con la que tiene el
> **reloj corriendo** primero y marcada —sin reloj maestro, un cronómetro olvidado en otra corrida
> sigue sumando y nada más lo delata—. El **admin ve todas** las abiertas, así se prueba sin la
> tablet de la costurera.
>
> 🔴 **Y de paso se midió un segundo defecto: la hora del primer tramo venía en UTC.** El único
> tramo que no trae hora del cronómetro es el primero de cada corrida, y ahí el servidor sellaba
> `new Date().toTimeString()`, que **en Vercel es UTC**: `Corpiño triangulito con ruedo` tiene
> `12:49:39 → 09:49:49`, o sea **arranca 3 horas después de terminar**. Los minutos no se tocan (los
> cuenta el cronómetro), pero la hora que se lee en la ficha miente. ⇒ `horaTaller()` en
> `corridaDb.ts`, sellada en `America/Argentina/Buenos_Aires`.
>
> ▶️ **Decisión de Bruno**: qué hacer con las 2 corridas cerradas por los clicks de prueba
> (reabrirlas borrando sus tramos, o crearlas de nuevo). ⚠️ Y las 4 se cargaron con el **mismo
> `tipoPrenda = 'bikini'`** siendo prendas distintas: el proceso vigente se busca **por
> `tipoPrenda`**, así que aprobar el del corpiño haría nacer en *medición* —con los pasos del
> corpiño— a las corridas de bombacha.

> **En esta sesión (26-ago), 2º tramo: EL TUBO.** Bruno usó la calculadora y volvió con tres
> correcciones. Las tres salieron de **ejercerla**, ninguna de leer el plan.
>
> 🔴 🔑 **La merma del ribete deja de CALCULARSE y pasa a MEDIRSE.** La cortacollaretas escupe una
> tira continua y de ahí salen los cortes **en orden**: 50 de Bajo Busto, 80 de Bajo Busto, y cuando
> viene una **unión —que no puede pasar—** se descartan 20 y se sigue. La fórmula vieja
> (`largoVuelta % largoPieza`) supone **un solo largo de pieza repetido**; la realidad son varios
> largos intercalados y una unión que **cae donde cae**. ⇒ modelo nuevo `CorridaCorteTubo`: un corte
> es de un ribete o es **desperdicio** (`ribeteId = null`), en el orden en que salió.
> 🔑 **El desperdicio NO es de ningún ribete: cae ENTRE dos cortes** ⇒ la merma medida es **del
> TUBO** y le corresponde por igual a todos los ribetes de la corrida.
> **Ejercido con el caso de Bruno**: 50 · 80 · ⚠20 · 50 ⇒ útil 180, desperdicio 20, total 200,
> **merma 10%**; Bajo Busto 130 cm/prenda (2 cortes), Tirita 50.
>
> 🔴 **`Tela.mermaMedida`**: con la merma medida, **el editor deja de recalcularla** al tocar los
> largos. Una fórmula no le pasa por encima a una medición. Verificado: guardó 10% donde la fórmula
> hubiera dicho 14,33%.
> ⚠️ **Y eso destapó un segundo lugar donde la fórmula ganaba igual**: `tiraPorTalle` la recalculaba
> **por talle** aunque estuviera medida. Se veía en que el costo por talle **no era proporcional al
> largo**. Corregido, y recién ahí la app coincidió con la cuenta a mano: talles S/M/L =
> **$169,71 · $176,50 · $183,56**, ponderado **$176,59**.
>
> 🔴 **El ancho del ribete lo define DISEÑO, no la costurera** (sale de la cortacollaretas).
> `CorridaRibete` pasó a ser la **definición** (nombre + ancho, cargada al encender la corrida) y
> **perdió `largoCm`**. Los largos viven en los cortes. Migración de datos idempotente
> (`prisma/migrate-cortes-tubo-ago26.ts`): los 150 y 30 cm que ya había cargado Bruno **se pasaron a
> cortes antes** del `DROP COLUMN`, no se perdió nada. Al aplicar, un ancho 0 **no pisa** el que ya
> tenga el escandallo.
>
> 🔴 **"Terminé la prenda 1" con UNA sola prenda inventaba una prenda 2.** Ahora en la última (o
> única) el botón es **"Marcar como terminado"** y cierra la corrida, con **"Coser una prenda más"**
> como secundario; el "Prenda 1 de 1" del encabezado desaparece. **Nombrar un paso que no va a
> pasar es peor que no tener el botón.**
>
> 🔴 **REGRESIÓN REPETIDA** contra el código **previo a toda la feature** (`b9f4523`): `costoTelas` y
> `costoTotal` de **los 60 escandallos**, idénticos. Diff vacío.
>
> **En esta sesión (26-ago): CALCULADORA DE PRODUCCIÓN.** Sección nueva `/calculadora` (permiso
> propio `calculadora`) para medir una muestra paso por paso y bajar el resultado al escandallo.
> Se viene la producción de bikinis y los dos números que más pesan —los minutos de confección y los
> centímetros de ribete— se tipeaban a mano.
>
> 🔑 **Casi nada se construyó de cero.** Ya existían el cronómetro con namespace
> (`lib/hooks/useCronometro.ts`), la tablet de la costurera, y el ribete como costo
> (`Tela.tipo='tira'`, valorizada por m² desde el $/kg con merma auto por las uniones del tubo).
> Estaban sueltos y ninguno sabía del otro. Lo nuevo es la corrida que los ata, el desglose por
> operación y la dimensión de TALLE, que el costeo no tenía en ninguna parte.
>
> 🔑 **La lista de pasos no se inventa: la descubre la primera corrida.** Sin proceso vigente para
> ese tipo de prenda la corrida nace en modo **relevamiento** —la tablet arranca sin lista y la
> costurera declara cada paso con su máquina mientras cose—; al cerrar se aprueba esa secuencia como
> `ProcesoPrenda v1` y de ahí en adelante las corridas nacen en **medición**. Los pasos se **copian**
> a `CorridaPaso`, no se referencian: aprobar una versión nueva no reescribe lo ya medido.
>
> 🔑 **El tiempo se parte en TRAMOS y en un solo lugar** (`lib/calculadora/corridaDb.ts`,
> `cerrarYAbrir`). Los cinco gestos de la tablet —cambiar de máquina, siguiente paso, agregar un
> paso, parar, terminar la prenda— son el mismo movimiento con distinto `siguiente`, y por eso
> **el cronómetro nunca se detiene** cuando cambia de máquina (era el pedido explícito: no terminar,
> cargar y crear uno nuevo). Un tramo es trabajo (`tipo='paso'`) o un hueco declarado
> (`tipo='parada'`), así que `Σ tramos = tiempo de reloj de la prenda` sale por construcción.
>
> 🔴 **Lo que MIDE la auditoría del proceso: el desvío repetido.** Un paso hecho parte en otra
> máquina en 1 de 3 prendas es una anécdota; en 3 de 3 dice que **ese paso son DOS pasos**, y la
> ficha lo dice con esas palabras y ofrece partirlo. **Ejercido en vivo** (corrida de prueba, ya
> borrada): `Ribete escote` definido en Collareta, real Collareta 61% / Recta 39%, **3 de 3 ⇒
> sistemático**. Trabajo por prenda **22,1 → 17,8 → 16,5 min** (baja, que es lo esperado en una
> muestra), promedio **18,8**; parada declarada 1,8 min.
>
> ⚠️ **Las paradas NO entran al estándar**: son tiempo del taller y el taller ya está adentro del
> `costoMinuto` absorbente (`lib/costoMinuto.ts`). Sumarlas al paso lo contaría dos veces.
>
> 🔴 **Se decidió NO poner reloj maestro** (el hueco lo declara la costurera). La consecuencia queda
> escrita: **una parada que no marque se disfraza de trabajo y nada la prueba**. La única señal
> indirecta es la dispersión entre prendas, que la ficha marca en ámbar arriba del 40%.
>
> **El ribete por talle — `Escandallo.datos` sube a `version: 4`.** `Tela.curva` (talle base + `+%`
> o `+cm` por escalón, con talles pisables a mano que la regla no toca) y `DatosEscandallo.mezclaTalles`.
> ⚠️ **Se promedian los COSTOS, no los largos**: la merma por empaque (`largoVuelta % largoPieza`)
> es distinta en cada talle, así que promediar cm primero da un número que existe y no significa.
> **Oráculo independiente** (`prisma/check-calculadora.ts` y la cuenta a mano en el JSON guardado):
> ribete 3 × 62 cm en talle 2, +4% por escalón ⇒ talles 1-5 = $89,40 · $90,56 · $91,55 · $92,37 ·
> $92,97, **ponderado $91,37** — coincide dígito por dígito con lo que muestra la pantalla.
> 🔴 **REGRESIÓN PROBADA**: `costoTelas` y `costoTotal` de **los 60 escandallos** son **idénticos**
> con el código v3 y con el v4 (diff vacío). Precios y `/costos/pasajes` no se enteraron.
>
> 📊 **Medido de paso: NINGUNO de los 60 escandallos usa una tira.** La capacidad de costear ribete
> existía en el código y **nunca se usó** ⇒ hoy el ribete de cualquier prenda no está costeado.
>
> 🔴 **Defecto encontrado ejerciendo, y arreglado:** al aplicar una corrida nace una tira **sin
> precio de tela**, que costaba **$0** y la ficha del escandallo igual decía "Telas ✓" — el total
> salía más chico y se declaraba completo (el cero que AFIRMA). Se sumó el chequeo
> **"Ribete / tiras · falta el precio de la tela ⇒ suma $0"** en `costos/escandallos/[id]/page.tsx`.
>
> ✅ **Cero cambios en `proxy.ts`**: el allowlist de la costurera es por prefijo
> (`startsWith('/tiempos')`), así que `/tiempos/corrida/[id]` y `/api/tiempos/corrida/*` entran
> solas. Verificado en vivo: la costurera entra a su corrida (200) y `/calculadora` la rebota a
> `/tiempos` (307). Las APIs de la tablet toman el usuario de **`session.nombre`, nunca del body**
> — a diferencia de `POST /api/tiempos`, que sigue tomándolo del body (decisión abierta, abajo).
>
> ▶️ **Manos que faltan:** darle el permiso `calculadora` a Lorena y a Stefania, y correr el
> **relevamiento real de la bikini** con Marisol — la lista de pasos de arriba es de una corrida de
> prueba, no del taller.
>
> **En esta sesión (25-ago):** cuatro pedidos. **(1) Las listas dejan de perder el filtro**: el
> estado de las 11 listas del repo pasó de `useState` a la URL (`lib/hooks/useParamState.ts`) y los
> detalles vuelven con `?volverA=` (`lib/volverA.ts`). El síntoma era "entro a un costo listo y al
> salir me vuelve a Pendientes de costear": el `← Volver` del PDF tiraba a `/costos` y el componente
> se remontaba. **(2) El costo de tela se ve POR TELA y por prenda**: `costoTelaFicha` era un escalar
> que mezclaba todas las telas. Ahora el editor y el PDF muestran una fila por tela (medido:
> ZAT-TOP-NG-013 = Encaje $753,74 + Microfibra $612,68 = los $1.366,42 de la OP, diferencia $0,00) y
> el PDF sumó columna **$/prenda** al lado de la del corte. **(3) Un corte imputado a un pago se
> puede editar** salvo el cortador, con aviso antes del formulario y traza (`EdicionCorte`).
> **(4) Pasajes a la marca**: `/costos/pasajes` junta las salidas de producto terminado, las valoriza
> al escandallo y cierra el total **sin IVA** que hay que cargar en el dashboard. Ver abajo.
>
> **En esta sesión (21-ago):** **la cuenta del cortador pasa a ser una cuenta corriente.** El saldo
> era "cortes cobrables sin imputar menos los pagos sin ítems", así que cargar un adelanto y después
> marcar como pagados los cortes que ese adelanto cubría descontaba la misma plata dos veces. Le
> pasó a Fernando por $130.200. Ahora: **todos los cortes menos todos los pagos**, y `pagoCorteId`
> es trazabilidad, no plata. Se puede **anular un pago**, y hay guards en los cuatro caminos que
> borraban deuda dejando el pago parado. Ver abajo.
>
> **En la sesión del 20-ago, 2º tramo:** **carga rápida de tizada por el taller.** Un botón
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

- [ ] 🔴 **El pasaje a la marca arranca VACÍO y depende de una mano.** Medido el 25-ago: de los 121
  `movimientos_terminado`, **cero** tienen `origen='venta'` (son estampa, produccion, inicial y
  ajuste). O sea que `/costos/pasajes` no va a mostrar nada hasta que alguien cargue las salidas a
  Zattia en *Inventario → Producto terminado* con origen «Venta». **El pasaje no inventa las salidas:
  las junta.** ✅ El circuito **sí quedó ejercido end-to-end** el 25-ago con una salida de prueba de
  1 unidad (STU-BUZ-AZ-001 XL): la pantalla la levantó sola, la asignó a **Stunned** leyendo la marca
  de la OP del SKU, la valorizó en **$21.600,03** (el costo del escandallo), se cerró el pasaje, la
  salida **dejó de listarse** (el sello anduvo), salió el documento imprimible, se anuló el pasaje y
  la salida **volvió** a pendientes. Todo deshecho después: stock de vuelta en 2, cero movimientos
  `venta`, cero pasajes.

- [ ] 🔴 **Fase B: que el número entre al dashboard.** Es otro repo (`areben-dashboard`), lo toca
  Darío y **hay un doble conteo real esperando**: `calcularReposicion` (`app/actions/finanzas.ts`)
  suma *a la vez* las compras con `negocio` de la marca y las de `negocio='PRODUCCION'` con
  `marca_pasaje` de la marca — y hoy el costo de producción ya entra a Zattia por
  `marcarProduccionPasada`, que es un traslado a costo **a propósito** (`057_marca_pasaje.sql`).
  Meter además una compra a "Areben" sin sacar el pasaje viejo **cuenta la mercadería dos veces**.
  Bruno lo dijo como *"subir el saldo compras y bajar el saldo producción"*. Dos cosas más de ese
  lado: no hay dimensión de EMPRESA (`marca` es un enum de marcas y `configuracion_empresa` es
  `CHECK (id = 1)`), y cargar el neto directo obliga a `porcentaje_facturacion = 0`, que le miente a
  los reportes de facturación/AFIP que se apoyan en ese campo. **Hablarlo con Darío antes de tocar.**


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

- [ ] **No se puede re-imputar un pago ya cargado.** Con la cuenta corriente eso no mueve ningún
  número —el vínculo es sólo la traza de qué cubrió cada pago—, pero el flujo que causó el
  descuadre de Fernando fue justamente "ya pagué, ahora quiero decir qué cortes cubría". Hoy la
  única forma es anular el pago y volver a cargarlo con los cortes tildados. Un `PATCH` limitado a
  `{ ordenIds, muestraIds }`, con monto y fecha inmutables, no podría mover plata por construcción.
  Los 17 cortes que quedaron sueltos al anular el pago duplicado son el caso de prueba.

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

- **La cuenta del cortador es una cuenta corriente (2026-08-21):**
  `saldo = TODOS los cortes cobrables + TODAS las muestras validadas − TODOS los pagos`.
  Antes la deuda eran sólo los cortes SIN `pagoCorteId` y sólo se restaban los pagos sin ítems: el
  invariante que lo sostenía —"un adelanto jamás cubre un corte que después se imputa"— no lo
  garantizaba ni una línea de código. 🔑 **Vincular un corte a un pago ya no mueve ningún número**,
  y de ahí sale el resto: la plata entra UNA sola vez, por el `monto`.
  - `lib/produccion/cuenta-cortador.ts` es el único lugar donde vive la regla. Exporta las dos
    puntas del predicado (`CORTE_COBRABLE` para el `where` y `esCorteCobrable(o)` para el filtro en
    memoria, con **parámetro obligatorio tipado**: si el `select` no trae los campos, no compila),
    `cuentaDe` / `cuentaPorCortador`, `movimientosDe` (el extracto) y `pagosSinCortador`.
    Las cuatro copias del predicado murieron con esto.
  - **POST de pagos-cortes: una sola rama**, con `monto` y `cortadorId` obligatorios. Se borró la
    que recalculaba el monto sumando los ítems — era el camino por el que la plata se inventaba.
    Los ítems se siguen validando (mismo cortador, sin pago previo, cobrables) porque una traza
    mentirosa es peor que no tener traza.
  - **`DELETE /api/produccion/pagos-cortes/[id]`**: anula el pago y desvincula sus ítems en la
    misma transacción (el `delete` explota por la FK si quedan colgados).
  - El detalle de la cuenta es un **extracto** (debe / haber / saldo acumulado, ascendente, con el
    corte imputado marcado "pagado dd/mm") y el formulario pasó de **dos cajas a una**: monto,
    fecha, nota y cortes tildables opcionales, **nada pre-tildado** (el pre-tildado convertía el
    botón en un "saldar todo" con monto inventado). Hub, panel del cortador y `PagosCortesClient`
    muestran **el mismo saldo, del mismo núcleo**: antes eran tres números distintos con nombres
    parecidos.
  - **Guards** en los cuatro caminos que borraban o movían deuda dejando el pago parado: revertir
    la ficha (`lib/produccion/corte.ts`, que cubre también la edición), el PATCH de edición rápida,
    el DELETE de la OP y la reasignación de cortador. Recién se pueden bloquear ahora: sin el
    DELETE de pagos, "está imputado" era un callejón sin salida.
  - **Datos reparados**: `prisma/migrate-pago-cortador-ago26.ts` le puso dueño a los 2 pagos que se
    ataban a Fernando sólo por sus ítems ($127.200 que la fórmula nueva habría perdido — por eso va
    ANTES de deployar), y se anularon **DOS** pagos duplicados con el DELETE nuevo: el de $130.200
    «saldado con pagos a cuenta», y uno de **$6.000 «descuento baby tee»** del 16-jul, cuando el
    corte `ZAT-REM-CH-001` («Baby tee con puños rosas», $6.000) ya estaba cobrado dentro del pago
    del 7-jul — ése era el hueco que dejaba ese pago en $78.300 con ítems por $72.300.
    🔑 El mismo error apareció dos veces a distinta escala: **conviene mirar los pagos sueltos cuyo
    concepto ya está cobrado como corte.**
    La cuenta de Fernando quedó **en cero hasta el 19-ago** ($251.400 cortados contra $251.400
    pagados) y debiendo **$22.500**: los 3 cortes del 20-ago (`ZAT-TOP-NG-013/015/016`).
  - **Verificado contra la base** con `prisma/check-cuenta-cortadores.ts`, que va en **SQL crudo y
    no importa el núcleo** a propósito. Deuda 273.900 (38 cortes) · pagos 251.400 (5) · **saldo
    22.500**, y las pantallas dicen "Saldo pendiente: $22.500". Ejercido a mano: un pago de $1 baja
    el saldo $1 **tilde cortes o no** (con un corte de $7.500 tildado la deuda no se movió),
    anularlo lo devuelve exacto, la request vieja sin monto ahora da 400, y los cuatro guards dan
    400. El rojo se vio: con el código viejo, revertir un corte imputado lo dejó en `costoCorte 0`
    con el pago intacto.

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


- **Las listas ya no pierden el filtro al volver (2026-08-25):** no había **ni un** `useSearchParams`
  en todo el repo, así que cualquier ida a otra ruta desmontaba el componente y el filtro volvía a su
  default. Hook nuevo `lib/hooks/useParamState.ts` (`useParamState` / `useParamBool` / `useParamSet` /
  `useParamTexto` con debounce para los buscadores / `useVolverA`) y **11 listas** migradas:
  Escandallos, Cola de producción, Pagos de cortes, Fichas de corte, Rollos, Insumos, Compras, Kanban
  de diseño, Producto terminado, Movimientos y Qué estampar. Cada page que las usa quedó envuelta en
  `<Suspense>` — sin eso el build falla con *"useSearchParams() should be wrapped in a suspense
  boundary"*. La segunda mitad es el regreso: `?volverA=` (la convención que ya existía en
  `/produccion/[id]/corte`) se extendió al PDF del escandallo, al detalle de gasto, al proyecto de
  diseño, y se le **agregó un `← Volver` que no existía** al detalle de OP, al de rollo y al de compra.
  `lib/volverA.ts` valida el destino: un `//otro-host` también empieza con `/`, y sin ese filtro el
  botón era un redirect abierto. ⚠️ La selección múltiple con checkboxes NO va a la URL a propósito
  (es transitoria y ya se limpiaba al cambiar de filtro); `QueEstamparClient.modo` tampoco, porque es
  un paso de flujo a medio hacer y restaurarlo con los edits vacíos sería peor que no restaurarlo.

- **El costo de tela, por tela y por prenda (2026-08-25):** cuando el costo viene de la ficha,
  `datos.costoTelaFicha` es **un escalar** que ya mezcla todas las telas: en un top de encaje +
  microfibra no se podía saber cuánto pone cada una. El desglose por rollo existía sólo en el PDF y
  ahí la columna de plata era **la del corte entero**. Ahora: `agruparPorArticulo()` en
  `lib/produccion/fichaConsumo.ts` (la agrupación que estaba inline en la page del PDF, ahora
  compartida), `/api/costos/ficha-resumen` devuelve `telas[]` con `metrosUnit`/`costoUnit` y pasó a
  reusar `fichaDetalleSku` en vez de repetir su query, el editor muestra una fila por tela y el PDF
  sumó **`$/prenda`** (la vieja `Costo` se llama ahora **`$ corte`**). 🔑 **El desglose CIERRA contra
  el total o dice por qué no**: lo que no salió de un rollo (insumos secundarios del corte, redondeo)
  aparece como *"Otros insumos del corte"* en vez de esconderse. Medido el 25-ago sobre 3 SKU reales
  de dos telas: diferencia $0,00 en los tres. La tabla quedó en 9 columnas y **entra** (608px de 608
  disponibles, y en impresión el texto es más chico).

- **Editar un corte ya pagado (2026-08-25):** seis guards bloqueaban tocar un corte imputado y el
  aviso aparecía **recién al guardar**. Con la cuenta corriente de hoy (todo lo cortado − todo lo
  pagado) cambiar el monto es aritméticamente seguro: el saldo se mueve por la diferencia. **Lo único
  que descuadra es cambiar de cortador** — la deuda se muda a otra cuenta y el pago se queda en la
  primera. Entonces: el PATCH y el POST de ficha rechazan **sólo** el cambio de cortador (400),
  `revertirCorteOrden` tomó un parámetro `permitirImputado` que **sólo** usa la edición (el revert
  suelto sigue bloqueado: dejaría el corte en $0 con el pago restando ⇒ inventa saldo a favor), y
  `asignar-cortador` y `carga-tizada` **no se tocaron**. El aviso va arriba del formulario con el
  monto y la fecha del pago y link a la cuenta; el select de cortador queda deshabilitado con su
  motivo. Traza en el modelo nuevo `EdicionCorte` (se escribe **sólo** si hay pago), visible en el
  detalle de la OP y como chip *"editado después"* en el extracto del cortador.
  ⚠️ **De paso se tapó un agujero que la edición habilitaba:** `CorteEditRapido` prellenaba la fecha
  de corte con **hoy** cuando la ficha no la tenía guardada (las viejas no la tienen). Antes daba
  igual porque no se podía guardar; ahora guardar le habría escrito la fecha de hoy a un corte de
  junio — y la fecha del corte es por donde se ordena el extracto. Ahora va vacía y no se manda.
  **Ejercido en vivo el 25-ago** sobre ZAT-REM-NG-001 (Fernando, imputado al pago del 25/06 por
  $48.900): guardar sin cambiar plata dio 200 donde antes daba 400, el saldo quedó en **$0,00 antes y
  después**, `fechaCorte` siguió en `null` y quedó la fila de traza; pedirle al server que le sacara
  el cortador dio **400** con el mensaje correcto.

- **Pasajes a la marca — «Zattia le compra a Areben» (2026-08-25):** lo que sale del stock terminado
  del taller, para la marca es una **compra**, y su total **sin IVA** es lo que había que poder cargar
  en `areben-dashboard` — información que hoy allá **no existe**. Modelos nuevos `Pasaje` /
  `PasajeItem` + `MovimientoTerminado.pasajeId`. Pantalla `/costos/pasajes` (permiso `costos`): junta
  las salidas con `origen='venta'` **todavía sin pasaje**, las agrupa por SKU+talle, las valoriza al
  **costo del escandallo** y cierra el mes. Tres cosas que sostienen el número:
  🔑 **el total es neto por construcción** (el escandallo se arma con precios netos: no hay ninguna
  división por 1,21 en ningún lado) · 🔑 **el costo se congela en los ítems al cerrar** (un escandallo
  que cambie después no mueve un pasaje ya cerrado) · 🔴 **`pasajeId` es el guard contra el doble
  conteo**: el `UPDATE ... WHERE pasajeId IS NULL` hace que dos cierres simultáneos no puedan llevarse
  el mismo movimiento. **Sin escandallo no hay total**: el SKU sin costear se lista como faltante y
  **bloquea** el cierre. Un pasaje no se edita: se **anula** (suelta los movimientos) y se rehace.
  El costo por SKU se extrajo a `lib/costos/costoSku.ts`, que estaba escrito en tres lados — ⚠️ y ahí
  apareció una divergencia real: **Precios usa los márgenes GLOBALES y la lista/PDF los CONGELADOS en
  el escandallo**; el helper la toma por parámetro para no cambiarle el número a Precios sin querer.
  El pasaje usa los congelados, que es lo que corresponde a un documento.

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
