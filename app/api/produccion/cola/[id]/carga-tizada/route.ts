import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { prefillDeOrden, hermanasConTizadas, esCargaInterna, cargadaPor } from '@/lib/produccion/cargaCorte';
import { z } from 'zod';

type Ctx = { params: Promise<{ id: string }> };

// Carga rápida de tizada HECHA POR EL TALLER, con el mismo formulario que usa el cortador
// (components/produccion/cortador/CargaCorteForm). Existe porque muchos cortadores no
// cargan nunca — no tienen usuario o lo pasan por teléfono — y la deuda con ellos no
// llegaba a existir en el sistema.
//
// Diferencia con la carga del cortador (POST /api/cortador/carga/[ordenId]): ésta es
// COBRABLE AL INSTANTE. Además de guardar la ficha, hace lo mismo que el botón "Validar
// corte" (validar-corte/route.ts): escribe la columna `costoCorte` y deja
// `corteEstado='validado'`, que es lo que la cuenta corriente cuenta como pendiente.
// Sigue sin tocar stock ni rollos: la ficha de tela es un paso aparte y opcional.

const Schema = z.object({
  tizadas: z.array(z.object({ nombre: z.string().default(''), metros: z.string().default(''), unidades: z.string().default('1') })).min(1),
  talles:  z.array(z.object({ talle: z.string().min(1), cantidad: z.number().int().min(0) })).min(1),
  // Sin default a propósito: acá el precio ES el saldo del cortador, y `modoCosto`
  // decide si se multiplica por las unidades. Un default silencioso cambiaría la plata.
  costoCorte: z.number().positive('Cargá el precio del corte'),
  modoCosto:  z.enum(['total', 'unidad']),
  fechaCorte: z.string().optional(),
});

const SELECT = {
  id: true, sku: true, descripcion: true, marca: true, cantidad: true, loteId: true,
  cortadorId: true, corteEstado: true, fichaCorteCargada: true, fichaCorteData: true, pagoCorteId: true,
} as const;

// Por qué no se puede cargar/editar desde acá. `null` = se puede.
// La última regla es la que importa: esta carga NO pisa lo que cargó el cortador. Si él ya
// cargó, el camino es "Validar corte" (o la ficha) — si no, el taller se apropiaría de su
// carga y el "deshacer" de acá le borraría el trabajo.
function motivoBloqueo(orden: { fichaCorteCargada: boolean; cortadorId: string | null; pagoCorteId: string | null; fichaCorteData: unknown }) {
  if (orden.fichaCorteCargada) return 'Esta orden ya tiene ficha de corte: editala desde la ficha.';
  if (!orden.cortadorId)       return 'Asigná un cortador antes de cargar la tizada.';
  if (orden.pagoCorteId)       return 'Este corte ya está imputado a un pago: no se puede reescribir.';
  if (orden.fichaCorteData && !esCargaInterna(orden.fichaCorteData as Record<string, unknown>)) {
    return 'El corte lo cargó el cortador: validalo desde la Cola o editá la ficha.';
  }
  return null;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;

  const orden = await prisma.ordenProduccion.findUnique({ where: { id }, select: SELECT });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });

  const cortador = orden.cortadorId
    ? await prisma.cortador.findUnique({ where: { id: orden.cortadorId }, select: { nombre: true, tarifaDefault: true, tarifaModo: true } })
    : null;

  // Sin nada cargado, el precio arranca en la tarifa pactada del cortador (editable).
  const tarifa = cortador?.tarifaDefault != null
    ? { costoCorte: Number(cortador.tarifaDefault), modoCosto: cortador.tarifaModo === 'total' ? 'total' as const : 'unidad' as const }
    : null;

  const fd = orden.fichaCorteData as Record<string, unknown> | null;
  const interna = esCargaInterna(fd);

  return NextResponse.json({
    sku: orden.sku,
    descripcion: orden.descripcion || orden.marca,
    cantidadPlanificada: orden.cantidad,
    cortadorNombre: cortador?.nombre ?? null,
    // El taller sí reabre lo que ya quedó 'validado': es cómo se corrige una carga interna.
    prefill: prefillDeOrden(orden, { estados: ['cargado', 'validado'], tarifa }),
    hermanas: await hermanasConTizadas(orden.loteId, orden.id),
    yaCargado: orden.corteEstado === 'cargado' || orden.corteEstado === 'validado',
    cargaInterna: interna,
    cargadaPor: cargadaPor(fd),
    puedeDeshacer: interna && !orden.fichaCorteCargada && !orden.pagoCorteId,
    motivo: motivoBloqueo(orden),
  });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;

  const orden = await prisma.ordenProduccion.findUnique({ where: { id }, select: SELECT });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  const motivo = motivoBloqueo(orden);
  if (motivo) return NextResponse.json({ error: motivo }, { status: 400 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { tizadas, talles, costoCorte, modoCosto, fechaCorte } = parsed.data;

  const cantidad = talles.reduce((s, t) => s + t.cantidad, 0);
  if (cantidad <= 0) return NextResponse.json({ error: 'Cargá al menos un talle con cantidad' }, { status: 400 });

  // La carga pisa `cantidad` con lo realmente cortado. Se guarda la planificada para que
  // deshacer devuelva la OP como estaba; re-cargar encima NO la pisa con la ya pisada.
  const fdPrev = orden.fichaCorteData as Record<string, unknown> | null;
  const cantidadPrevia = typeof fdPrev?.cantidadPrevia === 'number' ? fdPrev.cantidadPrevia : orden.cantidad;

  // Misma forma que la carga del cortador (rollos vacíos: la tela la asigna el taller
  // después), más la marca de que la cargó el taller y quién.
  const fichaCorteData = {
    tizadas: tizadas.map((t, i) => ({ id: `t${i + 1}`, nombre: t.nombre, modo: 'tizada' as const, metros: t.metros, unidades: t.unidades, rollos: [] })),
    talles: Object.fromEntries(talles.filter((t) => t.cantidad > 0).map((t) => [t.talle, String(t.cantidad)])),
    avios: [],
    cortadorId: orden.cortadorId,
    costoCorte,
    modoCosto,
    fechaCorte,
    cargaInterna: true,
    cargadaPor: session.nombre,
    cantidadPrevia,
  };

  // El total se calcula con la cantidad RECIÉN cargada, no con la planificada.
  const total = modoCosto === 'unidad' ? costoCorte * cantidad : costoCorte;
  const cortador = await prisma.cortador.findUnique({ where: { id: orden.cortadorId! }, select: { nombre: true } });
  const fecha = fechaCorte ? new Date(`${fechaCorte}T12:00:00Z`) : new Date();

  await prisma.ordenProduccion.update({
    where: { id },
    data: {
      fichaCorteData, cantidad,
      corteEstado: 'validado',
      costoCorte: new Prisma.Decimal(total),
      cortador: cortador?.nombre ?? null,
      fechaCorte: fecha,
    },
  });

  return NextResponse.json({ ok: true, total });
}

// Deshacer una carga interna: borra la ficha, devuelve el costoCorte a 0 (sale de la
// cuenta corriente) y vuelve a 'asignado'. Solo cargas internas: la carga del cortador la
// borra él desde su panel. Bloqueado si ya se pagó o si el taller ya hizo la ficha de tela.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requirePermiso(req, 'produccion');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  const { id } = await params;

  const orden = await prisma.ordenProduccion.findUnique({ where: { id }, select: SELECT });
  if (!orden) return NextResponse.json({ error: 'OP no encontrada' }, { status: 404 });
  if (orden.fichaCorteCargada) return NextResponse.json({ error: 'Esta orden ya tiene ficha de corte: revertila desde la ficha.' }, { status: 400 });
  if (orden.pagoCorteId) return NextResponse.json({ error: 'Este corte ya está imputado a un pago: no se puede deshacer.' }, { status: 400 });
  if (!esCargaInterna(orden.fichaCorteData as Record<string, unknown> | null)) {
    return NextResponse.json({ error: 'Esta carga no es interna: la borra el cortador desde su panel.' }, { status: 400 });
  }

  await prisma.ordenProduccion.update({
    where: { id },
    data: {
      fichaCorteData: Prisma.DbNull,
      corteEstado: orden.cortadorId ? 'asignado' : null,
      costoCorte: new Prisma.Decimal(0),
      // Los dos los escribió la carga: si no se limpian, la OP queda afirmando una fecha
      // de corte y un cortador de un corte que ya no existe.
      cortador: null,
      fechaCorte: null,
      ...(typeof (orden.fichaCorteData as Record<string, unknown> | null)?.cantidadPrevia === 'number'
        ? { cantidad: (orden.fichaCorteData as Record<string, number>).cantidadPrevia }
        : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
