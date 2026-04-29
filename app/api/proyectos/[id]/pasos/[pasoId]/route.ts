import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string; pasoId: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { pasoId }                                   = await params;
    const { estado, observaciones, datos, saltado, esTercero, responsableId, terceroNombre, responsableInternoId } = await req.json();

    const data: Record<string, unknown> = {};

    if (saltado !== undefined) {
      data.saltado = saltado;
    }

    if (estado !== undefined) {
      data.estado = estado;
      if (estado === 'en_proceso') {
        data.fechaInicio     = new Date();
        data.fechaCompletado = null;
      } else if (estado === 'completado') {
        data.fechaCompletado = new Date();
      } else if (estado === 'pendiente') {
        data.fechaInicio     = null;
        data.fechaCompletado = null;
      }
    }

    if (observaciones            !== undefined) data.observaciones            = observaciones            || null;
    if (datos                    !== undefined) data.datos                    = datos                    || null;
    if (esTercero                !== undefined) data.esTercero                = Boolean(esTercero);
    if (responsableId            !== undefined) data.responsableId            = responsableId            || null;
    if (terceroNombre            !== undefined) data.terceroNombre            = terceroNombre            || null;
    if (responsableInternoId     !== undefined) data.responsableInternoId     = responsableInternoId     || null;

    const paso = await prisma.proyectoPaso.update({ where: { id: pasoId }, data });
    return NextResponse.json({
      ...paso,
      fechaInicio:     paso.fechaInicio?.toISOString()     ?? null,
      fechaCompletado: paso.fechaCompletado?.toISOString() ?? null,
      updatedAt:       paso.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error actualizando paso' }, { status: 500 });
  }
}
