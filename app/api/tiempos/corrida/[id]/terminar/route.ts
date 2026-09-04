import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { cargarCorrida, cerrarYAbrir, horaTaller, resumenDe, serializar } from '@/lib/calculadora/corridaDb';
import { ACTIVIDAD_MEDICION, ACTIVIDAD_RELEVAMIENTO, crearTiempoConGasto } from '@/lib/tiempos/registrar';

const TerminarSchema = z.object({
  minutos: z.number().min(0).max(600).optional(),
  horaFin: z.string().optional(),
  // La fecha la manda la tablet con el mismo criterio con el que después PIDE
  // los registros del día: si el que escribe y el que lee no coinciden, el
  // registro existe y no se ve.
  fecha: z.string().optional(),
});

// Cierra la corrida. Cierra primero el tramo que pudiera estar corriendo, para
// que no quede un tramo abierto para siempre falseando el total.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const corrida = await cargarCorrida(id);
  if (!corrida) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  if (corrida.costurera !== session.nombre && session.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }
  if (corrida.estado === 'terminada') return NextResponse.json(serializar(corrida));

  const parsed = TerminarSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  await cerrarYAbrir(id, { minutos: parsed.data.minutos ?? 0, horaFin: parsed.data.horaFin, siguiente: null });
  await prisma.corridaMuestra.update({
    where: { id },
    data: { estado: 'terminada', terminadaAt: new Date() },
  });

  const fresca = await cargarCorrida(id);

  // La corrida REEMPLAZA al registro de costura que la costurera hubiera
  // cargado a mano: coser la muestra es trabajo, y sin esto el rato que estuvo
  // midiendo no aparecía en ningún lado —ni en sus registros del día, ni en
  // reportes, ni como costo de la muestra—.
  //
  // ⚠️ Van los minutos de TRABAJO, sin las paradas: el taller ya está adentro
  // del costoMinuto absorbente y sumarlas acá las cobraría dos veces.
  const r = resumenDe(fresca!);
  const minutos = Math.round(r.unidades.reduce((s, u) => s + u.trabajo, 0));
  if (minutos > 0) {
    const cerradas = fresca!.mediciones.filter((m) => m.horaFin != null);
    await crearTiempoConGasto({
      usuario: fresca!.costurera,
      actividad: fresca!.modo === 'relevamiento' ? ACTIVIDAD_RELEVAMIENTO : ACTIVIDAD_MEDICION,
      fecha: parsed.data.fecha || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
      marca: fresca!.marca,
      // La máquina del registro es en la que MÁS tiempo estuvo, no la del primer
      // paso: en un relevamiento la declarada es sólo la del arranque.
      maquina: r.porMaquina[0]?.maquina,
      sku: fresca!.sku ?? undefined,
      cantidad: r.unidadesMedidas,
      defectos: 0,
      horaInicio: cerradas[0]?.horaInicio ?? horaTaller(),
      horaFin: cerradas[cerradas.length - 1]?.horaFin ?? horaTaller(),
      minutosNetos: minutos,
      // 'guardado' es lo que manda la tablet en sus 711 registros: un estado
      // propio haría que este no se vea igual que los demás.
      estado: 'guardado',
    });
  }

  return NextResponse.json(serializar(fresca!));
}
