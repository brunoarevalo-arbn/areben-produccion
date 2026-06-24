import { NextRequest, NextResponse } from 'next/server';
import { TiempoSchema } from '@/lib/validators/tiempos';
import { prisma } from '@/lib/prisma';
import { calcularCostoMinuto } from '@/lib/costoMinuto';
import { getSession } from '@/lib/auth';
import { ZodError } from 'zod';

const MARCAS_MUESTRA: Record<string, string> = {
  'Muestra Zattia':  'Zattia',
  'Muestra Stunned': 'Stunned',
};

function horaASegundos(h: string): number {
  const [hh, mm, ss = '0'] = h.split(':');
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
}

export async function GET(req: NextRequest) {
  if (!(await getSession(req))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const usuario = searchParams.get('usuario');
    const fecha   = searchParams.get('fecha');

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario requerido' }, { status: 400 });
    }

    const tiempos = await prisma.tiemposProduccion.findMany({
      where: {
        usuario,
        ...(fecha ? { fecha } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(tiempos);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error fetching tiempos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getSession(req))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });
  try {
    const body      = await req.json();
    const validated = TiempoSchema.parse(body);

    // Alta manual: si no vienen minutos pero sí horario, derivar minutosNetos
    // (misma lógica que el PATCH). La tablet ya envía minutosNetos > 0, no la afecta.
    if (!validated.minutosNetos && validated.horaInicio && validated.horaFin) {
      const segs = horaASegundos(validated.horaFin) - horaASegundos(validated.horaInicio);
      validated.minutosNetos = segs > 0 ? Math.floor(segs / 60) : 0;
    }

    const tiempo = await prisma.tiemposProduccion.create({ data: validated });

    const marcaMuestra = MARCAS_MUESTRA[validated.actividad];
    if (marcaMuestra && validated.minutosNetos > 0) {
      const costoMinuto = await calcularCostoMinuto();
      const monto = Math.round(validated.minutosNetos * costoMinuto);
      await prisma.gasto.create({
        data: {
          categoria: 'desarrollo',
          tipo:      'periodo',
          marca:     marcaMuestra,
          sku:       validated.sku || null,
          minutos:   Math.round(validated.minutosNetos),
          monto,
          concepto:  `Muestra ${marcaMuestra}${validated.sku ? ` — ${validated.sku}` : ''}`,
          fecha:     validated.fecha,
          creadoPor: validated.usuario,
          tiempoId:  tiempo.id,
        },
      });
    }

    return NextResponse.json(tiempo, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error creating tiempo' }, { status: 500 });
  }
}
