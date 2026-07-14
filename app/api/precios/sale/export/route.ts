import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requirePermiso } from '@/lib/auth';
import { construirFilasPrecios } from '@/lib/costos/preciosData';

// .xlsx con los precios promocionales confirmados (precioPromo != null), para subir
// a Gestión Nube a mano. No escribe en GN.
export async function GET(req: NextRequest) {
  if (!(await requirePermiso(req, 'precios'))) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { filas } = await construirFilasPrecios();
  const confirmados = filas.filter((f) => f.precioPromo != null);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Areben';
  const ws = wb.addWorksheet('Sale');
  ws.columns = [
    { header: 'Producto', key: 'nombre', width: 34 },
    { header: 'Código GN', key: 'code', width: 14 },
    { header: 'Marca', key: 'marca', width: 12 },
    { header: 'SKU liso', key: 'sku', width: 18 },
    { header: 'PVP actual', key: 'pvp', width: 13, style: { numFmt: '#,##0' } },
    { header: 'Descuento %', key: 'desc', width: 12, style: { numFmt: '0"%"' } },
    { header: 'Precio promocional', key: 'promo', width: 18, style: { numFmt: '#,##0' } },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F4' } };

  const round0 = (n: number | null) => (n == null ? null : Math.round(n));
  for (const f of confirmados) {
    ws.addRow({
      nombre: f.nombre,
      code: f.code ?? '',
      marca: f.marca,
      sku: f.skuLiso,
      pvp: round0(f.pvpEfectivo),
      desc: f.promoDescuentoPct == null ? null : Math.round(f.promoDescuentoPct * 10) / 10,
      promo: round0(f.precioPromo),
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const fecha = req.nextUrl.searchParams.get('fecha') || '';
  const nombreArchivo = `sale${fecha ? '-' + fecha : ''}.xlsx`;
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  });
}
