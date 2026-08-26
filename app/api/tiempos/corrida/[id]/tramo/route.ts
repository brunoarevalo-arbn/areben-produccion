import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { cargarCorrida, cerrarYAbrir, serializar } from '@/lib/calculadora/corridaDb';
import { MAQUINAS } from '@/lib/constants/maquinas';
import { MOTIVOS_PARADA } from '@/lib/constants/paradas';

// UN endpoint para los cinco gestos de la tablet: cambiar de máquina, pasar al
// paso siguiente, agregar un paso (relevamiento), parar y terminar la prenda.
// Los cinco son lo mismo —cerrar el tramo que corre y abrir el que sigue— y
// tenerlos en un solo lugar es tener un solo lugar donde perder un minuto.
const TramoSchema = z.object({
  minutos: z.number().min(0).max(600),
  horaInicio: z.string().optional(),
  horaFin: z.string().optional(),
  avanzarUnidad: z.boolean().optional(),
  siguiente: z
    .object({
      tipo: z.enum(['paso', 'parada']),
      pasoId: z.string().optional(),
      nuevoPaso: z
        .object({
          nombre: z.string().trim().min(1, 'Ponele nombre al paso').max(60),
          maquina: z.enum(MAQUINAS),
        })
        .optional(),
      maquina: z.enum(MAQUINAS).optional(),
      motivo: z.enum(MOTIVOS_PARADA).optional(),
    })
    .nullable()
    .optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const corrida = await cargarCorrida(id);
  if (!corrida) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  if (corrida.costurera !== session.nombre && session.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const parsed = TramoSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const fresca = await cerrarYAbrir(id, parsed.data);
    return NextResponse.json(serializar(fresca));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    console.error('[tiempos/corrida/tramo]', err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
