import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ESTADO_DISENO_LABEL: Record<string, string> = {
  inspiracion:   'Inspiración',
  en_desarrollo: 'En desarrollo',
  muestra_lista: 'Muestra lista',
  ajustes:       'Ajustes',
  produccion:    'Producción',
  descontinuado: 'Descontinuado',
};

const ESTADO_DISENO_COLOR: Record<string, string> = {
  inspiracion:   'bg-violet-100 text-violet-700',
  en_desarrollo: 'bg-amber-100 text-amber-700',
  muestra_lista: 'bg-sky-100 text-sky-700',
  ajustes:       'bg-orange-100 text-orange-700',
  produccion:    'bg-emerald-100 text-emerald-700',
  descontinuado: 'bg-stone-100 text-stone-400',
};

const ACCESOS = [
  { label: '+ Nuevo proyecto',  href: '/diseno/nuevo' },
  { label: '+ Escandallo',      href: '/costos' },
  { label: 'Registrar tiempos', href: '/tiempos' },
  { label: 'Reportes',          href: '/produccion/reportes' },
  { label: 'Molderías',         href: '/configuracion/molderias' },
  { label: 'Telas',             href: '/configuracion/telas' },
];

const MARCAS = ['Zattia', 'Stunned'] as const;

const DIAS_ATASCADO = 10;

function diasDesde(fecha: Date): number {
  return Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
}

function diasRestantes(fecha: Date): number {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const t   = new Date(fecha); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function formatFecha(fecha: Date): string {
  return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function DashboardPage() {
  const hoy = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const cutoff = new Date(Date.now() - DIAS_ATASCADO * 24 * 60 * 60 * 1000);

  const [proyectos, atascadosRaw, enProduccionSinSku, escandallosRaw, costuреrasCount] =
    await Promise.all([
      prisma.proyectoDiseno.findMany({
        where: { estado: { not: 'archivado' } },
        select: {
          id: true, nombre: true, marca: true, estado: true,
          estadoDiseno: true, fechaObjetivo: true,
          pasos: { select: { estado: true, saltado: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),

      // Proyectos con al menos un paso en_proceso sin moverse en DIAS_ATASCADO días
      prisma.proyectoDiseno.findMany({
        where: {
          estado: { not: 'archivado' },
          estadoDiseno: { notIn: ['descontinuado'] },
          pasos: { some: { estado: 'en_proceso', saltado: false, updatedAt: { lt: cutoff } } },
        },
        select: {
          id: true, nombre: true, marca: true, estadoDiseno: true,
          pasos: {
            where: { estado: 'en_proceso', saltado: false, updatedAt: { lt: cutoff } },
            select: { nombrePaso: true, updatedAt: true },
            orderBy: { updatedAt: 'asc' },
            take: 1,
          },
        },
      }),

      // Proyectos en producción sin SKUs asignados
      prisma.proyectoDiseno.findMany({
        where: { estadoDiseno: 'produccion', estado: { not: 'archivado' }, skus: { none: {} } },
        select: { id: true, nombre: true, marca: true },
      }),

      // Escandallos (para filtrar sin tiempo de confección)
      prisma.escandallo.findMany({ select: { id: true, nombre: true, datos: true } }),

      // Cantidad de costureras configuradas
      prisma.costoCosturera.count(),
    ]);

  // Agrupar proyectos por marca
  const porMarca = MARCAS.map((marca) => {
    const pms = proyectos.filter((p) => p.marca === marca);
    const porEstado = pms.reduce<Record<string, number>>((acc, p) => {
      acc[p.estadoDiseno] = (acc[p.estadoDiseno] ?? 0) + 1;
      return acc;
    }, {});
    return { marca, total: pms.length, porEstado };
  });

  // Proyectos con fecha objetivo
  const conFecha = proyectos
    .filter((p) => p.fechaObjetivo)
    .sort((a, b) => new Date(a.fechaObjetivo!).getTime() - new Date(b.fechaObjetivo!).getTime());

  // Atascados: sacar el paso más viejo de cada proyecto
  const atascados = atascadosRaw.map((p) => ({
    ...p,
    paso:      p.pasos[0]?.nombrePaso ?? '—',
    diasPaso:  p.pasos[0] ? diasDesde(p.pasos[0].updatedAt) : 0,
  })).sort((a, b) => b.diasPaso - a.diasPaso);

  // Escandallos sin tiempo de confección
  const sinTiempoConf = escandallosRaw.filter((e) => {
    if (!e.datos) return true;
    try { return !(JSON.parse(e.datos).tiempoConfeccion > 0); }
    catch { return true; }
  });

  // Construir lista de alertas
  interface Alerta { id: string; texto: string; href: string; }
  const alertas: Alerta[] = [];

  if (costuреrasCount === 0) {
    alertas.push({
      id:    'costureras',
      texto: 'Sin costureras configuradas — el costo de MO en escandallos será $0',
      href:  '/costos',
    });
  }
  enProduccionSinSku.forEach((p) => {
    alertas.push({
      id:    `sku-${p.id}`,
      texto: `"${p.nombre}" (${p.marca}) está en Producción pero no tiene SKUs asignados`,
      href:  `/diseno/${p.id}`,
    });
  });
  sinTiempoConf.forEach((e) => {
    alertas.push({
      id:    `conf-${e.id}`,
      texto: `Escandallo "${e.nombre}" no tiene tiempo de confección cargado`,
      href:  '/costos',
    });
  });

  return (
    <div className="p-8 max-w-4xl space-y-8">

      {/* Header */}
      <div>
        <p className="text-stone-400 text-sm capitalize">{hoy}</p>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">Dashboard</h1>
      </div>

      {/* Accesos rápidos */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Accesos rápidos</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ACCESOS.map((a) => (
            <Link key={a.href} href={a.href}
              className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-stone-700 hover:border-stone-400 hover:text-stone-900 transition text-center">
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Proyectos por marca */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Proyectos activos</p>
        <div className="grid grid-cols-2 gap-5">
          {porMarca.map(({ marca, total, porEstado }) => (
            <div key={marca} className="bg-white rounded-2xl border border-stone-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-stone-900">{marca}</h2>
                <span className="text-2xl font-black text-stone-200">{total}</span>
              </div>
              {total === 0 ? (
                <p className="text-xs text-stone-400 italic">Sin proyectos activos</p>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(porEstado)
                    .sort((a, b) => b[1] - a[1])
                    .map(([estado, cant]) => (
                      <div key={estado} className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_DISENO_COLOR[estado] ?? 'bg-stone-100 text-stone-500'}`}>
                          {ESTADO_DISENO_LABEL[estado] ?? estado}
                        </span>
                        <span className="text-xs font-bold text-stone-500 tabular-nums">{cant}</span>
                      </div>
                    ))}
                </div>
              )}
              <Link href="/diseno"
                className="mt-4 block text-center text-xs text-stone-400 hover:text-stone-700 transition pt-3 border-t border-stone-100">
                Ver todos →
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Fechas objetivo */}
      {conFecha.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Fechas objetivo</p>
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
            {conFecha.map((p) => {
              const dias    = diasRestantes(p.fechaObjetivo!);
              const vencido = dias < 0;
              const urgente = dias >= 0 && dias <= 7;
              return (
                <Link key={p.id} href={`/diseno/${p.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-stone-50 transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-stone-800 truncate">{p.nombre}</span>
                      <span className="text-xs text-stone-400">{p.marca}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_DISENO_COLOR[p.estadoDiseno] ?? 'bg-stone-100 text-stone-500'}`}>
                        {ESTADO_DISENO_LABEL[p.estadoDiseno] ?? p.estadoDiseno}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">{formatFecha(p.fechaObjetivo!)}</p>
                  </div>
                  <div className={`shrink-0 text-xs font-bold tabular-nums ${
                    vencido ? 'text-red-600' : urgente ? 'text-amber-600' : 'text-stone-500'
                  }`}>
                    {vencido ? `${Math.abs(dias)}d vencido` : dias === 0 ? 'Hoy' : `${dias}d`}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Proyectos atascados */}
      {atascados.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">
            Proyectos atascados
            <span className="ml-2 font-normal text-stone-300 normal-case tracking-normal">paso sin avanzar {DIAS_ATASCADO}+ días</span>
          </p>
          <div className="bg-white rounded-2xl border border-amber-200 divide-y divide-stone-100">
            {atascados.map((p) => (
              <Link key={p.id} href={`/diseno/${p.id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-amber-50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-stone-800 truncate">{p.nombre}</span>
                    <span className="text-xs text-stone-400">{p.marca}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_DISENO_COLOR[p.estadoDiseno] ?? 'bg-stone-100 text-stone-500'}`}>
                      {ESTADO_DISENO_LABEL[p.estadoDiseno] ?? p.estadoDiseno}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Paso: <span className="font-medium text-stone-600">{p.paso}</span>
                  </p>
                </div>
                <div className="shrink-0 text-xs font-bold text-amber-600 tabular-nums">
                  {p.diasPaso}d sin mover
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Alertas */}
      {alertas.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">
            Alertas
            <span className="ml-2 font-normal text-stone-300 normal-case tracking-normal">{alertas.length} {alertas.length === 1 ? 'pendiente' : 'pendientes'}</span>
          </p>
          <div className="bg-white rounded-2xl border border-red-100 divide-y divide-stone-100">
            {alertas.map((a) => (
              <Link key={a.id} href={a.href}
                className="flex items-start gap-3 px-5 py-3 hover:bg-red-50 transition">
                <span className="mt-0.5 shrink-0 text-red-400 text-xs font-black">!</span>
                <p className="text-xs text-stone-700 leading-relaxed">{a.texto}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
