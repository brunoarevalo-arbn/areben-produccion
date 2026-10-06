// Carga del corte de la AYLA ESTAMPADA (ficha de corte del 5-oct-2026, Fernando).
//
// 4 órdenes —una por estampa—, agrupadas en un lote de colores, directo en COSTURA, con el
// corte cargado por el taller (validado y cobrable: $450/u) y la separación en lotes
// PROGRAMADA: el Lote 1 (3 curvas 2·2·1 = 15 por estampa, para lanzar) y el Lote 2 (el
// resto) se activan cuando la costurera deja la remalladora y confirma en la tablet.
// Decidido con Bruno el 6-oct (ver PENDIENTES.md).
//
//   npx tsx --env-file=.env prisma/cargar-ayla-estampas-oct26.ts            # muestra el plan
//   npx tsx --env-file=.env prisma/cargar-ayla-estampas-oct26.ts --aplicar  # escribe
//
// ⚠️ Escribe en la base a la que apunte DIRECT_URL/DATABASE_URL. Se planta si alguna de las
// 4 órdenes ya existe: correrlo dos veces no duplica nada.
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { separarLote } from '../lib/produccion/lotesPlanificados';

const APLICAR = process.argv.includes('--aplicar');
const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const MODELO = 'Bikini AYLA triangulito envivado + bombacha envivada';
const PRECIO_CORTE = 450; // por unidad
const FECHA_CORTE = '2026-10-05';
const TIZADAS = [
  { id: 't1', nombre: 'lycra', modo: 'tizada', metros: '0.92', unidades: '6', rollos: [] },
  { id: 't2', nombre: 'muselina', modo: 'tizada', metros: '0.92', unidades: '6', rollos: [] },
];

type Talles = { S: number; M: number; L: number };
const ESTAMPAS: { color: string; abrev: string; estampa: string; cortado: Talles; lote2: Talles }[] = [
  { color: 'Rayas rosas y rojas',             abrev: 'RAYROS', estampa: 'AYLA-3 Stripes Fucsia', cortado: { S: 22, M: 22, L: 8 },  lote2: { S: 16, M: 16, L: 5 } },
  { color: 'Lunares chocolate sobre amarillo', abrev: 'LUNAMA', estampa: 'AYLA-2',                cortado: { S: 16, M: 16, L: 8 },  lote2: { S: 10, M: 10, L: 5 } },
  { color: 'Rayas azules y celestes',          abrev: 'RAYAZ',  estampa: 'AYLA-1 Petróleo',       cortado: { S: 24, M: 24, L: 10 }, lote2: { S: 18, M: 18, L: 7 } },
  { color: 'Cuadrillé negro',                  abrev: 'CUADNG', estampa: 'AYLA-4 Vichy Negro',    cortado: { S: 16, M: 16, L: 8 },  lote2: { S: 10, M: 10, L: 5 } },
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

  let total = 0;
  for (const e of ESTAMPAS) {
    const sku = `ZAT-BIK-${e.abrev}-001`;
    const n = suma(e.cortado);
    const l2 = suma(e.lote2);
    total += n;
    if (await prisma.ordenProduccion.findFirst({ where: { sku: { startsWith: `ZAT-BIK-${e.abrev}-` } } })) {
      throw new Error(`Ya existe una orden ZAT-BIK-${e.abrev}-…: no toco nada (¿ya se corrió?)`);
    }
    console.log(`  ${sku}  ${e.color} (${e.estampa})  S${e.cortado.S}·M${e.cortado.M}·L${e.cortado.L} = ${n}` +
      `  →  Lote 1 = ${n - l2}  ·  Lote 2 = S${e.lote2.S}·M${e.lote2.M}·L${e.lote2.L} = ${l2}  ·  corte $${PRECIO_CORTE * n}`);
  }
  console.log(`  TOTAL ${total} u · corte Fernando $${PRECIO_CORTE * total}`);
  if (total !== 190) throw new Error(`La ficha suma 190 y acá da ${total}`);
  if (!APLICAR) return;

  const session = { id: bruno.id, nombre: bruno.nombre, rol: 'admin', username: '' } as never;
  await prisma.$transaction(async (tx) => {
    // Los 4 colores al catálogo de SKU (si no están).
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
          notas: `${e.estampa}. Ficha de corte del ${FECHA_CORTE}, cargada por script.`,
          creadoPor: bruno.nombre,
          cortadorId: fernando.id,
          cortador: fernando.nombre,
          loteId: lote.id,
          estado: 'COSTURA',
          // Misma forma que la carga de tizada del taller (carga-tizada/route.ts).
          fichaCorteData: {
            tizadas: TIZADAS,
            talles: { S: String(e.cortado.S), M: String(e.cortado.M), L: String(e.cortado.L) },
            avios: [],
            cortadorId: fernando.id,
            costoCorte: PRECIO_CORTE,
            modoCosto: 'unidad',
            fechaCorte: FECHA_CORTE,
            cargaInterna: true,
            cargadaPor: bruno.nombre,
            cantidadPrevia: n,
          },
          corteEstado: 'validado',
          costoCorte: new Prisma.Decimal(PRECIO_CORTE * n),
          fechaCorte: new Date(`${FECHA_CORTE}T12:00:00Z`),
        },
      });
      await tx.estadoTransicion.createMany({
        data: [
          { ordenId: op.id, estadoAnterior: null, estadoNuevo: 'PENDIENTE', usuarioId: bruno.id, notas: 'OP creada' },
          { ordenId: op.id, estadoAnterior: 'PENDIENTE', estadoNuevo: 'COSTURA', usuarioId: bruno.id,
            notas: `Corte cargado (ficha ${FECHA_CORTE}, ${fernando.nombre} $${PRECIO_CORTE}/u = $${PRECIO_CORTE * n}) → costura` },
        ],
      });
      // Lote 2 programado: se activa cuando la costurera deja la remalladora.
      await separarLote(tx, op.id, filas(e.lote2), 'Remallado', session, true);
    }
  }, { timeout: 60_000 });

  // Lo escrito, leído de nuevo.
  const ops = await prisma.ordenProduccion.findMany({
    where: { sku: { in: ESTAMPAS.map((e) => `ZAT-BIK-${e.abrev}-001`) } },
    include: { lotesPlanificados: { include: { talles: true }, orderBy: { numero: 'asc' } } },
  });
  for (const o of ops) {
    console.log(`  ✅ ${o.sku} ${o.estado} cortadas ${o.cantidadCortada} corte $${o.costoCorte} lote ${o.loteId?.slice(-6)} | ` +
      o.lotesPlanificados.map((l) => `Lote ${l.numero}${l.activadoAt ? '' : ' (programado)'}: ` +
        l.talles.map((t) => `${t.talle}${t.cantidad}`).join(' ')).join(' · '));
  }
}

main().catch((e) => { console.error('❌', e.message ?? e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
