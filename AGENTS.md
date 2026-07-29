<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# areben-produccion

Taller propio de Areben: diseño, inventario de insumos, producción (corte/costura/estampa),
costos/escandallos, precios y reposición. Next 16 (App Router) + Prisma/Postgres + auth custom.

**No confundir con `areben-dashboard`** (financiero/comercial: gastos, pagos, cierre, nómina) ni
con `monitor-areben` (stock y rotación de venta). Este repo es el taller: lo que pasa antes de que
la prenda llegue a stock vendible.

Este archivo se carga en **cada** sesión de IA: cada línea se paga siempre. Entra solo lo que evita
un error caro o una búsqueda repetida. Techo: 160 líneas.

## ⛔ Invariantes — romper una de estas cuesta caro

**Permisos: una sola fuente, `lib/permisos.ts` (`PERMISOS`).** Todo módulo o acción nueva se gatea
contra una key de ese registro — nunca se hardcodea acceso por rol. Lo consumen el sidebar, la
gestión de usuarios, `requirePagina()`/`requirePaginaAlguno()` (guard de página, `lib/page-guard.ts`)
y `requirePermiso()`/`requireAlguno()` (guard de API, `lib/auth.ts`). Admin tiene todos los permisos
siempre; costurera y estampador ninguno (su acceso es la tablet, ruteada por `proxy.ts`). Los
guards revalidan `activo` contra la DB en cada request: el token es stateless y no refleja bajas.

**`proxy.ts`: `/auth/callback` es pública a propósito.** Es la vuelta de Google con el `code` a
canjear, sin sesión todavía. Si se la tratara como ruta privada, el login entra en loop infinito
(login → Google → callback → login → …). Costurera y estampador quedan confinados a `/tiempos` y
`/estampado` respectivamente; cualquier otra ruta los rebota ahí.

**`POST /api/usuarios` es público solo si `Usuario.count() === 0`.** Es el alta del primer admin en
un ambiente nuevo (no hay todavía quién lo autorice). Con usuarios ya creados, exige el permiso
`usuarios` como cualquier otra API. El `GET` sin sesión nunca devuelve datos reales: `[]` si la
tabla está vacía, 403 en cualquier otro caso.

**Login con Google es solo verificación de identidad.** `app/auth/callback/route.ts` canjea el code
con Supabase, lee el email, lo busca en `Usuario.activo`, y si matchea emite la cookie de sesión
PROPIA (`areben_session`, HMAC vía `lib/session.ts`) — la de Supabase se cierra al toque, nunca
queda viva. El resto de la app no sabe que hubo Google de por medio.

**SKU: código operativo `MARCA-PRENDA-COLOR-NNN` (sin talle) durante producción.** El talle se
agrega recién al cerrar la OP (`MARCA-PRENDA-COLOR-NNN-TALLE`), momento en que nace el SKU
comercial. `LoteProduccion` agrupa OPs por marca + 2º segmento del SKU (la prenda/molde): dos
prendas con abreviatura distinta no se agrupan aunque compartan marca y color, ni se puede mover
una OP a un lote que ya tiene varios colores sin desarmarlo (`api/produccion/lote/agrupar`).

**El costo de Precios sale del Escandallo vinculado por `skuLiso`, no de Gestión Nube.**
`preciosData.ts` matchea `Escandallo.sku` contra `ReposicionMapeo.skuLiso`; si no coinciden letra
por letra el join da vacío y `costoAuto` queda `null` — ahí entra `costoManual` como fallback (se
carga a mano). `GnProducto.precioMayorista` (`wholesaler_price` de GN) se guarda pero **no** se usa
como costo en ningún lado: el costo real siempre es el escandallo.

**Gestión Nube: `per_page ≤ 50`, API inestable.** `lib/gestionnube/client.ts` reintenta con backoff
ante 500/429/timeout; 401/403 no reintentan (token inválido o sin scope). Providers propios:
`zattia`, `areben`, `stunned`.

**Cargar una factura de compra de telas** (criterio por defecto salvo que Bruno diga otra cosa):
flete siempre, **8% del neto** si la factura no lo trae; `estadoPago: 'PENDIENTE'` salvo que diga
explícitamente que está pagada; `colorProveedor` = el nombre que trae la factura (el color interno
se asigna después); facturas A traen precio neto por kg, `totalBruto` = neto × 1,21. Telas en USD:
guardar `costoUnitario` en pesos (precio × TC) y además `Rollo.costoUnitarioUsd` con el flete
incluido, para poder revaluar después sin tocar escandallos/cortes ya cerrados (tienen snapshot).

## Arquitectura

Auth propia por cookie HMAC (`lib/session.ts`), sin NextAuth. Roles: `admin` / `costurera` /
`diseñadora` / `estampador`. Prisma + Postgres (`lib/prisma.ts`), sin Supabase para datos — Supabase
solo entra en el canje de OAuth de Google (`lib/supabase-server.ts`, `lib/supabase-client.ts`).
Imágenes a Vercel Blob (`/api/upload-imagen`, filesystem de Vercel es efímero).

Prisma como fuente de tipos: 62 modelos en `prisma/schema.prisma`. Migraciones sin versionar en el
repo (`prisma migrate` corre a mano); scripts puntuales en `prisma/*.ts` para migrar datos.

`docs/CAPITAL_PRODUCCION.md` (746 líneas) es el documento maestro del módulo de producción/costos:
estados de OP, trazabilidad de insumos por Rollo/Lote, reparto de costo por unidad efectiva. Leerlo
completo antes de tocar ese módulo — las decisiones ya están discutidas ahí, no re-derivarlas.

## Mapa de módulos

`sidebar → seccion (permiso) → rutas`, de `components/layout/Sidebar.tsx`:

- **Diseño** (`diseno`) — proyectos (Kanban), moodboard, lanzamientos, molderías
- **Inventario** (`insumos`) — telas, avíos, rollos, movimientos, ajustes, producto terminado (con
  `produccion`), catálogo. Modelo de dos pistas: telas trazables por `Rollo` (peso/costo por kg),
  avíos por `Lote` (FIFO automático)
- **Compras** (`insumos` u `gastos`) — altas de factura, cuentas por pagar
- **Producción** (`produccion`) — `ColaAdmin.tsx` (929 líneas, no fragmentar) crea OP/lote; fichas
  de corte, tiempos, muestras, reportes, solicitudes de cambio, cortes/pagos por cortador
- **Estampería** (`estamperia`) — catálogo DTF, tiempos de estampado, tablet en `/estampado`
- **Reposición** (`reposicion`) — qué estampar, órdenes de estampa, vínculo SKU↔GN
- **Costos** (`costos`) — `Escandallos.tsx` (1.189 líneas, el más grande del repo), productos con
  estampa, parámetros, catálogos
- **Precios** (`precios`) — resumen, lista, comisiones/medios de pago, descuentos/Sale
- **Gastos** (`gastos`) — gastos del taller (no se mezcla con compras de insumos)
- **Mis cortes** (`cortador`) — panel propio del cortador, sin acceso al resto
- **Configuración** (`configuracion`/`usuarios`/`cortadores`/`motivos`/`proveedores`)

## Comandos

```bash
npm run dev      # next dev
npm run build    # prisma generate && next build
npm run lint     # eslint
```

**No hay `test` ni CI** (sin `.github/workflows/`, sin suite de tests). Nadie corre nada por vos:
`lint` + `build` antes de pushear es la única red.

## Higiene de contexto

Todo lo que entra al contexto se re-paga en cada turno, así que un output largo temprano cuesta
varias veces su tamaño.

- **Los archivos caros se leen por rango, no enteros.** Los peores: `components/costos/Escandallos.tsx`
  (1.189 líneas) · `components/produccion/ColaAdmin.tsx` (929) · `components/diseno/ProyectoView.tsx`
  (751) · `components/produccion/ReportesClient.tsx` (652) · `docs/CAPITAL_PRODUCCION.md` (746 — leer
  completo solo si se toca ese módulo, no de arrastre).
- **Comandos largos van cortados**: `git log`, builds con `| tail -30`.
- **Avisar el `/clear` al cerrar cada unidad de trabajo** — Bruno no lo tiene que pedir. El marcador
  natural es después de deployar y verificar. El criterio no es "cambió el tema" sino **"¿vamos a
  volver a abrir los mismos archivos?"**. Dentro de una tarea sin terminar va `/compact`, no `/clear`.

## Estado del trabajo

`PENDIENTES.md` es la bitácora viva (actualizar al cerrar sesión) — leerlo antes de asumir qué
sigue. Al 2026-06-25: cerrada "Producción agrupada por molde" (3 fases). Próximo foco sugerido:
hallazgos de la auditoría jun-2026 (GET sin auth, guards invertidos, descuadres al deshacer
producción, pagos).

## Estilo

Acento **ámbar** (`text-amber-600`, foco `focus:border-amber-400`), Tailwind v4 directo sobre
`app/globals.css` (sin tokens CSS propios como en monitor/dashboard). Kit en `components/ui/`:
`Button` · `Badge` · `Card` · `Input` · `Select` · `Textarea` · `PageHeader` · `DataTable` ·
`NumInput` (resuelve el "problema del 0": muestra vacío en vez de `0`, selecciona todo al enfocar)
· `ImageDrop` (sube a Blob, úsalo en vez de un input de archivo nuevo). Reusar antes de escribir un
componente nuevo.
