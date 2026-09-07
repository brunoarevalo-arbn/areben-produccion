// Carga las MEDIDAS de las 13 estampas de Stunned (dictadas por Bruno el 7-sep-2026).
// Hasta ahora las 13 tenían `anchoCm = largoCm = 0`, así que el costo DTF de esos 13
// productos salía $0 y el total no decía «falta»: decía un número más chico que el real.
//
// Dos cosas que el modelo ya soportaba y hay que usar bien:
//   · T1 / T2 son las DOS CURVAS del mismo diseño: T1 = S/M, T2 = L/XL. No son dos
//     estampas distintas — el escandallo elige una con `tamano: 1 | 2`.
//   · Un diseño con ESPALDA + FRENTE son DOS estampas físicas (dos planchados, dos
//     áreas de DTF) ⇒ dos filas en `estampas`, y DOS líneas en el ProductoEstampado.
//     Meter el frente en el slot T2 sería mentir: ahí va la otra curva, no la otra cara.
//
// 🔴 BUZO FLECK (EST-030) entró en una 2ª pasada, el 7-sep. En el primer dictado sus 4
//    números no cerraban: la espalda S/M era carácter por carácter la de SKATE y en las
//    dos caras el L/XL salía MÁS CHICO que el S/M — al revés que en los otros 12, donde
//    L/XL ≈ S/M × 1,10. Bruno los rectificó: la espalda L/XL es 38,9 × 48 (lo que decía
//    «L/XL» era el S/M) y el frente tenía las dos filas dadas vuelta. Ahora las cuatro
//    razones dan 1,11 como el resto.
//
// Idempotente: las estampas de frente se crean por `codigoInterno` sólo si no existen, y
// la línea del producto se agrega sólo si esa estampa no está ya en su lista.
//
//   npx tsx prisma/migrate-medidas-estampas-stunned.ts            → sólo informa
//   npx tsx prisma/migrate-medidas-estampas-stunned.ts --aplicar  → escribe
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const APLICAR = process.argv.includes('--aplicar');

type Med = [number, number]; // [ancho, largo] en cm, en el orden en que Bruno los dictó
interface Diseno {
  codigo: string;        // estampa que ya existe
  cara: string;          // cómo se llama la cara PRINCIPAL (la que va en la fila que ya existe)
  sm: Med; lxl: Med;     // curva S/M y curva L/XL de esa cara
  segunda?: { cara: string; sm: Med; lxl: Med }; // la otra cara: fila NUEVA
}

// Dictado de Bruno, 7-sep-2026. La cara que va en la fila existente es la ESPALDA cuando
// el diseño tiene las dos (es la grande, la que manda el costo).
const DISENOS: Diseno[] = [
  { codigo: 'EST-020', cara: 'FRENTE',  sm: [39, 27.7],    lxl: [42.9, 30.5] },                                                              // STARRY
  { codigo: 'EST-021', cara: 'ESPALDA', sm: [35.8, 34.9],  lxl: [39.8, 38.8], segunda: { cara: 'FRENTE', sm: [9, 1],    lxl: [9, 1] } },      // CIRCLE BROWN
  { codigo: 'EST-022', cara: 'ESPALDA', sm: [39, 26],      lxl: [42.7, 28.4], segunda: { cara: 'FRENTE', sm: [9, 1],    lxl: [9, 1] } },      // LONG BROWN
  { codigo: 'EST-023', cara: 'FRENTE',  sm: [30, 30],      lxl: [33, 33] },                                                                  // GRAPH
  { codigo: 'EST-024', cara: 'FRENTE',  sm: [38.9, 21.5],  lxl: [42.8, 23.6] },                                                              // MADE (remera)
  { codigo: 'EST-025', cara: 'ESPALDA', sm: [39.9, 32.3],  lxl: [44, 35.6],   segunda: { cara: 'FRENTE', sm: [6.7, 1.8], lxl: [7.5, 2] } },   // TIME
  { codigo: 'EST-026', cara: 'ESPALDA', sm: [42, 45.8],    lxl: [46.2, 50.3], segunda: { cara: 'FRENTE', sm: [14.4, 2.5], lxl: [16.5, 3] } }, // SKATE
  { codigo: 'EST-027', cara: 'ESPALDA', sm: [39, 26],      lxl: [42.7, 28.4], segunda: { cara: 'FRENTE', sm: [9, 1],    lxl: [9, 1] } },      // LONG OFF WHITE
  { codigo: 'EST-028', cara: 'ESPALDA', sm: [59.4, 16.2],  lxl: [66, 17.8] },                                                                // BUZO STND
  { codigo: 'EST-029', cara: 'ESPALDA', sm: [41.3, 22.8],  lxl: [45.7, 25.3], segunda: { cara: 'FRENTE', sm: [9.9, 6.5], lxl: [11, 7.3] } },  // BUZO MADE
  { codigo: 'EST-030', cara: 'ESPALDA', sm: [35, 43.2],    lxl: [38.9, 48],   segunda: { cara: 'FRENTE', sm: [39.1, 16.7], lxl: [43.5, 18.5] } }, // BUZO FLECK
  { codigo: 'EST-031', cara: 'FRENTE',  sm: [27, 7],       lxl: [30, 8] },                                                                   // BUZO PHRASE
  { codigo: 'EST-032', cara: 'FRENTE',  sm: [43.8, 21.6],  lxl: [48.7, 24] },                                                                // CAMPERA WEAR
];

const d = (n: number) => new Prisma.Decimal(n);
const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

async function main() {
  const cfg = await prisma.configCostos.findUnique({ where: { id: 'singleton' } });
  if (!cfg) throw new Error('Falta config_costos');
  const merma = Number(cfg.dtfMermaDefault);       // 15% — el mismo default que llevan las otras 19
  const anchoRollo = Number(cfg.dtfAnchoCm);
  const precioMetro = Number(cfg.dtfPrecioMetro);
  // Misma fórmula que lib/costos/estampaCosto.ts, escrita acá para poder comparar.
  const costo = ([a, l]: Med) => (a * l) / (anchoRollo * 100) * precioMetro * (1 + merma / 100);

  console.log(`DTF: rollo ${anchoRollo} cm · $${fmt(precioMetro)}/m · merma ${merma}%\n`);

  for (const ds of DISENOS) {
    const est = await prisma.estampa.findUnique({ where: { codigoInterno: ds.codigo } });
    if (!est) { console.log(`⛔ ${ds.codigo}: no existe`); continue; }
    const nombreBase = (est.nombreComercial ?? '').replace(/ (ESPALDA|FRENTE)$/, '');
    // Si el diseño tiene dos caras, el nombre de la que ya existe pasa a decir cuál es.
    const nombrePpal = ds.segunda ? `${nombreBase} ${ds.cara}` : nombreBase;

    console.log(`${ds.codigo} · ${nombrePpal}`);
    console.log(`   T1 S/M  ${ds.sm[0]}×${ds.sm[1]} cm → $${fmt(costo(ds.sm))}   ·   T2 L/XL ${ds.lxl[0]}×${ds.lxl[1]} cm → $${fmt(costo(ds.lxl))}`);
    if (ds.lxl[0] > anchoRollo || ds.sm[0] > anchoRollo)
      console.log(`   ⚠ más ancho que el rollo (${anchoRollo} cm): entra girado. El costo es por área, no cambia.`);

    if (APLICAR) {
      await prisma.estampa.update({
        where: { id: est.id },
        data: {
          nombreComercial: nombrePpal,
          anchoCm: d(ds.sm[0]),  largoCm: d(ds.sm[1]),   mermaPercent:  d(merma),
          ancho2Cm: d(ds.lxl[0]), largo2Cm: d(ds.lxl[1]), merma2Percent: d(merma),
        },
      });
    }

    if (!ds.segunda) continue;

    // ── la otra cara: estampa propia + línea propia en el producto ──
    const codigo2 = `${ds.codigo}-F`;
    const nombre2 = `${nombreBase} ${ds.segunda.cara}`;
    let est2 = await prisma.estampa.findUnique({ where: { codigoInterno: codigo2 } });
    console.log(`   ${codigo2} · ${nombre2}  ${est2 ? '(ya existía)' : '(nueva)'}`);
    console.log(`      T1 S/M  ${ds.segunda.sm[0]}×${ds.segunda.sm[1]} cm → $${fmt(costo(ds.segunda.sm))}   ·   T2 L/XL ${ds.segunda.lxl[0]}×${ds.segunda.lxl[1]} cm → $${fmt(costo(ds.segunda.lxl))}`);

    if (APLICAR) {
      const data = {
        codigoInterno: codigo2, nombreComercial: nombre2,
        coleccion: est.coleccion, marca: est.marca, estado: est.estado,
        anchoCm: d(ds.segunda.sm[0]),  largoCm: d(ds.segunda.sm[1]),   mermaPercent:  d(merma),
        ancho2Cm: d(ds.segunda.lxl[0]), largo2Cm: d(ds.segunda.lxl[1]), merma2Percent: d(merma),
        notas: `Cara ${ds.segunda.cara.toLowerCase()} de ${ds.codigo} · ${nombreBase}`,
        creadoPor: 'admin',
      };
      est2 = est2
        ? await prisma.estampa.update({ where: { id: est2.id }, data })
        : await prisma.estampa.create({ data });
    }

    // El producto que usa la cara principal tiene que sumar la segunda como otra línea:
    // son dos planchados y dos áreas de DTF, no uno.
    const prod = await prisma.productoEstampado.findFirst({
      where: { estampas: { array_contains: [{ estampaId: est.id }] } },
    }) ?? (await prisma.productoEstampado.findMany()).find(
      (p) => (p.estampas as { estampaId: string }[]).some((l) => l.estampaId === est.id));
    if (!prod) { console.log(`      ⛔ ningún producto usa ${ds.codigo}: la línea queda sin agregar`); continue; }

    const lineas = prod.estampas as { estampaId: string; tamano?: number; minutosEstampado?: number }[];
    const ya = est2 ? lineas.some((l) => l.estampaId === est2!.id) : false;
    console.log(`      producto «${prod.nombre}»: ${ya ? 'ya tenía la línea' : `+1 línea (tenía ${lineas.length})`}`);
    if (APLICAR && est2 && !ya) {
      await prisma.productoEstampado.update({
        where: { id: prod.id },
        data: { estampas: [...lineas, { estampaId: est2.id, tamano: 1, minutosEstampado: 0 }] },
      });
    }
  }

  console.log(APLICAR ? '\n✅ aplicado' : '\n(dry-run: nada escrito. Correr con --aplicar)');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
