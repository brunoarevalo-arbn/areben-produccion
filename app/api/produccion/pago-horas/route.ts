import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import {
  calcularPeriodo, periodoDe, CONFIG_DEFECTO, type ConfigPago, type Periodo, type Redondeo, type ResultadoPeriodo,
} from '@/lib/produccion/pago-horas';

// Es plata y sueldo de una persona ⇒ sólo admin (Bruno y Darío). ⛔ `costos` no alcanza: lo tienen
// también Lorena y Stefania.
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const hoyAR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

type ConfigDB = Awaited<ReturnType<typeof prisma.configPagoHoras.findUnique>>;
const aConfig = (c: ConfigDB): ConfigPago => c ? {
  jornadaMin: c.jornadaMin, toleranciaMin: c.toleranciaMin, fraccionMin: c.fraccionMin, redondeo: c.redondeo as Redondeo,
  descuentaPausas: c.descuentaPausas, recargoExtraPct: c.recargoExtraPct, periodo: c.periodo as Periodo,
  anclaPeriodo: c.anclaPeriodo, diasSemana: c.diasSemana,
} : CONFIG_DEFECTO;

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const usuarioId = sp.get('usuarioId');

  if (!usuarioId) {
    const costureras = await prisma.usuario.findMany({ where: { rol: 'costurera', activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });
    return NextResponse.json({ costureras });
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, nombre: true } });
  if (!usuario) return NextResponse.json({ error: 'Usuario inexistente' }, { status: 404 });

  const cfgDB = await prisma.configPagoHoras.findUnique({ where: { usuarioId } });
  const cfg = aConfig(cfgDB);
  const desdeQ = sp.get('desde'), hastaQ = sp.get('hasta');
  const { desde, hasta } = desdeQ && hastaQ && FECHA.test(desdeQ) && FECHA.test(hastaQ)
    ? { desde: desdeQ, hasta: hastaQ }
    : periodoDe(cfg.periodo, sp.get('ref') && FECHA.test(sp.get('ref')!) ? sp.get('ref')! : hoyAR(), cfg.anclaPeriodo);

  const [tarifas, ajustes, liquidacion, registros, historial] = await Promise.all([
    prisma.tarifaHora.findMany({ where: { usuarioId }, orderBy: { desde: 'asc' } }),
    prisma.ajusteHorasDia.findMany({ where: { usuarioId, fecha: { gte: desde, lte: hasta } } }),
    prisma.liquidacionHoras.findUnique({ where: { usuarioId_desde_hasta: { usuarioId, desde, hasta } } }),
    // `tiempos_produccion.usuario` guarda el NOMBRE, sin FK.
    prisma.tiemposProduccion.findMany({
      where: { usuario: usuario.nombre, fecha: { gte: desde, lte: hasta } },
      select: { fecha: true, actividad: true, horaInicio: true, horaFin: true, minutosNetos: true },
    }),
    // Lo cerrado: cada fila es la foto de un período, con lo que se pagó.
    prisma.liquidacionHoras.findMany({
      where: { usuarioId }, orderBy: { desde: 'desc' },
      select: { desde: true, hasta: true, totalMin: true, totalMonto: true, pagadoEl: true },
    }),
  ]);

  const calculado = calcularPeriodo(cfg, tarifas, registros, desde, hasta, ajustes);
  // Un período CERRADO muestra su foto, ⛔ lo recalculado: si cambió la tarifa o la config,
  // lo pagado no se mueve.
  const resultado = (liquidacion?.detalle as unknown as ResultadoPeriodo | null) ?? calculado;
  return NextResponse.json({
    usuario, config: cfg, configGuardada: !!cfgDB, tarifas, ajustes, desde, hasta,
    historial, resultado, cerrada: !!liquidacion, pagadoEl: liquidacion?.pagadoEl ?? null,
    // Si está cerrada y hoy daría otra cosa, se avisa: no se pisa sola.
    difiereDeHoy: !!liquidacion && Math.round(calculado.totalMonto) !== Math.round(liquidacion.totalMonto),
    totalHoy: calculado.totalMonto,
  });
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const b = await req.json();
  const usuarioId: string | undefined = b.usuarioId;
  if (!usuarioId) return NextResponse.json({ error: 'Costurera requerida' }, { status: 400 });
  const err = (m: string) => NextResponse.json({ error: m }, { status: 400 });

  switch (b.accion) {
    case 'config': {
      const c = b.config ?? {};
      const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d);
      if (!['SEMANAL', 'QUINCENAL', 'MENSUAL'].includes(c.periodo)) return err('Período inválido');
      if (!['ABAJO', 'CERCANO', 'ARRIBA'].includes(c.redondeo)) return err('Redondeo inválido');
      if (c.anclaPeriodo && !FECHA.test(c.anclaPeriodo)) return err('Fecha de ancla inválida');
      const dias = Array.isArray(c.diasSemana) ? c.diasSemana.map(Number).filter((d: number) => d >= 0 && d <= 6) : [1, 2, 3, 4, 5];
      const data = {
        jornadaMin: Math.max(1, Math.round(num(c.jornadaMin, 540))), toleranciaMin: Math.max(0, Math.round(num(c.toleranciaMin, 29))),
        fraccionMin: Math.max(1, Math.round(num(c.fraccionMin, 30))), redondeo: c.redondeo as string,
        descuentaPausas: !!c.descuentaPausas, recargoExtraPct: Math.max(0, num(c.recargoExtraPct, 0)),
        periodo: c.periodo as string, anclaPeriodo: c.anclaPeriodo || null, diasSemana: dias,
      };
      await prisma.configPagoHoras.upsert({ where: { usuarioId }, create: { usuarioId, ...data }, update: data });
      return NextResponse.json({ ok: true });
    }
    case 'tarifa': {
      const monto = Number(b.montoHora);
      if (!FECHA.test(b.desde ?? '') || !(monto > 0)) return err('Tarifa y fecha de vigencia requeridas');
      await prisma.tarifaHora.upsert({ where: { usuarioId_desde: { usuarioId, desde: b.desde } }, create: { usuarioId, desde: b.desde, montoHora: monto }, update: { montoHora: monto } });
      return NextResponse.json({ ok: true });
    }
    case 'ajuste': {
      const min = Math.round(Number(b.minutos));
      if (!FECHA.test(b.fecha ?? '') || !Number.isFinite(min) || min < 0) return err('Día y minutos requeridos');
      if (await prisma.liquidacionHoras.findFirst({ where: { usuarioId, desde: { lte: b.fecha }, hasta: { gte: b.fecha } } })) return err('Ese día está en un período cerrado');
      await prisma.ajusteHorasDia.upsert({ where: { usuarioId_fecha: { usuarioId, fecha: b.fecha } }, create: { usuarioId, fecha: b.fecha, minutos: min, nota: b.nota || null }, update: { minutos: min, nota: b.nota || null } });
      return NextResponse.json({ ok: true });
    }
    case 'borrar_ajuste': {
      if (await prisma.liquidacionHoras.findFirst({ where: { usuarioId, desde: { lte: b.fecha }, hasta: { gte: b.fecha } } })) return err('Ese día está en un período cerrado');
      await prisma.ajusteHorasDia.deleteMany({ where: { usuarioId, fecha: b.fecha } });
      return NextResponse.json({ ok: true });
    }
    case 'cerrar': {
      if (!FECHA.test(b.desde ?? '') || !FECHA.test(b.hasta ?? '')) return err('Período inválido');
      const [usuario, cfgDB, tarifas, ajustes] = await Promise.all([
        prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } }),
        prisma.configPagoHoras.findUnique({ where: { usuarioId } }),
        prisma.tarifaHora.findMany({ where: { usuarioId } }),
        prisma.ajusteHorasDia.findMany({ where: { usuarioId, fecha: { gte: b.desde, lte: b.hasta } } }),
      ]);
      if (!usuario) return err('Usuario inexistente');
      const registros = await prisma.tiemposProduccion.findMany({
        where: { usuario: usuario.nombre, fecha: { gte: b.desde, lte: b.hasta } },
        select: { fecha: true, actividad: true, horaInicio: true, horaFin: true, minutosNetos: true },
      });
      const r = calcularPeriodo(aConfig(cfgDB), tarifas, registros, b.desde, b.hasta, ajustes);
      // Cerrar con un día sin tarifa congelaría un 0 que parece medido.
      if (r.diasSinTarifa > 0) return err(`Hay ${r.diasSinTarifa} día(s) sin tarifa vigente: cargá la tarifa antes de cerrar`);
      const liq = await prisma.liquidacionHoras.create({
        data: { usuarioId, desde: b.desde, hasta: b.hasta, totalMin: r.totalMin, totalMonto: r.totalMonto, detalle: JSON.parse(JSON.stringify(r)), pagadoEl: b.pagado ? new Date() : null },
      }).catch(() => null);
      if (!liq) return err('Ese período ya está cerrado');
      return NextResponse.json({ ok: true });
    }
    case 'pagado': {
      await prisma.liquidacionHoras.updateMany({ where: { usuarioId, desde: b.desde, hasta: b.hasta }, data: { pagadoEl: b.pagado ? new Date() : null } });
      return NextResponse.json({ ok: true });
    }
    case 'reabrir': {
      // Sólo un período NO pagado se puede reabrir: lo pagado es lo pagado.
      const r = await prisma.liquidacionHoras.deleteMany({ where: { usuarioId, desde: b.desde, hasta: b.hasta, pagadoEl: null } });
      return r.count ? NextResponse.json({ ok: true }) : err('Sólo se reabre un período que no está pagado');
    }
    default:
      return err('Acción desconocida');
  }
}
