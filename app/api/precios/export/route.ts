import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requirePermiso } from '@/lib/auth';
import { construirFilasPrecios } from '@/lib/costos/preciosData';
import { calcularMargen, aplicarDescuento } from '@/lib/costos/precios';

// Genera un .xlsx con las filas de precios. Si viene descuento%, agrega el PVP nuevo
// y recalcula el margen sobre ese precio. NO escribe en GN: es solo la lista.
export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'precios'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const descuento = Number(sp.get('descuento')) || 0;
  const marca = (sp.get('marca') || '').trim().toLowerCase();
  const idsParam = (sp.get('ids') || '').trim();
  const ids = idsParam ? new Set(idsParam.split(',').map((s) => Number(s)).filter(Number.isFinite)) : null;

  const { filas, config } = await construirFilasPrecios();
  const sel = filas.filter((f) =>
    (!ids || ids.has(f.gnId)) &&
    (!marca || marca === 'todos' || f.marca.toLowerCase().includes(marca)),
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Areben';
  const ws = wb.addWorksheet('Precios');

  const conDesc = descuento > 0;
  ws.columns = [
    { header: 'Producto', key: 'nombre', width: 34 },
    { header: 'Marca', key: 'marca', width: 12 },
    { header: 'SKU liso', key: 'sku', width: 18 },
    { header: 'Costo neto', key: 'costo', width: 13, style: { numFmt: '#,##0' } },
    { header: 'PVP actual', key: 'pvp', width: 13, style: { numFmt: '#,##0' } },
    ...(conDesc ? [
      { header: 'Desc. %', key: 'desc', width: 9, style: { numFmt: '0"%"' } },
      { header: 'PVP nuevo', key: 'pvpNuevo', width: 13, style: { numFmt: '#,##0' } },
    ] : []),
    { header: 'Markup %', key: 'markup', width: 11, style: { numFmt: '0.0"%"' } },
    { header: 'Margen %', key: 'margen', width: 11, style: { numFmt: '0.0"%"' } },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F4' } };

  const round0 = (n: number | null) => (n == null ? null : Math.round(n));
  for (const f of sel) {
    const pvpNuevo = conDesc && f.pvpEfectivo != null ? aplicarDescuento(f.pvpEfectivo, descuento) : null;
    // El margen mostrado es sobre el precio vigente (con descuento si aplica).
    const pvpParaMargen = pvpNuevo ?? f.pvpEfectivo;
    const { markup, margen } = calcularMargen(f.costoNeto, pvpParaMargen, config.ivaVenta);
    ws.addRow({
      nombre: f.nombre,
      marca: f.marca,
      sku: f.skuLiso,
      costo: round0(f.costoNeto),
      pvp: round0(f.pvpEfectivo),
      ...(conDesc ? { desc: descuento, pvpNuevo: round0(pvpNuevo) } : {}),
      markup: markup == null ? null : Math.round(markup * 10) / 10,
      margen: margen == null ? null : Math.round(margen * 10) / 10,
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const fecha = req.nextUrl.searchParams.get('fecha') || '';
  const nombreArchivo = `precios${fecha ? '-' + fecha : ''}.xlsx`;
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  });
}
