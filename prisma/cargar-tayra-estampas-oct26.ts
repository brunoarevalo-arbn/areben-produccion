// Carga del corte de la TAYRA ESTAMPADA (ficha de corte del 15-oct-2026, Fernando).
//
// 5 órdenes —una por estampa, TAYRA 1 a 5—, agrupadas en un lote de colores, directo en
// COSTURA, con el corte cargado por el taller y la separación en lotes PROGRAMADA: el Lote 1
// (6·6·3 = 15 por estampa, igual que la AYLA) y el Lote 2 (el resto) se activan cuando la
// costurera deja la remalladora y confirma en la tablet. Mismo molde que
// cargar-ayla-estampas-oct26.ts.
//
// 🔴 El precio del corte NO está en la ficha ⇒ el corte queda 'cargado' (falta validar) y SIN
// precio: validar-corte se planta hasta que se cargue. No se inventa plata del cortador.
//
//   npx tsx --env-file=.env prisma/cargar-tayra-estampas-oct26.ts            # muestra el plan
//   npx tsx --env-file=.env prisma/cargar-tayra-estampas-oct26.ts --aplicar  # escribe
//
// ⚠️ Escribe en la base a la que apunte DIRECT_URL/DATABASE_URL. Se planta si alguna de las
// 5 órdenes ya existe: correrlo dos veces no duplica nada.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { separarLote } from '../lib/produccion/lotesPlanificados';

const APLICAR = process.argv.includes('--aplicar');
const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const MODELO = 'Bikini TAYRA triangulito con ruedo + bombacha para atar';
const FECHA_CORTE = '2026-10-15';
// Ficha: «consumo t.2ada 1,06 × 10 (conjunto)» — lycra + muselina, como la AYLA.
const TIZADAS = [
  { id: 't1', nombre: 'lycra', modo: 'tizada', metros: '1.06', unidades: '10', rollos: [] },
  { id: 't2', nombre: 'muselina', modo: 'tizada', metros: '1.06', unidades: '10', rollos: [] },
];
// El geometral del modelo (el mismo que ya tiene el lote de la TAYRA lisa).
const GEOMETRAL = 'https://gimxi9mornl8b5km.public.blob.vercel-storage.com/geometrales/bikinis-2027/TAYRA-1-y7TjMrfnBTHgTdjv5WkqlNoWyoKKLm.png';

type Talles = { S: number; M: number; L: number };
const CORTADO: Talles = { S: 16, M: 16, L: 8 };   // las 5 estampas iguales (ficha)
const LOTE1: Talles = { S: 6, M: 6, L: 3 };       // la curva (Bruno)
const LOTE2: Talles = { S: CORTADO.S - LOTE1.S, M: CORTADO.M - LOTE1.M, L: CORTADO.L - LOTE1.L };
const ESTAMPAS: { color: string; abrev: string; estampa: string }[] = [
  { color: 'Lunares chocolate sobre celeste',  abrev: 'LUNCEL', estampa: 'TAYRA-1 Dots Celeste' },
  { color: 'Lunares amarillos sobre chocolate', abrev: 'LUNCH',  estampa: 'TAYRA-2 Dots Choco' },
  { color: 'Rayas rosas y violetas',           abrev: 'RAYVIO', estampa: 'TAYRA-3 Stripes Bordó' },
  { color: 'Cuadrillé rojo',                   abrev: 'CUADRJ', estampa: 'TAYRA-4 Vichy Rojo' },
  { color: 'Rayas celeste y chocolate',        abrev: 'RAYCEL', estampa: 'TAYRA-5 Stripes Celeste' },
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

  const n = suma(CORTADO);
  for (const e of ESTAMPAS) {
    if (await prisma.ordenProduccion.findFirst({ where: { sku: { startsWith: `ZAT-BIK-${e.abrev}-` } } })) {
      throw new Error(`Ya existe una orden ZAT-BIK-${e.abrev}-…: no toco nada (¿ya se corrió?)`);
    }
    const ocupada = await prisma.skuCatalogo.findFirst({ where: { categoria: 'color', abreviatura: e.abrev } });
    if (ocupada && ocupada.nombre !== e.color) throw new Error(`${e.abrev} ya es «${ocupada.nombre}» en el catálogo`);
    console.log(`  ZAT-BIK-${e.abrev}-001  ${e.color} (${e.estampa})  S${CORTADO.S}·M${CORTADO.M}·L${CORTADO.L} = ${n}` +
      `  →  Lote 1 = S${LOTE1.S}·M${LOTE1.M}·L${LOTE1.L} = ${suma(LOTE1)}  ·  Lote 2 = S${LOTE2.S}·M${LOTE2.M}·L${LOTE2.L} = ${suma(LOTE2)}`);
  }
  const total = n * ESTAMPAS.length;
  console.log(`  TOTAL ${total} u · corte Fernando: SIN PRECIO (queda «cargado», falta validar)`);
  if (total !== 200) throw new Error(`La ficha suma 200 y acá da ${total}`);
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
      data: { marca: 'Zattia', prenda: 'BIK', descripcion: `${MODELO} — estampas sublimadas`, creadoPor: bruno.nombre, geometralUrl: GEOMETRAL },
    });

    for (const e of ESTAMPAS) {
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
            talles: { S: String(CORTADO.S), M: String(CORTADO.M), L: String(CORTADO.L) },
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
      await separarLote(tx, op.id, filas(LOTE2), 'Remallado', session, true);
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
