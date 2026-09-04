import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { CORRIDA_INCLUDE, resumenDe } from '@/lib/calculadora/corridaDb';

export const dynamic = 'force-dynamic';

// TODAS las corridas abiertas de QUIEN PIDE, no la primera: si hay cuatro
// relevamientos cargados, la tablet tiene que dejar elegir con cuál arranca.
// Vive bajo /api/tiempos a propósito: es el prefijo que proxy.ts ya le permite
// a la costurera (rol con cero permisos).
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  // El admin ve todas las abiertas —así Bruno las prueba desde su propia
  // pantalla—; cada costurera, sólo las suyas.
  const where = session.rol === 'admin'
    ? { estado: { in: ['pendiente', 'en_curso'] } }
    : { costurera: session.nombre, estado: { in: ['pendiente', 'en_curso'] } };

  const corridas = await prisma.corridaMuestra.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, nombre: true, tipoPrenda: true, talle: true, modo: true,
      estado: true, costurera: true, unidadActual: true, unidadesObjetivo: true,
      // Un tramo sin horaFin es el que está corriendo AHORA. Se muestra porque
      // sin reloj maestro, un cronómetro olvidado en otra corrida sigue sumando
      // y nada más lo delata.
      mediciones: { where: { horaFin: null }, select: { id: true }, take: 1 },
    },
  });

  const filas = corridas.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tipoPrenda: c.tipoPrenda,
    talle: c.talle,
    modo: c.modo,
    estado: c.estado,
    costurera: c.costurera,
    unidadActual: c.unidadActual,
    unidadesObjetivo: c.unidadesObjetivo,
    corriendo: c.mediciones.length > 0,
  }));

  // La que tiene el reloj corriendo primero, después las empezadas, y al final
  // las que todavía no arrancaron, en el orden en que se cargaron.
  const peso = (f: typeof filas[number]) => (f.corriendo ? 0 : f.estado === 'en_curso' ? 1 : 2);
  filas.sort((a, b) => peso(a) - peso(b));

  // Lo terminado HOY: el historial que faltaba. Una corrida que se cierra
  // desaparecía de la tablet sin dejar rastro de qué se relevó.
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  const terminadas = await prisma.corridaMuestra.findMany({
    where: {
      ...(session.rol === 'admin' ? {} : { costurera: session.nombre }),
      estado: 'terminada',
      terminadaAt: { gte: desde },
    },
    orderBy: { terminadaAt: 'desc' },
    include: CORRIDA_INCLUDE,
  });

  return NextResponse.json({
    abiertas: filas,
    terminadasHoy: terminadas.map((c) => {
      const r = resumenDe(c);
      return {
        id: c.id,
        nombre: c.nombre,
        talle: c.talle,
        modo: c.modo,
        costurera: c.costurera,
        minutos: Math.round(r.unidades.reduce((s, u) => s + u.trabajo, 0) * 10) / 10,
        pasos: r.porPaso.length,
      };
    }),
  });
}
