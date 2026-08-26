import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { cargarCorrida, resumenDe } from '@/lib/calculadora/corridaDb';
import { estandar } from '@/lib/calculadora/corrida';
import {
  parseDatos, escalarCurva, mermaPorVuelta, TIRA_EMPTY, DATOS_VERSION,
  type Tela, type TiraCurva,
} from '@/lib/costos/escandallo';

const AplicarSchema = z.object({
  escandalloId: z.string().trim().min(1, 'Elegí el escandallo'),
  modo: z.enum(['promedio', 'ultima', 'mejor']).default('promedio'),
  aplicarTiempo: z.boolean().default(true),
  aplicarRibetes: z.boolean().default(true),
  talles: z.array(z.string().trim().min(1)).max(20).default([]),
  pasoPercent: z.number().min(-50).max(100).optional(),
  pasoCm: z.number().min(-100).max(200).optional(),
  preview: z.boolean().default(false),
});

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Baja la corrida al escandallo: los minutos medidos a `tiempoConfeccion` y cada
 * ribete a una tela `tipo:'tira'` con su curva por talle.
 *
 * `largoVueltaCm` y `descarteUnionCm` NO se tocan: son del rollo y de la costura
 * de la unión, no de la prenda. Se siguen cargando en el escandallo, y de ahí
 * sale la merma automática.
 *
 * Con `preview: true` calcula el diff y no escribe nada.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermiso(req, 'calculadora');
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { id } = await params;
  const parsed = AplicarSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  const corrida = await cargarCorrida(id);
  if (!corrida) return NextResponse.json({ error: 'La corrida no existe' }, { status: 404 });

  const escandallo = await prisma.escandallo.findUnique({ where: { id: d.escandalloId } });
  if (!escandallo) return NextResponse.json({ error: 'El escandallo no existe' }, { status: 404 });

  const r = resumenDe(corrida);
  const minutos = estandar(r, d.modo);
  if (d.aplicarTiempo && minutos <= 0) {
    return NextResponse.json({ error: 'La corrida todavía no midió ningún minuto' }, { status: 400 });
  }

  const datos = parseDatos(escandallo.datos);
  const cambios: { campo: string; antes: string; despues: string }[] = [];

  if (d.aplicarTiempo) {
    cambios.push({
      campo: 'Minutos de confección',
      antes: `${datos.tiempoConfeccion} min`,
      despues: `${minutos} min (${d.modo}, ${r.unidadesMedidas} prendas)`,
    });
    datos.tiempoConfeccion = minutos;
  }

  if (d.aplicarRibetes) {
    // El talle medido tiene que estar en la curva, o no hay desde dónde escalar.
    const talles = d.talles.length > 0 ? [...d.talles] : [corrida.talle];
    if (!talles.includes(corrida.talle)) talles.unshift(corrida.talle);

    for (const rib of corrida.ribetes) {
      const i = datos.telas.findIndex((t) => t.tipo === 'tira' && norm(t.nombre) === norm(rib.nombre));
      const base: Tela = i >= 0 ? { ...datos.telas[i] } : { ...TIRA_EMPTY, nombre: rib.nombre };

      const antesLargo = i >= 0 ? (datos.telas[i].largoTiraCm ?? 0) : 0;
      const antesAncho = i >= 0 ? (datos.telas[i].anchoTiraCm ?? 0) : 0;

      base.anchoTiraCm = rib.anchoCm;
      base.largoTiraCm = rib.largoCm;
      base.mermaPercent = mermaPorVuelta(rib.largoCm, base.largoVueltaCm ?? 0, base.descarteUnionCm ?? 0);

      // Los talles ya medidos a mano se respetan; el resto los deriva la regla.
      const previos = base.curva?.talles ?? [];
      const curva: TiraCurva = {
        talleBase: corrida.talle,
        ...(d.pasoCm != null ? { pasoCm: d.pasoCm } : {}),
        ...(d.pasoPercent != null ? { pasoPercent: d.pasoPercent } : {}),
        talles: talles.map((t) => {
          const prev = previos.find((p) => p.talle === t);
          if (t === corrida.talle) return { talle: t, largoCm: rib.largoCm };
          return prev?.manual ? prev : { talle: t, largoCm: 0 };
        }),
      };
      base.curva = escalarCurva(curva, rib.largoCm);

      cambios.push({
        campo: `Ribete "${rib.nombre}"`,
        antes: i >= 0 ? `${antesAncho} × ${antesLargo} cm, sin curva` : 'no estaba en el escandallo',
        despues: `${rib.anchoCm} × ${rib.largoCm} cm en ${corrida.talle} · curva de ${base.curva.talles.length} talles`,
      });

      if (i >= 0) datos.telas[i] = base;
      else datos.telas.push(base);
    }
  }

  if (d.preview) return NextResponse.json({ cambios, minutos, resumen: r });

  datos.version = DATOS_VERSION;
  await prisma.$transaction(async (tx) => {
    await tx.escandallo.update({ where: { id: d.escandalloId }, data: { datos: JSON.stringify(datos) } });
    await tx.corridaMuestra.update({
      where: { id },
      data: { escandalloId: d.escandalloId, aplicadaAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true, cambios, minutos });
}
