import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermiso } from '@/lib/auth';
import { cargarCorrida, resumenDe, tuboDe } from '@/lib/calculadora/corridaDb';
import { estandar } from '@/lib/calculadora/corrida';
import {
  parseDatos, escalarCurva, TIRA_EMPTY, DATOS_VERSION,
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
  const tubo = tuboDe(corrida);
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

    for (const rib of tubo.ribetes) {
      if (rib.largoPorPrenda <= 0) continue; // sin cortes medidos no hay qué escribir
      const i = datos.telas.findIndex((t) => t.tipo === 'tira' && norm(t.nombre) === norm(rib.nombre));
      const base: Tela = i >= 0 ? { ...datos.telas[i] } : { ...TIRA_EMPTY, nombre: rib.nombre };

      const antesLargo = i >= 0 ? (datos.telas[i].largoTiraCm ?? 0) : 0;
      const antesMerma = i >= 0 ? (datos.telas[i].mermaPercent ?? 0) : 0;

      // El ANCHO lo define Diseño: si la corrida no lo trae, se respeta el que
      // ya tenga el escandallo en vez de pisarlo con un cero.
      if (rib.anchoCm > 0) base.anchoTiraCm = rib.anchoCm;
      base.largoTiraCm = rib.largoPorPrenda;

      // 🔑 La merma sale MEDIDA de la secuencia del tubo, no de la fórmula: la
      // unión cae donde cae. Es del TUBO, así que va igual en todos los ribetes.
      base.mermaPercent = tubo.mermaPct;
      base.mermaMedida = true;

      // Los talles ya medidos a mano se respetan; el resto los deriva la regla.
      const previos = base.curva?.talles ?? [];
      const curva: TiraCurva = {
        talleBase: corrida.talle,
        ...(d.pasoCm != null ? { pasoCm: d.pasoCm } : {}),
        ...(d.pasoPercent != null ? { pasoPercent: d.pasoPercent } : {}),
        talles: talles.map((t) => {
          const prev = previos.find((p) => p.talle === t);
          if (t === corrida.talle) return { talle: t, largoCm: rib.largoPorPrenda };
          return prev?.manual ? prev : { talle: t, largoCm: 0 };
        }),
      };
      base.curva = escalarCurva(curva, rib.largoPorPrenda);

      cambios.push({
        campo: `Ribete "${rib.nombre}"`,
        antes: i >= 0 ? `${antesLargo} cm · merma ${antesMerma.toFixed(1)}% calculada` : 'no estaba en el escandallo',
        despues: `${rib.largoPorPrenda} cm en ${corrida.talle} (${rib.cortes} cortes en ${rib.unidadesConCorte} prenda${rib.unidadesConCorte === 1 ? '' : 's'}) · merma ${tubo.mermaPct}% MEDIDA · curva de ${base.curva.talles.length} talles`,
      });

      if (i >= 0) datos.telas[i] = base;
      else datos.telas.push(base);
    }

    if (tubo.desperdicioCm > 0) {
      cambios.push({
        campo: 'Merma del tubo (medida)',
        antes: 'se calculaba con la fórmula del paño',
        despues: `${tubo.desperdicioCm} cm de desperdicio sobre ${tubo.totalCm} cm = ${tubo.mermaPct}%`,
      });
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
