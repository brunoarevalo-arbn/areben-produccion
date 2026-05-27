# Módulo: Capital de Producción

> Documento maestro. Contiene todas las decisiones de diseño del módulo. Es la fuente única de verdad. Cualquier agente o desarrollador que trabaje sobre este módulo debe leerlo completo antes de codear.

## 0. Objetivo del módulo

Hacer visible y valorizable el capital inmovilizado en producción en cualquier momento, y generar el ajuste contable mensual para que el P&L refleje el costo real del período (no el costo de producción).

Cubre tres pilares unificados:
1. **Stock de insumos por rollo/lote** con costo real
2. **Producción con estados granulares** y costo acumulado en tiempo real
3. **Cierre mensual valorizado** con snapshot inmutable

Reemplaza la lógica binaria actual de OrdenProduccion (`pendiente / en_produccion / terminado`) por un flujo trazable de punta a punta: desde que entra una compra de tela hasta que se vende una prenda terminada.

## 1. Contexto del sistema actual

Este módulo se construye sobre `areben-produccion` (Next.js 16 App Router, TypeScript estricto, Prisma + SQLite en dev / Postgres en prod, Tailwind crudo, auth custom). Respetar `AGENTS.md` del repo: Next.js 16 tiene breaking changes; consultar `node_modules/next/dist/docs/` antes de escribir routing/caching/data-fetching.

**Lo que se mantiene intocado:**
- `/diseno` (proceso creativo con Kanban)
- `/tiempos` (tablet de costureras, mismo flujo)
- `/stock` (inventario terminado, ahora con costos reales)
- `/gastos` (no se mezcla con compras de insumos productivos)
- Auth, permisos por handler, estética visual
- Convención de SKU sin talle: `MARCA-PRENDA-COLOR-NNN`

**Lo que se amplía:**
- `OrdenProduccion` gana ficha de corte + estados granulares + costos acumulados
- `TelaCatalogo` evoluciona a catálogo de insumos genérico (con tipo de trazabilidad)
- Catálogo SKU al cerrar OP genera variantes con talle (`MARCA-PRENDA-COLOR-NNN-TALLE`)

## 2. Decisiones consolidadas

| Tema | Decisión |
|---|---|
| **Estructura producción** | Una sola OrdenProduccion por corte (sin entidad OrdenCorte separada) |
| **Código operativo** | `MARCA-PRENDA-COLOR-NNN` (sin talle). Lo que ve la costurera. |
| **SKU comercial** | `MARCA-PRENDA-COLOR-NNN-TALLE`. Nace al cerrar la OP. |
| **Talles** | Solo se cargan al cerrar la OP (ingreso a stock). Durante producción no existen. |
| **Reparto de costo (tela, MO, estampa)** | Por unidad efectiva. Costo total OP / unidades vendibles. |
| **Insumos: telas, vinilo DTF (v2)** | Trazables por Rollo (ID único, peso, costo por kg/m) |
| **Insumos: etiquetas, badanas, hilos, avíos** | Trazables por Lote (cantidad, ID único, FIFO automático) |
| **Estados de OP** | PENDIENTE → CORTE → COSTURA → TERMINADO_SIN_ESTAMPA → ESTAMPA → CONTROL_CALIDAD → CERRADA |
| **Retroceso de estado** | Permitido con motivo (queda en EstadoTransicion) |
| **Asignación de rollos** | Manual con sugerencia FIFO (porque cada rollo es heterogéneo) |
| **Consumo de lotes secundarios** | FIFO automático según Escandallo |
| **Merma de producción** | Al cerrar OP: unidades descartadas + motivo. Costo se reparte entre efectivas. |
| **Transformaciones** | Lisa → estampada como movimiento separado que consume stock + servicio |
| **DTF v1** | Servicio externo con costo por unidad |
| **DTF v2** | Vinilo trazado por rollo + cálculo de área por estampa (futuro) |
| **Estado de pago de compras** | PENDIENTE / PARCIAL / PAGADA + fecha + monto |
| **Producción para terceros** | No se modela (solo Areben) |
| **Foto ficha de corte** | Opcional |
| **Reversión de movimientos** | Siempre permitida para admin, con auditoría completa |
| **Cierre mensual** | Snapshot inmutable. Reversible con warning. |
| **Migración inicial** | Automática para OPs viejas + costo Escandallo para stock terminado + conteo físico solo de telas |

## 3. Modelo de datos

### 3.1 Nuevas entidades

```prisma
model Proveedor {
  id              Int      @id @default(autoincrement())
  nombre          String
  cuit            String?
  condicionIva    String?  // 'RI' | 'MONOTRIBUTO' | 'EXENTO' | etc.
  contacto        String?
  notas           String?
  activo          Boolean  @default(true)
  compras         Compra[]
  serviciosExt    ServicioExterno[]
}

model Compra {
  id              Int       @id @default(autoincrement())
  proveedorId     Int
  proveedor       Proveedor @relation(fields: [proveedorId], references: [id])
  fecha           DateTime
  numeroFactura   String?
  conIva          Boolean   @default(true)
  totalBruto      Decimal   // lo que dice la factura
  totalNeto       Decimal   // sin IVA
  formaPago       String?
  estadoPago      EstadoPago @default(PENDIENTE)
  montoPagado     Decimal   @default(0)
  fechaPago       DateTime?
  notas           String?
  creadoPor       Int       // FK Usuario
  creadoAt        DateTime  @default(now())
  lineas          CompraLinea[]
  rollos          Rollo[]
  lotes           Lote[]
}

enum EstadoPago { PENDIENTE PARCIAL PAGADA }

model CompraLinea {
  id              Int      @id @default(autoincrement())
  compraId        Int
  compra          Compra   @relation(fields: [compraId], references: [id])
  insumoId        Int      // FK Insumo (catálogo)
  cantidad        Decimal
  unidad          String   // 'kg' | 'metro' | 'unidad'
  precioUnitario  Decimal  // ya neto
  subtotal        Decimal
}

model Insumo {
  id              Int      @id @default(autoincrement())
  nombre          String
  categoria       String   // 'tela' | 'vinilo' | 'etiqueta' | 'badana' | 'hilo' | 'aviso' | 'packaging' | etc.
  tipoTrazabilidad String  // 'rollo' | 'lote'
  unidadDefault   String   // 'kg' | 'metro' | 'unidad'
  stockMinimo     Decimal?
  activo          Boolean  @default(true)
}

model Rollo {
  id              Int      @id @default(autoincrement())
  codigo          String   @unique  // R-0001, autogenerado
  insumoId        Int
  insumo          Insumo   @relation(fields: [insumoId], references: [id])
  compraId        Int
  compra          Compra   @relation(fields: [compraId], references: [id])
  pesoInicial     Decimal
  pesoActual      Decimal
  costoUnitario   Decimal  // $ por kg/metro
  estado          EstadoRollo @default(DISPONIBLE)
  ubicacion       String?
  fotoUrl         String?
  movimientos     MovimientoInsumo[]
}

enum EstadoRollo { DISPONIBLE EN_USO_PARCIAL AGOTADO DESCARTADO }

model Lote {
  id              Int      @id @default(autoincrement())
  codigo          String   @unique  // L-0001
  insumoId        Int
  insumo          Insumo   @relation(fields: [insumoId], references: [id])
  compraId        Int
  compra          Compra   @relation(fields: [compraId], references: [id])
  cantidadInicial Decimal
  cantidadActual  Decimal
  costoUnitario   Decimal
  estado          EstadoLote @default(DISPONIBLE)
  movimientos     MovimientoInsumo[]
}

enum EstadoLote { DISPONIBLE EN_USO_PARCIAL AGOTADO }

model MovimientoInsumo {
  id              Int      @id @default(autoincrement())
  tipo            TipoMovimiento
  rolloId         Int?
  rollo           Rollo?   @relation(fields: [rolloId], references: [id])
  loteId          Int?
  lote            Lote?    @relation(fields: [loteId], references: [id])
  ordenId         Int?     // FK OrdenProduccion si es consumo
  cantidad        Decimal  // positivo: ingreso; negativo: consumo/descarte
  motivo          String?  // obligatorio para AJUSTE y DESCARTE
  fotoUrl         String?
  usuarioId       Int
  fecha           DateTime @default(now())
  revertidoPor    Int?     // FK MovimientoInsumo (si esto es una reversión)
  reversionNota   String?
}

enum TipoMovimiento { INGRESO CONSUMO AJUSTE DESCARTE REVERSION }
```

### 3.2 OrdenProduccion (existente, ampliada)

```prisma
model OrdenProduccion {
  // campos existentes
  id              Int      @id @default(autoincrement())
  sku             String   // código operativo sin talle: MARCA-PRENDA-COLOR-NNN
  descripcion     String
  marca           String
  cantidad        Int      // total planificado a producir
  notas           String?
  creadoPor       Int
  creadoAt        DateTime @default(now())
  
  // campos nuevos
  estado          EstadoOP @default(PENDIENTE)
  fichaCorteCargada Boolean @default(false)
  fichaFotoUrl    String?
  
  // costos acumulados (se actualizan automáticamente)
  costoTela       Decimal  @default(0)
  costoInsumosSecundarios Decimal @default(0)
  costoManoObra   Decimal  @default(0)
  costoEstampa    Decimal  @default(0)
  costoTotal      Decimal  @default(0)  // suma de los 4
  
  // cierre
  unidadesEfectivas Int?   // se carga al CERRAR
  unidadesDescartadas Int? @default(0)
  motivoDescarte  String?
  cerradoAt       DateTime?
  cerradoPor      Int?
  
  // relaciones
  transiciones    EstadoTransicion[]
  movimientosInsumo MovimientoInsumo[]
  tiempos         TiemposProduccion[]
  servicios       ServicioAplicado[]
  ingresosStock   IngresoStock[]
}

enum EstadoOP {
  PENDIENTE
  CORTE
  COSTURA
  TERMINADO_SIN_ESTAMPA
  ESTAMPA
  CONTROL_CALIDAD
  CERRADA
}

model EstadoTransicion {
  id              Int      @id @default(autoincrement())
  ordenId         Int
  orden           OrdenProduccion @relation(fields: [ordenId], references: [id])
  estadoAnterior  EstadoOP?
  estadoNuevo     EstadoOP
  fecha           DateTime @default(now())
  usuarioId       Int
  notas           String?
}

model ServicioExterno {
  id              Int      @id @default(autoincrement())
  nombre          String   // 'DTF', 'Bordado', 'Lavado', etc.
  proveedorId     Int?
  proveedor       Proveedor? @relation(fields: [proveedorId], references: [id])
  costoUnitario   Decimal
  activo          Boolean  @default(true)
}

model ServicioAplicado {
  id              Int      @id @default(autoincrement())
  servicioId      Int
  servicio        ServicioExterno @relation(fields: [servicioId], references: [id])
  ordenId         Int
  orden           OrdenProduccion @relation(fields: [ordenId], references: [id])
  cantidad        Int
  costoTotal      Decimal
  fecha           DateTime @default(now())
}

model IngresoStock {
  id              Int      @id @default(autoincrement())
  ordenId         Int
  orden           OrdenProduccion @relation(fields: [ordenId], references: [id])
  skuComercial    String   // MARCA-PRENDA-COLOR-NNN-TALLE
  talle           String
  cantidad        Int
  costoUnitario   Decimal  // costoTotal OP / unidadesEfectivas
  fecha           DateTime @default(now())
}

model TransformacionInterna {
  id              Int      @id @default(autoincrement())
  skuOrigen       String
  cantidadOrigen  Int
  servicioId      Int
  skuDestino      String
  cantidadDestino Int
  costoServicio   Decimal
  costoUnitarioDestino Decimal
  usuarioId       Int
  fecha           DateTime @default(now())
}

model CierreMes {
  id              Int      @id @default(autoincrement())
  periodo         String   @unique  // 'YYYY-MM'
  fechaCorte      DateTime
  cerradoAt       DateTime @default(now())
  cerradoPor      Int
  
  valorInsumosSinCortar    Decimal
  valorEnCorte             Decimal
  valorEnCostura           Decimal
  valorTerminadoSinEstampa Decimal
  valorEnEstampa           Decimal
  valorControlCalidad      Decimal
  valorStockTerminado      Decimal
  totalActivoInventario    Decimal
  
  comprasDelMes   Decimal
  cmvDelMes       Decimal
  mermaDelMes     Decimal
  
  ajusteContable  Decimal  // vs cierre anterior
  detalle         Json     // snapshot completo, inmutable
  
  estado          EstadoCierre @default(CERRADO)
  reabiertoAt     DateTime?
  reabiertoPor    Int?
  motivoReapertura String?
}

enum EstadoCierre { CERRADO REABIERTO }
```

### 3.3 Migración del modelo existente

- `OrdenProduccion.estado` actual (`pendiente / en_produccion / terminado`) migra a:
  - `pendiente` → `PENDIENTE`
  - `en_produccion` → `COSTURA` (estado más probable)
  - `terminado` → `CERRADA` + se crea registro `IngresoStock` retroactivo con costo del Escandallo
- `TelaCatalogo` se mantiene pero se considera deprecated; los registros existentes se migran a `Insumo` con `categoria='tela'`, `tipoTrazabilidad='rollo'`.
- Stock terminado existente: se calcula costo unitario inicial usando el Escandallo del SKU correspondiente, se carga como `IngresoStock` con fecha del deploy.

## 4. Pantallas y rutas

```
/insumos                          Listado de insumos con stock total + expandir rollos/lotes
/insumos/compras                  Lista de compras
/insumos/compras/nueva            Form de carga (cabecera + líneas + rollos/lotes)
/insumos/compras/[id]             Detalle de compra
/insumos/rollos                   Vista plana de rollos
/insumos/rollos/[id]              Historial de rollo
/insumos/lotes                    Vista plana de lotes
/insumos/movimientos              Auditoría completa
/insumos/ajustes                  Cargar ajustes físicos

/produccion                       (existente) lista de OPs con estados granulares y costos
/produccion/[id]                  Detalle de OP
/produccion/[id]/ficha            Cargar/editar ficha de corte (rollos + lotes + foto)
/produccion/[id]/cerrar           Pantalla de cierre con desglose por talle y merma
/produccion/transformar           Lisa → estampada
/produccion/cierre                Vista de cierre mensual con todos los estados
/produccion/cierre/[periodo]      Detalle de cierre cerrado, exportable

/configuracion/proveedores        CRUD proveedores
/configuracion/insumos            CRUD catálogo de insumos
/configuracion/talles             Tabla de talles por tipo de prenda
/configuracion/servicios          CRUD servicios externos (DTF, etc.)
```

## 5. Pantallas clave — detalle de UX

### 5.1 `/insumos/compras/nueva`

Form de una sola página con tres secciones:

**Cabecera:**
- Proveedor (selector con búsqueda)
- Fecha
- Número de factura (opcional)
- Toggle "Precios con IVA" (default: ON)
- Forma de pago
- Estado de pago (PENDIENTE / PARCIAL / PAGADA)
- Si PARCIAL o PAGADA: monto pagado + fecha
- Notas

**Líneas:**
Tabla editable. Cada fila: insumo (selector), unidad, cantidad, precio unitario, subtotal calculado.

**Rollos/Lotes** (sub-tabla bajo cada línea):
- Si el insumo es `tipoTrazabilidad=rollo`: agregar rollos con peso individual. La suma debe coincidir con cantidad de la línea.
- Si es `tipoTrazabilidad=lote`: se crea un solo lote con la cantidad total. Sin sub-tabla.

**Validaciones:**
- Suma de subtotales = total factura (con o sin IVA según toggle)
- Suma de rollos = cantidad de la línea (si aplica)
- Al guardar: se calcula `totalNeto` automáticamente, se crean rollos/lotes con costo unitario neto.

### 5.2 `/produccion/[id]/ficha`

Form de carga de ficha de corte. Solo activable cuando la OP está en estado `PENDIENTE` o `CORTE`.

**Sección 1: Consumo de tela**
- Tela esperada según Escandallo (informativo)
- Consumo real (kg/metros)
- Tabla de rollos disponibles del insumo, ordenados por antigüedad (FIFO sugerido)
- Checkbox para seleccionar rollos + cantidad a usar de cada uno
- Validación en vivo: suma asignada = consumo real

**Sección 2: Insumos secundarios (auto)**
- Tabla con insumos del Escandallo (etiquetas, badanas, hilos)
- Cantidad esperada del Escandallo, lote sugerido (FIFO), input editable
- Solo informativo: se descuentan al confirmar

**Sección 3: Foto** (opcional, drag-and-drop)

**Sección 4: Notas**

**Resumen:**
- Costo de tela, costo de insumos secundarios, total base
- Botón "Confirmar corte" → descuenta rollos/lotes, pasa OP a estado CORTE, guarda costos.

### 5.3 `/produccion/[id]/cerrar`

Solo activable cuando OP está en `CONTROL_CALIDAD`.

```
Cierre de OP-0234
─────────────────────────────────────
Producción planificada:  60 unidades
Costo total acumulado:   $234.567
  Tela:           $107.430
  Insumos sec.:     $2.340
  Mano de obra:   $115.200
  Estampa:          $9.597

Cargar resultado del control:
─────────────────────────────────────
Unidades descartadas: [_2] 
Motivo:              [falla de costura ▼]
Unidades efectivas:   58 (calculado)

Desglose por talle:
  XS  [_8]
  S   [14]
  M   [20]
  L   [11]
  XL  [_5]
  ────────
  TOTAL 58 ✓ (debe coincidir con efectivas)

Costo unitario final: $4.044 ($234.567 / 58)

Se crearán 5 líneas de stock:
  STN-REM-NEG-042-XS · 8 u  · $4.044
  STN-REM-NEG-042-S  · 14 u · $4.044
  STN-REM-NEG-042-M  · 20 u · $4.044
  STN-REM-NEG-042-L  · 11 u · $4.044
  STN-REM-NEG-042-XL · 5 u  · $4.044

Merma valorizada: $8.088 (2 u × $4.044)

[Cancelar] [Confirmar cierre]
```

Al confirmar: se crean `IngresoStock` por talle, OP pasa a `CERRADA`, stock terminado se actualiza, merma queda registrada.

### 5.4 `/produccion/cierre`

Dashboard de cierre mensual. Selector de fecha (default: fin de mes actual). Muestra:

```
Cierre al 31/10/2026

INSUMOS SIN CORTAR (rollos + lotes disponibles)    $XXX
EN CORTE (OPs estado CORTE)                        $XXX
EN COSTURA                                         $XXX
TERMINADO SIN ESTAMPA                              $XXX
EN ESTAMPA                                         $XXX
EN CONTROL DE CALIDAD                              $XXX
STOCK TERMINADO                                    $XXX
─────────────────────────────────────
TOTAL ACTIVO DE INVENTARIO                       $XXXXX

REFERENCIA DEL MES
Compras del mes:                                 $A.AAA
CMV (vendidos a costo):                          $B.BBB
Merma:                                             $CCC

COMPARATIVA
Activo cierre anterior (30/09):                  $YYYYY
Ajuste contable (variación):                      $ZZZ

[Exportar Excel] [Cerrar mes] (solo admin, solo si fecha = fin de mes)
```

Si ya está cerrado el mes seleccionado: muestra el snapshot guardado, no recalcula. Botón "Reabrir" disponible para admin con warning.

## 6. Endpoints API

```
# Insumos
GET    /api/insumos                       Listado con stock
POST   /api/insumos                       Crear insumo en catálogo
PUT    /api/insumos/[id]
GET    /api/insumos/rollos                Lista de rollos
GET    /api/insumos/rollos/[id]           Detalle + historial
GET    /api/insumos/lotes
GET    /api/insumos/movimientos
POST   /api/insumos/ajustes               Cargar ajuste físico

# Compras
GET    /api/compras
POST   /api/compras                       Crea compra + rollos/lotes en una transacción
GET    /api/compras/[id]
PUT    /api/compras/[id]/pago             Actualizar estado de pago
POST   /api/compras/[id]/revertir         Reversión total (admin)

# Producción
GET    /api/produccion/cola               (existente, ampliada con estado granular y costos)
PATCH  /api/produccion/cola/[id]/estado   Cambiar estado, registra EstadoTransicion
POST   /api/produccion/cola/[id]/ficha    Cargar ficha de corte
POST   /api/produccion/cola/[id]/cerrar   Cerrar OP con desglose por talle
POST   /api/produccion/transformar        Lisa → estampada

# Servicios externos
GET    /api/servicios
POST   /api/servicios
POST   /api/produccion/cola/[id]/servicio Aplicar servicio a OP

# Cierre
GET    /api/cierre/snapshot?fecha=YYYY-MM-DD   Calcula sin guardar
POST   /api/cierre                              Crear cierre formal (admin)
GET    /api/cierre/[periodo]
POST   /api/cierre/[periodo]/reabrir            Admin only, con auditoría
GET    /api/cierre/[periodo]/export             Excel

# Catálogos
GET/POST/PUT  /api/proveedores
GET/POST/PUT  /api/talles
```

## 7. Permisos

| Rol/Permiso | Acceso |
|---|---|
| `admin` | Todo |
| `diseñadora` | Ver costos, crear OPs, cargar ficha de corte, mover estados, cerrar OPs, ver cierre |
| `encargado_corte` (nuevo) | Cargar fichas de corte (consumo de rollos + insumos) |
| `deposito` (nuevo) | Cargar compras, cargar ajustes físicos |
| `costos` | Ver cierre y reportes valorizados, sin modificar |
| `costurera` | Solo /tiempos, sin cambios |

Permisos chequeados handler por handler (sin middleware), siguiendo convención del repo.

## 8. Plan de implementación por fases

### Fase 1 — Insumos básico (2 semanas)
**Objetivo:** Visibilidad y valorización del stock de insumos.

- Schema Prisma: Proveedor, Insumo, Compra, CompraLinea, Rollo, Lote, MovimientoInsumo
- Migration con seed de proveedores iniciales (lo definimos con Bruno)
- Endpoints: compras, insumos, rollos, lotes, movimientos
- Pantallas: `/insumos`, `/insumos/compras`, `/insumos/compras/nueva`, `/insumos/rollos`, `/insumos/lotes`
- Conteo físico inicial de telas (cargar manualmente como "rollos iniciales")

**Criterio de éxito:** Bruno puede cargar una compra completa, ver el stock actualizado, ver los rollos disponibles con su costo.

### Fase 2 — Ficha de corte y consumo (2 semanas)
**Objetivo:** Cada OP nace con costo de tela real, no estimado.

- Ampliar `OrdenProduccion` con campos nuevos
- Schema `EstadoTransicion`
- Migration de OPs viejas (script)
- Pantalla `/produccion/[id]/ficha` con asignación FIFO y validaciones
- Descuento de rollos y lotes al confirmar ficha
- Estados granulares funcionando

**Criterio de éxito:** Una OP nueva pasa por todo el flujo, costo de tela e insumos secundarios se descuentan y registran correctamente.

### Fase 3 — Servicios externos, cierre de OP y transformaciones (1-2 semanas)
**Objetivo:** Trazabilidad completa hasta stock terminado.

- Schema `ServicioExterno`, `ServicioAplicado`, `IngresoStock`, `TransformacionInterna`
- Pantalla `/produccion/[id]/cerrar` con desglose por talle y merma
- Catálogo de servicios externos
- Pantalla `/produccion/transformar`
- Integración con `/stock` existente: ingresos crean líneas de stock con costo real

**Criterio de éxito:** OP completa cierra correctamente, stock terminado se actualiza con costo unitario real desglosado por talle.

### Fase 4 — Cierre mensual (1-2 semanas)
**Objetivo:** Cierre contable exacto, snapshot inmutable.

- Schema `CierreMes`
- Endpoint `/api/cierre/snapshot` con cálculo de todos los estados
- Pantalla `/produccion/cierre` con vista actual y selector de fecha
- Botón "Cerrar mes" con creación de snapshot inmutable
- Export Excel
- Reversión de cierre con auditoría

**Criterio de éxito:** Cierre del mes actual cuadra contra el activo de inventario físico real (±5%).

### Fase 5 — Reportes y pulido (continuo)
- Merma por proveedor / tela / motivo
- Rinde por OP (kg consumidos / unidades producidas)
- Histórico de precios
- Costo real vs Escandallo (desviaciones)
- Tiempo promedio por estado (cuellos de botella)
- Alertas de stock bajo

### Fase v2 (futuro)
- DTF como insumo trazado por rollo de vinilo
- Cálculo de área por estampa, tiempo de máquina DTF
- Multi-depósito si aparece la necesidad
- Integración API con ERP

## 9. Convenciones de código

Seguir las del repo:
- Componentes en `components/<modulo>/` (ej: `components/insumos/`, `components/produccion/`)
- Lógica de negocio en `lib/<modulo>/` (no en componentes)
- Validación con Zod antes de escribir DB
- Permisos verificados en cada handler
- Estética: `rounded-2xl`, `border-stone-200`, foco `focus:border-amber-400`, botones primarios `bg-stone-900 text-white`
- Sin emojis
- Transacciones Prisma para operaciones multi-tabla (ej: crear Compra + Rollos)

## 10. Casos de uso a respetar

### Caso 1: Compra simple
1. Llega compra de Tex Sur, 80kg de modal negro en 4 rollos, $1.000.000 con IVA, factura A-0099
2. Bruno carga: proveedor, factura, líneas, 4 rollos con su peso individual
3. Sistema crea 4 rollos con costo unitario = $1.000.000 / 1.21 / 80 = $10.330/kg

### Caso 2: Corte y producción
1. Diseñadora aprueba modelo, crea OP con SKU `STN-REM-NEG-042`, cantidad 60
2. Cortador corta, manda ficha por WhatsApp con foto
3. Diseñadora carga ficha: 8.4kg modal negro (3.5kg R-0142 + 4.9kg R-0143), 60 etiquetas L-0007, 60 badanas L-0008
4. OP pasa a CORTE, costo de tela = $86.772, costo insumos sec. = $2.340
5. Costureras trabajan, registran tiempo en `/tiempos` al código `STN-REM-NEG-042`
6. Tiempo total: 600 min × $192/min promedio = $115.200 → costoManoObra
7. OP pasa por TERMINADO_SIN_ESTAMPA → ESTAMPA (se aplica servicio DTF, 60 × $160 = $9.600)
8. CONTROL_CALIDAD: 2 unidades con falla
9. Cierre: 58 unidades efectivas. Costo total $213.912 / 58 = $3.688 unitario
10. Desglose: 8/14/20/11/5 por talles XS/S/M/L/XL
11. Stock se actualiza con 5 SKUs comerciales

### Caso 3: Transformación lisa → estampada
1. Hay 30 unidades de `STN-REM-NEG-042-M` (lisas) en stock
2. Bruno decide estampar 20 con motivo "Calavera"
3. Pantalla `/produccion/transformar`: SKU origen, cantidad 20, servicio DTF
4. Sistema descuenta 20 lisas, aplica costo de servicio (20 × $160 = $3.200)
5. Crea 20 unidades de nuevo SKU `STN-REM-NEG-042-DTF-CALAVERA-M` con costo = (costo unitario lisa + $160)

### Caso 4: Reversión
1. Bruno se da cuenta que cargó una compra con precio equivocado
2. Va a `/insumos/compras/[id]` y aprieta "Revertir"
3. Sistema crea movimientos inversos (rollos se anulan), queda registro en auditoría
4. Bruno carga la compra correcta de nuevo

### Caso 5: Cierre de mes
1. 31 de octubre, Bruno va a `/produccion/cierre`
2. Sistema muestra snapshot calculado al día
3. Bruno revisa, exporta a Excel para mandarle al contador
4. Aprieta "Cerrar mes" → snapshot inmutable guardado como `CierreMes` con periodo='2026-10'
5. Si después descubre un error grande, puede reabrir con warning

## 11. Lo que NO va en este módulo

- Stock terminado sigue en `/stock`, solo se alimenta de los `IngresoStock`
- Ventas y CMV viven fuera del módulo (solo se reciben referencias)
- Gastos no productivos (alquiler, sueldos) siguen en `/gastos`
- Prorrateo de gastos fijos al costo unitario (puede sumarse en v2)
- Predicción de stock, multi-depósito, integración AFIP, app móvil nativa

## 12. Setup inicial requerido

Antes de Fase 1 productiva, Bruno debe:
1. Listar proveedores estables
2. Listar insumos por categoría con su tipo de trazabilidad (rollo/lote)
3. Definir talles por tipo de prenda
4. Conteo físico de telas (cuántos rollos, peso de cada uno, costo estimado)
5. Listar servicios externos vigentes (DTF y proveedor)

Lo demás se carga sobre la marcha.

---

**Última actualización:** este documento se mantiene vivo. Cualquier cambio de decisión debe quedar reflejado acá antes de codear.
