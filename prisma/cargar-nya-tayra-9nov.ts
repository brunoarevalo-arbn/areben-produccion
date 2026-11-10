// Carga de los dos cortes de bikinis del 9-nov-2026 (Fernando), fichas armadas el 6-nov
// (`~/Documents/bikinis-2027/corte-bikinis-6nov.pdf`). Planillas del taller, fotos de Bruno 10-nov:
//
//  · NYA (corpiño tipo sport + bombacha regulable), lycra + muselina cruda, tizada 1,30 × 10 conjuntos:
//      Flores naranjas  S16·M16·L8 = 40  → color NUEVO `FLONAR` (SERENA Hibiscus, ex «NYA-5»)
//      Flores violetas  S8·M8·L4  = 20  → `ZAT-BIK-FLOVIO-002` (2º corte de la FLOVIO; la -001 es el del 20-oct)
//  · TAYRA (triangulito con ruedo + bombacha para atar), lycra + muselina, tizada 1,10 × 10 conjuntos:
//      Camuflada con rosa S24·M24·L12 = 60 → color NUEVO `CAMROS` (MADDIE Camo)
//
// Cada orden va al LoteProduccion de su modelo (el de las estampas sublimadas), directo en COSTURA.
// Corte $450/u (lo que se validó en las NYA y TAYRA sublimadas) queda «cargado», ⛔ validado:
// validar en Órdenes es lo que mueve la cuenta del cortador.
// Lotes: Lote 1 = 6·6·3 en el taller · Lote 2 = el resto, separado «Todo cortado» y OCULTO (🙈),
// como la NYA del 20-oct. Geometral: NYA-5.png y TAYRA-CAMUFLADA.png a Blob; la FLOVIO-002 usa
// el de la FLOVIO-001.
//
//   npx tsx --env-file=.env prisma/cargar-nya-tayra-9nov.ts            # muestra el plan
//   npx tsx --env-file=.env prisma/cargar-nya-tayra-9nov.ts --aplicar  # escribe
//
// ⚠️ Se planta si alguna de las 3 órdenes ya existe: correrlo dos veces no duplica nada.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { put } from '@vercel/blob';
import { DESPUES_DE_LOTE_1 } from '../lib/constants/lotes';

const APLICAR = process.argv.includes('--aplicar');
const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const FECHA_CORTE = '2026-11-09';
const PRECIO = 450;
const IMG = `${homedir()}/Documents/bikinis-2027/img`;
const TALLES = ['S', 'M', 'L'] as const;
type Talles = { S: number; M: number; L: number };
const LOTE1: Talles = { S: 6, M: 6, L: 3 };

const NYA = { lote: 'Bikini NYA corpiño tipo sport + bombacha regulable — estampas sublimadas',
  desc: 'Bikini NYA corpiño tipo sport + bombacha regulable', tizada: 'tizada 1,30 m × 10 conjuntos', forro: 'muselina cruda' };
const TAYRA = { lote: 'Bikini TAYRA triangulito con ruedo + bombacha para atar — estampas sublimadas',
  desc: 'Bikini TAYRA triangulito con ruedo + bombacha para atar', tizada: 'tizada 1,10 m × 10 conjuntos', forro: 'muselina cruda' };

const ORDENES: {
  sku: string; color: string; colorNombre: string; colorNuevo: boolean; modelo: typeof NYA;
  planilla: string; cortado: Talles; img: string | null; geometralDe?: string;
}[] = [
  { sku: 'ZAT-BIK-FLONAR-001', color: 'FLONAR', colorNombre: 'Flores naranjas + cuadrillé naranja', colorNuevo: true,
    modelo: NYA, planilla: 'Flores naranjas', cortado: { S: 16, M: 16, L: 8 }, img: 'NYA-5.png' },
  { sku: 'ZAT-BIK-FLOVIO-002', color: 'FLOVIO', colorNombre: 'Flores violetas + cuadrillé violeta', colorNuevo: false,
    modelo: NYA, planilla: 'Flores violetas', cortado: { S: 8, M: 8, L: 4 }, img: null, geometralDe: 'ZAT-BIK-FLOVIO-001' },
  { sku: 'ZAT-BIK-CAMROS-001', color: 'CAMROS', colorNombre: 'Camuflada con rosa', colorNuevo: true,
    modelo: TAYRA, planilla: 'Camuflada con rosa', cortado: { S: 24, M: 24, L: 12 }, img: 'TAYRA-CAMUFLADA.png' },
];
const suma = (t: Talles) => t.S + t.M + t.L;
const resta = (a: Talles, b: Talles): Talles => ({ S: a.S - b.S, M: a.M - b.M, L: a.L - b.L });
const txt = (t: Talles) => `${t.S}·${t.M}·${t.L}`;

async function main() {
  console.log(`Base: ${url.replace(/:[^:@/]+@/, ':***@').replace(/\?.*/, '')}`);
  console.log(APLICAR ? '▶ APLICANDO' : '◻ SÓLO PLAN (agregá --aplicar para escribir)');
  if (APLICAR && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Falta BLOB_READ_WRITE_TOKEN: no escribo nada');

  const fernando = await prisma.cortador.findFirst({ where: { nombre: 'Fernando', activo: true } });
  const bruno = await prisma.usuario.findFirst({ where: { email: 'brunoarevalo@arebensrl.com' } });
  if (!fernando) throw new Error('No encuentro al cortador Fernando');
  if (!bruno) throw new Error('No encuentro el usuario de Bruno');

  const lotes = new Map<string, string>();
  for (const m of [NYA, TAYRA]) {
    const l = await prisma.loteProduccion.findMany({ where: { descripcion: m.lote } });
    if (l.length !== 1) throw new Error(`Esperaba 1 lote «${m.lote}» y hay ${l.length}`);
    lotes.set(m.lote, l[0].id);
  }

  const geoHeredado = new Map<string, string>();
  for (const o of ORDENES) {
    if (await prisma.ordenProduccion.findUnique({ where: { sku: o.sku } })) throw new Error(`Ya existe ${o.sku}: no toco nada (¿ya se corrió?)`);
    const c = await prisma.skuCatalogo.findFirst({ where: { categoria: 'color', abreviatura: o.color } });
    if (o.colorNuevo && c) throw new Error(`El color ${o.color} ya existe («${c.nombre}»)`);
    if (!o.colorNuevo && c?.nombre !== o.colorNombre) throw new Error(`El color ${o.color} no es «${o.colorNombre}» (es «${c?.nombre}»)`);
    if (o.img) readFileSync(`${IMG}/${o.img}`);
    if (o.geometralDe) {
      const g = await prisma.ordenProduccion.findUnique({ where: { sku: o.geometralDe }, select: { geometralUrl: true } });
      if (!g?.geometralUrl) throw new Error(`${o.geometralDe} no tiene geometral para heredar`);
      geoHeredado.set(o.sku, g.geometralUrl);
    }
    const l2 = resta(o.cortado, LOTE1);
    if (TALLES.some((t) => l2[t] < 0)) throw new Error(`${o.sku}: el Lote 1 no entra`);
    console.log(`  ${o.sku}  ${o.modelo.desc} · ${o.colorNombre}${o.colorNuevo ? ' (COLOR NUEVO)' : ''}\n` +
      `      cortado S${o.cortado.S}·M${o.cortado.M}·L${o.cortado.L} = ${suma(o.cortado)} · Lote 1 ${txt(LOTE1)} · Lote 2 ${txt(l2)} 🙈 · ` +
      `geometral ${o.img ?? `el de ${o.geometralDe}`}`);
  }
  const total = ORDENES.reduce((s, o) => s + suma(o.cortado), 0);
  if (total !== 120) throw new Error(`Las dos planillas suman 120 (60 + 60) y acá da ${total}`);
  console.log(`  TOTAL ${total} u · corte Fernando ${FECHA_CORTE} a $${PRECIO}/u, queda «cargado» (falta validar)`);
  if (!APLICAR) return;

  // El geometral se sube ANTES de la transacción: si falla, no se escribió nada en la base.
  const geometral = new Map(geoHeredado);
  for (const o of ORDENES.filter((x) => x.img)) {
    const { url: u } = await put(`geometrales/bikinis-2027/${o.sku}.png`, readFileSync(`${IMG}/${o.img}`),
      { access: 'public', addRandomSuffix: true, contentType: 'image/png' });
    geometral.set(o.sku, u);
  }

  await prisma.$transaction(async (tx) => {
    for (const o of ORDENES.filter((x) => x.colorNuevo)) {
      const max = await tx.skuCatalogo.aggregate({ where: { categoria: 'color' }, _max: { orden: true } });
      await tx.skuCatalogo.create({ data: { categoria: 'color', nombre: o.colorNombre, abreviatura: o.color, orden: (max._max.orden ?? 0) + 1 } });
    }
    for (const o of ORDENES) {
      const n = suma(o.cortado);
      const l2 = resta(o.cortado, LOTE1);
      const op = await tx.ordenProduccion.create({
        data: {
          sku: o.sku,
          descripcion: `${o.modelo.desc} · ${o.colorNombre}`,
          marca: 'Zattia',
          cantidad: n,
          cantidadCortada: n,
          notas: `Planilla: «${o.planilla}». Corte del ${FECHA_CORTE} (${o.modelo.tizada}), cargado por script. ` +
                 `Forro ${o.modelo.forro}. Corte $${PRECIO}/u, falta validar.`,
          creadoPor: bruno.nombre,
          cortadorId: fernando.id,
          cortador: fernando.nombre,
          loteId: lotes.get(o.modelo.lote)!,
          estado: 'COSTURA',
          geometralUrl: geometral.get(o.sku) ?? null,
          fichaCorteData: {
            tizadas: [],
            talles: { S: String(o.cortado.S), M: String(o.cortado.M), L: String(o.cortado.L) },
            avios: [],
            cortadorId: fernando.id,
            costoCorte: PRECIO,
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
      const ahora = new Date();
      await tx.lotePlanificado.create({
        data: { ordenId: op.id, numero: 1, despuesDe: DESPUES_DE_LOTE_1, separadoPor: bruno.nombre, activadoAt: ahora, enTaller: true,
          talles: { create: TALLES.map((t) => ({ talle: t, cantidad: LOTE1[t] })) } },
      });
      await tx.lotePlanificado.create({
        data: { ordenId: op.id, numero: 2, despuesDe: 'Todo cortado', separadoPor: bruno.nombre, activadoAt: ahora, enTaller: false,
          talles: { create: TALLES.map((t) => ({ talle: t, cantidad: l2[t] })) } },
      });
      await tx.estadoTransicion.createMany({
        data: [
          { ordenId: op.id, estadoAnterior: null, estadoNuevo: 'PENDIENTE', usuarioId: bruno.id, notas: 'OP creada' },
          { ordenId: op.id, estadoAnterior: 'PENDIENTE', estadoNuevo: 'COSTURA', usuarioId: bruno.id,
            notas: `Corte cargado (${FECHA_CORTE}, ${fernando.nombre}, ${n} u; $${PRECIO}/u, falta validar) → costura` },
          { ordenId: op.id, estadoAnterior: 'COSTURA', estadoNuevo: 'COSTURA', usuarioId: bruno.id,
            notas: `Lote 1 ${txt(LOTE1)} en el taller · Lote 2 ${txt(l2)} separado (todo cortado), oculto.` },
        ],
      });
    }
  }, { timeout: 60_000 });

  // Relectura desde la base.
  const ops = await prisma.ordenProduccion.findMany({
    where: { sku: { in: ORDENES.map((o) => o.sku) } },
    include: { lotesPlanificados: { include: { talles: true }, orderBy: { numero: 'asc' } }, lote: { select: { descripcion: true } } },
  });
  for (const o of ops) {
    const geoOk = o.geometralUrl ? (await fetch(o.geometralUrl)).ok : false;
    console.log(`  ✅ ${o.sku} ${o.estado} cortadas ${o.cantidadCortada} corte ${o.corteEstado} lote «${o.lote?.descripcion}» ` +
      `geometral ${geoOk ? 'sí (se sirve)' : 'NO'} | ` + o.lotesPlanificados.map((l) => `Lote ${l.numero}${l.enTaller ? '' : ' 🙈'}: ` +
        TALLES.map((t) => l.talles.find((x) => x.talle === t)?.cantidad ?? 0).join('·')).join(' · '));
  }
  if (ops.length !== 3) throw new Error(`Esperaba 3 órdenes releídas y hay ${ops.length}`);
}

main().catch((e) => { console.error('❌', e.message ?? e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
