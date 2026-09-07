// Genera la planilla de precios de Stunned CON FÓRMULAS VIVAS: se toca el precio y el
// markup, el margen y los totales se recalculan solos. El costo sale del sistema
// (escandallo + DTF por tira + minutos de estampería) y va bloqueado; lo editable son el
// precio y los parámetros de arriba.
//
// ⚠️ El costo es una FOTO del día que se generó. Si cambia un precio de tela, el DTF o el
// costo/minuto, hay que volver a correr esto: la planilla no se entera sola.
//
//   npx tsx prisma/export-precios-stunned.ts [ruta.xlsx]
import 'dotenv/config';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseDatos, calcular } from '../lib/costos/escandallo';
import { costoEstampa } from '../lib/costos/estampaCosto';
import { resolverPrecioDtf } from '../lib/costos/dtfPrecio';
import { calcularCostoMinuto } from '../lib/costoMinuto';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const SALIDA = process.argv[2] || `${process.env.HOME}/Desktop/Precios-Stunned.xlsx`;

// Las unidades de la orden de lanzamiento del 20-ago.
const ORDEN = 'cmt1oj06c0000btwahxzk8gfl';
const PRECIO_CAT: Record<string, number> = { remera: 39990, buzo: 66990, campera: 79990 };

async function main() {
  const cfg = await prisma.configCostos.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} });
  const costoMinuto = await calcularCostoMinuto();
  const cmEst = cfg.estampadoValorHora / 60;
  const M = { margenDesarrollo: cfg.margenDesarrollo, margenFallas: cfg.margenFallas };
  const compras = await prisma.compraDtf.findMany();
  const dtfPrecio = resolverPrecioDtf(
    compras.map((c) => ({ id: c.id, fecha: c.fecha, metros: Number(c.metros), precioMetro: Number(c.precioMetro), flete: Number(c.flete) })),
    cfg.dtfPrecioMetro,
  );
  if (dtfPrecio.precioMetro == null) throw new Error('No hay precio de DTF: el costo saldría incompleto');
  const cfgDTF = { dtfPrecioMetro: dtfPrecio.precioMetro, dtfAnchoCm: cfg.dtfAnchoCm, dtfSeparacionCm: cfg.dtfSeparacionCm };

  const escandallos = await prisma.escandallo.findMany();
  const costoLiso = new Map(escandallos.map((e) => [e.id, calcular(parseDatos(e.datos), costoMinuto, M).costoTotal]));
  const nombreLiso = new Map(escandallos.map((e) => [e.id, e.sku ?? e.nombre]));
  const estampas = await prisma.estampa.findMany();
  const est = new Map(estampas.map((e) => [e.id, e]));
  const items = await prisma.ordenEstampaItem.groupBy({ by: ['estampaId'], where: { ordenId: ORDEN }, _sum: { cantidad: true } });
  const uPorEstampa = new Map(items.map((i) => [i.estampaId!, i._sum.cantidad ?? 0]));
  const productos = await prisma.productoEstampado.findMany({ where: { marca: 'Stunned' }, orderBy: { nombre: 'asc' } });

  type Fila = { nombre: string; cat: string; u: number; liso: number; lisoSku: string; dtf: number; mo: number; costo: number; caras: number };
  const filas: Fila[] = [];
  for (const p of productos) {
    const lineas = (p.estampas as { estampaId: string; tamano?: number; minutosEstampado?: number }[]) ?? [];
    const liso = p.lisoEscandalloId ? costoLiso.get(p.lisoEscandalloId) ?? 0 : 0;
    let dtf = 0;
    for (const l of lineas) {
      const e = est.get(l.estampaId); if (!e) continue;
      const t2 = (l.tamano ?? 1) === 2 && Number(e.ancho2Cm) > 0 && Number(e.largo2Cm) > 0;
      dtf += costoEstampa({
        anchoCm: Number(t2 ? e.ancho2Cm : e.anchoCm), largoCm: Number(t2 ? e.largo2Cm : e.largoCm),
        mermaPercent: Number(t2 ? e.merma2Percent : e.mermaPercent),
      }, cfgDTF) ?? 0;
    }
    const mo = lineas.reduce((s, l) => s + (Number(l.minutosEstampado) || 0) * cmEst, 0);
    const u = Math.max(0, ...lineas.map((l) => uPorEstampa.get(l.estampaId) ?? 0));
    const cat = p.nombre.startsWith('CAMPERA') ? 'campera' : p.nombre.startsWith('BUZO') ? 'buzo' : 'remera';
    filas.push({ nombre: p.nombre, cat, u, liso, lisoSku: p.lisoEscandalloId ? nombreLiso.get(p.lisoEscandalloId) ?? '—' : '—', dtf, mo, costo: liso + dtf + mo, caras: lineas.length });
  }
  filas.sort((a, b) => a.cat === b.cat ? b.costo - a.costo : PRECIO_CAT[a.cat] - PRECIO_CAT[b.cat]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'areben-produccion';
  const ws = wb.addWorksheet('Precios', { views: [{ state: 'frozen', ySplit: 12 }] });

  const $fmt = '"$"#,##0';
  const pctFmt = '0"%"';
  const tit = (c: ExcelJS.Cell, txt: string) => { c.value = txt; c.font = { bold: true, size: 14 }; };
  const editable = (c: ExcelJS.Cell) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3C4' } }; c.border = { top:{style:'thin'},left:{style:'thin'},bottom:{style:'thin'},right:{style:'thin'} }; };

  tit(ws.getCell('A1'), 'Precios Stunned — lanzamiento');
  ws.getCell('A2').value = `Costos al ${new Date().toLocaleDateString('es-AR')} · DTF $${Math.round(cfgDTF.dtfPrecioMetro)}/m (${dtfPrecio.fuente}) · costo/minuto taller $${costoMinuto.toFixed(2)} · márgenes ${M.margenDesarrollo}/${M.margenFallas}`;
  ws.getCell('A2').font = { size: 9, color: { argb: 'FF666666' } };
  ws.getCell('A3').value = 'Editá SOLO las celdas amarillas. El costo viene del sistema y es una foto de hoy: si cambian precios de tela o DTF, hay que volver a generar la planilla.';
  ws.getCell('A3').font = { size: 9, italic: true, color: { argb: 'FF996600' } };

  const params: [string, string, number | string, string][] = [
    ['IVA %', 'B5', cfg.ivaVenta, pctFmt],
    ['Ingresos Brutos %', 'B6', cfg.iibbPct, pctFmt],
    ['DREI %', 'B7', cfg.dreiPct, pctFmt],
    ['Descuento transferencia %', 'B8', 10, pctFmt],
    ['Descuento efectivo %', 'B9', 15, pctFmt],
    ['¿El IVA sale de caja? (SI/NO)', 'B10', 'NO', '@'],
  ];
  ws.getCell('A4').value = 'PARÁMETROS'; ws.getCell('A4').font = { bold: true };
  params.forEach(([etq, ref, val, fmt], i) => {
    ws.getCell(`A${5 + i}`).value = etq;
    const c = ws.getCell(ref); c.value = val; c.numFmt = fmt; editable(c);
  });
  ws.getCell('C10').value = 'NO = tenés saldo de IVA a favor, así que el IVA no se resta del margen.';
  ws.getCell('C10').font = { size: 9, italic: true, color: { argb: 'FF666666' } };

  const cabeceras = ['Producto', 'Liso', 'Cat.', 'Unid.', 'Costo', 'PRECIO LISTA', 'Markup', 'Margen', 'Transferencia', 'Efectivo', 'Margen $/u lista', 'Margen $/u transf.', 'Margen $/u efvo.', 'Total lista', 'Total transf.', 'Total efvo.'];
  const hr = ws.getRow(12);
  cabeceras.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } }; c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; });
  hr.height = 30;

  filas.forEach((f, i) => {
    const r = 13 + i;
    const row = ws.getRow(r);
    row.getCell(1).value = f.nombre;
    row.getCell(2).value = f.lisoSku;
    row.getCell(3).value = f.cat;
    row.getCell(4).value = f.u;
    row.getCell(5).value = Math.round(f.costo);
    const precio = ws.getCell(`F${r}`); precio.value = PRECIO_CAT[f.cat]; editable(precio);
    // neto = precio / (1 + IVA)
    row.getCell(7).value  = { formula: `IF(E${r}=0,"",F${r}/(1+$B$5/100)/E${r}-1)` };
    row.getCell(8).value  = { formula: `IF(F${r}=0,"",(F${r}/(1+$B$5/100)-E${r})/(F${r}/(1+$B$5/100)))` };
    row.getCell(9).value  = { formula: `F${r}*(1-$B$8/100)` };
    row.getCell(10).value = { formula: `F${r}*(1-$B$9/100)` };
    // Lista = venta con factura: IVA (si sale de caja) + IIBB + DREI
    row.getCell(11).value = { formula: `F${r}-IF($B$10="SI",F${r}*$B$5/(100+$B$5),0)-F${r}*$B$6/100-F${r}*$B$7/100-E${r}` };
    // Transferencia y efectivo: sin factura ⇒ ningún impuesto
    row.getCell(12).value = { formula: `I${r}-E${r}` };
    row.getCell(13).value = { formula: `J${r}-E${r}` };
    row.getCell(14).value = { formula: `K${r}*D${r}` };
    row.getCell(15).value = { formula: `L${r}*D${r}` };
    row.getCell(16).value = { formula: `M${r}*D${r}` };
    for (const col of [5, 6, 9, 10, 11, 12, 13, 14, 15, 16]) row.getCell(col).numFmt = $fmt;
    for (const col of [7, 8]) row.getCell(col).numFmt = '0%';
    if (i % 2) row.eachCell((c) => { if (!c.fill || c.fill.type !== 'pattern') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } }; });
  });

  const rt = 13 + filas.length;
  const tr = ws.getRow(rt);
  tr.getCell(1).value = 'TOTAL';
  tr.getCell(4).value = { formula: `SUM(D13:D${rt - 1})` };
  tr.getCell(5).value = { formula: `SUMPRODUCT(D13:D${rt - 1},E13:E${rt - 1})` };
  tr.getCell(6).value = { formula: `SUMPRODUCT(D13:D${rt - 1},F13:F${rt - 1})` };
  for (const col of [14, 15, 16]) tr.getCell(col).value = { formula: `SUM(${String.fromCharCode(64 + col)}13:${String.fromCharCode(64 + col)}${rt - 1})` };
  tr.eachCell((c) => { c.font = { bold: true }; c.border = { top: { style: 'double' } }; });
  for (const col of [5, 6, 14, 15, 16]) tr.getCell(col).numFmt = $fmt;
  ws.getCell(`A${rt + 2}`).value = 'La columna "Costo" es liso (escandallo) + material DTF + minutos de estampería. El desglose está en la hoja "Costo".';
  ws.getCell(`A${rt + 2}`).font = { size: 9, italic: true, color: { argb: 'FF666666' } };

  [26, 22, 9, 7, 11, 13, 8, 8, 13, 12, 15, 16, 15, 14, 14, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Hoja 2: de dónde sale cada costo
  const ws2 = wb.addWorksheet('Costo');
  ws2.addRow(['Producto', 'Liso (SKU)', 'Liso $', 'Material DTF $', 'Estampería $', 'Caras', 'COSTO $']);
  ws2.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } }; });
  for (const f of filas) ws2.addRow([f.nombre, f.lisoSku, Math.round(f.liso), Math.round(f.dtf), Math.round(f.mo), f.caras, Math.round(f.costo)]);
  ws2.getColumn(1).width = 26; ws2.getColumn(2).width = 24;
  for (const col of [3, 4, 5, 7]) { ws2.getColumn(col).width = 15; ws2.getColumn(col).numFmt = $fmt; }
  ws2.addRow([]);
  ws2.addRow(['⚠️ La remera BOXY (MADE, TIME, STARRY) lleva un consumo de tela ESTIMADO (0,887 / 0,890 m), no medido.']);
  ws2.addRow(['⚠️ Los minutos de estampería son estimados: 12 min por planchado, y ninguna tanda real medida todavía.']);

  await wb.xlsx.writeFile(SALIDA);
  console.log(`✅ ${SALIDA}`);
  console.log(`   ${filas.length} productos · ${filas.reduce((s, f) => s + f.u, 0)} prendas · costo total $${Math.round(filas.reduce((s, f) => s + f.costo * f.u, 0)).toLocaleString('es-AR')}`);
}
main().finally(() => prisma.$disconnect());
