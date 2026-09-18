import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { cantidadCortada, ingresadasPorOrden, baseDeRepartoConOrigen } from '@/lib/produccion/cantidades';
import { PARTE_COMPARTIDA } from '@/lib/constants/partes';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const sku = req.nextUrl.searchParams.get('sku')?.trim();
  if (!sku) return NextResponse.json({ error: 'SKU requerido' }, { status: 400 });

  const registros = await prisma.tiemposProduccion.findMany({
    where: {
      sku:          { equals: sku, mode: 'insensitive' },
      cantidad:     { gt: 0 },
      minutosNetos: { gt: 0 },
    },
    select: { minutosNetos: true, cantidad: true, parte: true },
  });

  // OPs del SKU (para el lote y la cantidad producida). Se busca SIEMPRE, aunque el
  // SKU no tenga tiempos propios: si está en un lote con tiempos de otros colores,
  // igual devolvemos el promedio del lote.
  const ops = await prisma.ordenProduccion.findMany({
    where:  { sku: { equals: sku, mode: 'insensitive' } },
    select: { id: true, cantidad: true, cantidadCortada: true, loteId: true },
  });

  // 🔴 El denominador de min/prenda son las prendas que esos minutos produjeron: lo
  // INGRESADO. Mientras no haya entrado nada se cae a lo cortado. Antes se usaba
  // `cantidad`, que iba cambiando de significado sola (planificado → cortado → producido).
  const ingresadas = await ingresadasPorOrden(prisma, ops.map((o) => o.id));
  const unidadesDe = (o: { id: string; cantidad: number; cantidadCortada: number | null }) =>
    ingresadas.get(o.id) || cantidadCortada(o);

  // Individual del SKU (solo si tiene tiempos propios).
  //
  // 🔑 De DÓNDE salió el denominador viaja con el número. Los tres escalones no
  // valen lo mismo: ingresado y cortado son medidos, el último es el PLAN —
  // `cantidad` del registro la copia la tablet de `OrdenProduccion.cantidad`, que
  // desde el 17-sep es sólo lo planificado. Un min/prenda dividido por el plan
  // parece medido y no lo es, así que la pantalla tiene con qué decirlo.
  let minutosPromedio = 0;
  let cantidadProducida = 0;
  let denominador: 'ingresado' | 'cortado' | 'planificado' | null = null;
  if (registros.length > 0) {
    const minutosTotales = registros.reduce((s, r) => s + r.minutosNetos, 0);
    const ingresadasTotal = ops.reduce((s, o) => s + (ingresadas.get(o.id) || 0), 0);
    cantidadProducida = ops.reduce((s, o) => s + unidadesDe(o), 0);
    if (cantidadProducida > 0) {
      // La procedencia por OP la contesta `baseDeRepartoConOrigen`, que es su
      // dueña: derivarla acá de `unidades > 0` daría "cortado" para una orden que
      // nadie cortó, porque `cantidadCortada()` cae a lo planificado.
      // Sobre eso, el agregado es CONSERVADOR: con una sola OP sin corte, el
      // total ya tiene plan adentro y no se puede llamar medido.
      const todasCortadas = ops.every((o) => baseDeRepartoConOrigen(o)?.origen === 'cortado');
      denominador = ingresadasTotal > 0 ? 'ingresado' : todasCortadas ? 'cortado' : 'planificado';
    }
    if (cantidadProducida === 0) {
      cantidadProducida = Math.max(...registros.map((r) => r.cantidad));
      if (cantidadProducida > 0) denominador = 'planificado';
    }
    minutosPromedio = cantidadProducida > 0 ? minutosTotales / cantidadProducida : 0;
  }

  // Tiempo unificado del lote: si el SKU pertenece a un lote con ≥2 colores, el
  // min/prenda ponderado = Σ minutos de todos los SKUs del lote ÷ Σ unidades del lote.
  let lote: { minutosPromedio: number; cantidadTotal: number; colores: number; registros: number } | undefined;
  const loteId = ops.find((o) => o.loteId)?.loteId ?? null;
  if (loteId) {
    const loteOps = await prisma.ordenProduccion.findMany({
      where: { loteId },
      select: { id: true, sku: true, cantidad: true, cantidadCortada: true },
    });
    const ingLote = await ingresadasPorOrden(prisma, loteOps.map((o) => o.id));
    const loteSkus = [...new Set(loteOps.map((o) => o.sku).filter(Boolean))] as string[];
    const cantidadLote = loteOps.reduce((s, o) => s + (ingLote.get(o.id) || cantidadCortada(o)), 0);
    if (loteSkus.length >= 2 && cantidadLote > 0) {
      const regsLote = await prisma.tiemposProduccion.findMany({
        where: { sku: { in: loteSkus }, cantidad: { gt: 0 }, minutosNetos: { gt: 0 } },
        select: { minutosNetos: true },
      });
      if (regsLote.length > 0) {
        // El tiempo se registra para TODA la tanda (se produce junta) y se asigna a
        // 1-2 SKUs; por eso el promedio se divide por el TOTAL de prendas del lote.
        const minLote = regsLote.reduce((s, r) => s + r.minutosNetos, 0);
        lote = {
          minutosPromedio: Math.round((minLote / cantidadLote) * 10) / 10,
          cantidadTotal:   cantidadLote,
          colores:         loteSkus.length,
          registros:       regsLote.length,
        };
      }
    }
  }

  // Sin tiempos propios NI de lote → no hay dato.
  if (registros.length === 0 && !lote) return NextResponse.json({ encontrado: false });

  // Apertura por PARTE, para las prendas que se cosen por partes (la bikini). El
  // denominador es el MISMO que el del total —una unidad de la OP lleva las dos
  // piezas—, así que las partes suman el promedio general.
  //
  // ⚠️ `sinParte` son los minutos que no dijeron qué pieza se cosía. No se reparten
  // entre las partes: repartirlos sería inventarlos. Se informan para que se vea
  // cuánto del total todavía no está separado.
  let porParte:
    | { parte: string; minutos: number; minutosCompartidos: number; minutosTotal: number; minutosPromedio: number; registros: number }[]
    | undefined;
  let minutosSinParte = 0;
  let minutosCompartidos = 0;
  if (cantidadProducida > 0 && registros.some((r) => r.parte)) {
    const acum = new Map<string, { minutos: number; registros: number }>();
    for (const r of registros) {
      if (!r.parte) { minutosSinParte += r.minutosNetos; continue; }
      if (r.parte === PARTE_COMPARTIDA) { minutosCompartidos += r.minutosNetos; continue; }
      const a = acum.get(r.parte) ?? { minutos: 0, registros: 0 };
      a.minutos += r.minutosNetos;
      a.registros += 1;
      acum.set(r.parte, a);
    }

    // 🔑 Lo COMPARTIDO (el tubo de la cortacollareta) ⛔ no es de ninguna pieza: se
    // corta una vez y la tira va a todas. Se reparte en PARTES IGUALES entre las
    // piezas, que es repartir por unidad —cada bikini lleva un corpiño y una
    // bombacha, así que el total de piezas es el mismo para las dos—.
    //
    // ⚠️ Es un REPARTO, ⛔ no una medición: la bombacha probablemente se lleve más
    // tira que un triangulito. Por eso viaja en su propia columna
    // (`minutosCompartidos`) y ⛔ no fundido adentro de `minutos`: quien lo muestre
    // puede decir cuánto de la pieza se midió y cuánto le tocó.
    const n = acum.size;
    const porPieza = n > 0 ? minutosCompartidos / n : 0;

    porParte = [...acum.entries()]
      .map(([parte, a]) => {
        const total = a.minutos + porPieza;
        return {
          parte,
          minutos:            Math.round(a.minutos),
          minutosCompartidos: Math.round(porPieza),
          minutosTotal:       Math.round(total),
          minutosPromedio:    Math.round((total / cantidadProducida) * 10) / 10,
          registros:          a.registros,
        };
      })
      .sort((x, y) => y.minutosTotal - x.minutosTotal);
  }

  return NextResponse.json({
    encontrado:      true,
    minutosPromedio: Math.round(minutosPromedio * 10) / 10, // 0 si el SKU no tiene tiempos propios
    cantidadTotal:   cantidadProducida,
    // 'planificado' ⇒ el min/prenda está dividido por lo que se PENSABA hacer, no
    // por lo que se hizo: quien lo muestre tiene que decirlo.
    denominador,
    registros:       registros.length,
    porParte,
    // El tubo, sin repartir. Ya está prorrateado adentro de cada parte
    // (`minutosCompartidos`); acá va el total para poder mostrarlo como lo que es.
    minutosCompartidos: Math.round(minutosCompartidos),
    minutosSinParte: Math.round(minutosSinParte),
    lote,
  });
}
