// Carga del corte de la NYA (ficha de corte del 16-oct-2026, cortada el 20-oct, Fernando).
//
// 4 órdenes —una por estampa, NYA 1 a 4—, agrupadas en un lote de colores, directo en
// COSTURA, con el corte cargado por el taller y la separación en lotes PROGRAMADA: el Lote 1
// (6·6·3 = 15 por estampa, igual que la AYLA) y el Lote 2 (el resto) se activan cuando la
// costurera deja la remalladora y confirma en la tablet. Mismo molde que
// cargar-tayra-estampas-oct26.ts. La de flores se cortó a la mitad (8·8·4) ⇒ su Lote 2 es 2·2·1.
//
// 🔴 El precio del corte NO está en la ficha ⇒ el corte queda 'cargado' (falta validar) y SIN
// precio: validar-corte se planta hasta que se cargue. No se inventa plata del cortador.
//
//   npx tsx --env-file=.env prisma/cargar-nya-estampas-oct26.ts            # muestra el plan
//   npx tsx --env-file=.env prisma/cargar-nya-estampas-oct26.ts --aplicar  # escribe
//
// ⚠️ Escribe en la base a la que apunte DIRECT_URL/DATABASE_URL. Se planta si alguna de las
// 4 órdenes ya existe: correrlo dos veces no duplica nada.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { separarLote } from '../lib/produccion/lotesPlanificados';

const APLICAR = process.argv.includes('--aplicar');
const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const MODELO = 'Bikini NYA corpiño tipo sport + bombacha regulable';
const FECHA_CORTE = '2026-10-20';
// Ficha: «consumo t.2ada 1,72 × 10 (conjunto)» — lycra + muselina, como la TAYRA.
const TIZADAS = [
  { id: 't1', nombre: 'lycra', modo: 'tizada', metros: '1.72', unidades: '10', rollos: [] },
  { id: 't2', nombre: 'muselina', modo: 'tizada', metros: '1.72', unidades: '10', rollos: [] },
];
type Talles = { S: number; M: number; L: number };
const LOTE1: Talles = { S: 6, M: 6, L: 3 };       // la curva del Lote 1 (Bruno, 13-oct)
const ESTAMPAS: { color: string; abrev: string; estampa: string; cortado: Talles }[] = [
  { color: 'Flores violetas + cuadrillé violeta', abrev: 'FLOVIO', estampa: 'NYA-1 flores + ribete cuadrillé', cortado: { S: 8, M: 8, L: 4 } },
  { color: 'Cuadrillé amarillo',                  abrev: 'CUADAM', estampa: 'NYA cuadrillé amarillo',         cortado: { S: 16, M: 16, L: 8 } },
  { color: 'Cuadrillé rosa',                      abrev: 'CUADRS', estampa: 'NYA cuadrillé rosa',             cortado: { S: 16, M: 16, L: 8 } },
  { color: 'Cuadrillé rosa y verde',              abrev: 'CUADRV', estampa: 'NYA cuadrillé rosa y verde',     cortado: { S: 16, M: 16, L: 8 } },
];

const suma = (t: Talles) => t.S + t.M + t.L;
const filas = (t: Talles) => (['S', 'M', 'L'] as const).map((talle) => ({ talle, cantidad: t[talle] }));

async function main() {
  console.log(`Base: ${url.replace(/:[^:@/]+@/, ':***@').replace(/\?.*/, '')}`);
  console.log(APLICAR ? '▶ APLICANDO' : '◻ SÓLO PLAN (agregá --aplicar para escribir)');

  const fernando = await prisma.cortador.findFirst({ where: { nombre: 'Fernando', activo: true } });
  const bruno = await prisma.usuario.findFirst({ where: { email: 'brunoarevalo@arebensrl.com' } });
  if (!fernando) throw new Error('No encuentro al cortador Fernando');
  if (!bruno) throw new Error('No encuentro el usuario de Bruno');

  const resta = (a: Talles, b: Talles): Talles => ({ S: a.S - b.S, M: a.M - b.M, L: a.L - b.L });
  for (const e of ESTAMPAS) {
    const n = suma(e.cortado), l2 = resta(e.cortado, LOTE1);
    if (await prisma.ordenProduccion.findFirst({ where: { sku: { startsWith: `ZAT-BIK-${e.abrev}-` } } })) {
      throw new Error(`Ya existe una orden ZAT-BIK-${e.abrev}-…: no toco nada (¿ya se corrió?)`);
    }
    const ocupada = await prisma.skuCatalogo.findFirst({ where: { categoria: 'color', abreviatura: e.abrev } });
    if (ocupada && ocupada.nombre !== e.color) throw new Error(`${e.abrev} ya es «${ocupada.nombre}» en el catálogo`);
    console.log(`  ZAT-BIK-${e.abrev}-001  ${e.color} (${e.estampa})  S${e.cortado.S}·M${e.cortado.M}·L${e.cortado.L} = ${n}` +
      `  →  Lote 1 = S${LOTE1.S}·M${LOTE1.M}·L${LOTE1.L} = ${suma(LOTE1)}  ·  Lote 2 = S${l2.S}·M${l2.M}·L${l2.L} = ${suma(l2)}`);
  }
  const total = ESTAMPAS.reduce((s, e) => s + suma(e.cortado), 0);
  console.log(`  TOTAL ${total} u · corte Fernando: SIN PRECIO (queda «cargado», falta validar)`);
  if (total !== 140) throw new Error(`La ficha suma 140 y acá da ${total}`);
  if (!APLICAR) return;

  const session = { id: bruno.id, nombre: bruno.nombre, rol: 'admin', username: '' } as never;
  await prisma.$transaction(async (tx) => {
    // Los 5 colores al catálogo de SKU (si no están).
    const maxOrden = await tx.skuCatalogo.aggregate({ where: { categoria: 'color' }, _max: { orden: true } });
    let orden = (maxOrden._max.orden ?? 0) + 1;
    for (const e of ESTAMPAS) {
      const ya = await tx.skuCatalogo.findFirst({ where: { categoria: 'color', abreviatura: e.abrev } });
      if (!ya) await tx.skuCatalogo.create({ data: { categoria: 'color', nombre: e.color, abreviatura: e.abrev, orden: orden++ } });
    }

    const lote = await tx.loteProduccion.create({
      data: { marca: 'Zattia', prenda: 'BIK', descripcion: `${MODELO} — estampas sublimadas`, creadoPor: bruno.nombre },
    });

    for (const e of ESTAMPAS) {
      const n = suma(e.cortado);
      const op = await tx.ordenProduccion.create({
        data: {
          sku: `ZAT-BIK-${e.abrev}-001`,
          descripcion: `${MODELO} · ${e.color}`,
          marca: 'Zattia',
          cantidad: n,
          cantidadCortada: n,
          notas: `${e.estampa}. Ficha de corte del ${FECHA_CORTE}, cargada por script. Falta el precio del corte.`,
          creadoPor: bruno.nombre,
          cortadorId: fernando.id,
          cortador: fernando.nombre,
          loteId: lote.id,
          estado: 'COSTURA',
          // Misma forma que la carga de tizada del taller (carga-tizada/route.ts), sin precio.
          fichaCorteData: {
            tizadas: TIZADAS,
            talles: { S: String(e.cortado.S), M: String(e.cortado.M), L: String(e.cortado.L) },
            avios: [],
            cortadorId: fernando.id,
            costoCorte: 0,
            modoCosto: 'unidad',
            fechaCorte: FECHA_CORTE,
            cargaInterna: true,
            cargadaPor: bruno.nombre,
            cantidadPrevia: n,
          },
          corteEstado: 'cargado',
          fechaCorte: new Date(`${FECHA_CORTE}T12:00:00Z`),
        },
      });
      await tx.estadoTransicion.createMany({
        data: [
          { ordenId: op.id, estadoAnterior: null, estadoNuevo: 'PENDIENTE', usuarioId: bruno.id, notas: 'OP creada' },
          { ordenId: op.id, estadoAnterior: 'PENDIENTE', estadoNuevo: 'COSTURA', usuarioId: bruno.id,
            notas: `Corte cargado (ficha ${FECHA_CORTE}, ${fernando.nombre}, ${n} u; falta el precio) → costura` },
        ],
      });
      // Lote 2 programado: se activa cuando la costurera deja la remalladora.
      await separarLote(tx, op.id, filas({ S: e.cortado.S - LOTE1.S, M: e.cortado.M - LOTE1.M, L: e.cortado.L - LOTE1.L }), 'Remallado', session, true);
    }
  }, { timeout: 60_000 });

  // Lo escrito, leído de nuevo.
  const ops = await prisma.ordenProduccion.findMany({
    where: { sku: { in: ESTAMPAS.map((e) => `ZAT-BIK-${e.abrev}-001`) } },
    include: { lotesPlanificados: { include: { talles: true }, orderBy: { numero: 'asc' } } },
  });
  for (const o of ops) {
    console.log(`  ✅ ${o.sku} ${o.estado} cortadas ${o.cantidadCortada} corte ${o.corteEstado} lote ${o.loteId?.slice(-6)} | ` +
      o.lotesPlanificados.map((l) => `Lote ${l.numero}${l.activadoAt ? '' : ' (programado)'}: ` +
        l.talles.map((t) => `${t.talle}${t.cantidad}`).join(' ')).join(' · '));
  }
}

main().catch((e) => { console.error('❌', e.message ?? e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
