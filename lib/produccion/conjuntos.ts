// Las prendas que se COSEN por partes (la bikini: corpiño + bombacha).
//
// 🔑 Un solo dueño de la lectura del SKU. La abreviatura de prenda es el 2º
// segmento (`MARCA-PRENDA-COLOR-NNNN`, ver AGENTS.md), y eso se lee acá y en
// ningún otro lado: si mañana cambia la convención, cambia un archivo.
//
// ⚠️ Se lee por POSICIÓN, y un SKU que no siga el formato devuelve el segmento
// equivocado SIN AVISAR (no devuelve null). Por eso esto nunca decide solo: lo
// que devuelve se busca en `ConjuntoPrenda`, que es una lista blanca de tres o
// cuatro filas. Un segmento mal leído no matchea, la orden queda sin partes y la
// tablet se comporta igual que siempre. **Falla cerrado.**
//
// ⚠️ Y se deriva SIEMPRE del SKU, nunca de `LoteProduccion.prenda`: ese campo
// admite un override manual (`api/produccion/lote/agrupar`), así que el mismo
// molde puede estar guardado ahí como otra cosa. Dos verdades, una sola correcta.

import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type Db = PrismaClient | Prisma.TransactionClient;

/** Mínimo de segmentos para creerle a la posición: MARCA-PRENDA-COLOR. */
const SEGMENTOS_MINIMOS = 3;

// ⚠️ `PARTE_COMPARTIDA` y `MAQUINA_COMPARTIDA` viven en `lib/constants/partes.ts`,
// NO acá: este archivo importa `prisma` y la tablet es un componente de cliente.

/**
 * El 2º segmento del SKU, en mayúsculas. `null` si el SKU falta o es más corto
 * que la convención — preferimos no saber antes que leer el segmento de al lado.
 */
export function prendaAbrevDeSku(sku: string | null | undefined): string | null {
  if (!sku) return null;
  const partes = sku.split('-');
  if (partes.length < SEGMENTOS_MINIMOS) return null;
  const abrev = partes[1]?.trim().toUpperCase();
  return abrev ? abrev : null;
}

export interface ParteDePrenda {
  nombre: string;
  /** 2º segmento del SKU de la pieza ("COR"). `null` = todavía no puede ir a stock sola. */
  skuAbrev: string | null;
  /** Qué % del material del corte se lleva. `null` = nadie lo declaró. */
  porcentajeMaterial: number | null;
}

export interface ConjuntoConPartes {
  prendaAbrev: string;
  nombre: string;
  partes: ParteDePrenda[];
}

/**
 * El SKU de una pieza: el de la orden con el 2º segmento reemplazado
 * (`ZAT-BIK-VER-001` + `COR` → `ZAT-COR-VER-001`).
 *
 * 🔴 Devuelve `null` si el SKU de la orden no sigue la convención o si la parte no tiene
 * abreviatura, y quien llame se tiene que plantar. Componer un SKU a medias acá dejaría
 * mercadería ingresada a un código que no existe en ningún lado, y el stock no avisa:
 * `stockTerminado.upsert` crea la fila que le pidan. Falla cerrado.
 */
export function skuDeParte(skuOrden: string | null | undefined, skuAbrev: string | null): string | null {
  if (!skuOrden || !skuAbrev?.trim()) return null;
  const segmentos = skuOrden.trim().split('-');
  if (segmentos.length < SEGMENTOS_MINIMOS) return null;
  segmentos[1] = skuAbrev.trim().toUpperCase();
  return segmentos.join('-');
}

/**
 * Los conjuntos activos, indexados por abreviatura. Son pocas filas: se trae la
 * tabla entera y se resuelve en memoria en vez de una consulta por orden.
 */
export async function conjuntosActivos(): Promise<Map<string, ConjuntoConPartes>> {
  const filas = await prisma.conjuntoPrenda.findMany({
    where: { activo: true },
    include: { partes: { orderBy: { orden: 'asc' } } },
  });

  return new Map(
    filas
      // Un conjunto sin partes cargadas no puede ofrecer nada: se ignora en vez
      // de mostrarle a la costurera un selector vacío.
      .filter((c) => c.partes.length > 0)
      .map((c) => [
        c.prendaAbrev.toUpperCase(),
        {
          prendaAbrev: c.prendaAbrev,
          nombre: c.nombre,
          partes: c.partes.map((p) => ({
            nombre: p.nombre,
            skuAbrev: p.skuAbrev,
            porcentajeMaterial: p.porcentajeMaterial == null ? null : Number(p.porcentajeMaterial),
          })),
        },
      ]),
  );
}

/** Las partes que le corresponden a un SKU, o `[]` si no es una prenda por partes. */
export function partesDeSku(
  sku: string | null | undefined,
  conjuntos: Map<string, ConjuntoConPartes>,
): ParteDePrenda[] {
  const abrev = prendaAbrevDeSku(sku);
  if (!abrev) return [];
  return conjuntos.get(abrev)?.partes ?? [];
}

/** Sólo los nombres — lo que la tablet le muestra a la costurera. */
export function nombresDePartes(partes: ParteDePrenda[]): string[] {
  return partes.map((p) => p.nombre);
}

/**
 * Las partes de una orden, leídas dentro de una transacción (la tablet usa el mapa
 * cacheado; el ingreso de un lote necesita el dato fresco y en la misma tx).
 */
export async function partesDeOrden(db: Db, sku: string | null | undefined): Promise<ParteDePrenda[]> {
  const abrev = prendaAbrevDeSku(sku);
  if (!abrev) return [];
  const conjunto = await db.conjuntoPrenda.findUnique({
    where: { prendaAbrev: abrev },
    include: { partes: { orderBy: { orden: 'asc' } } },
  });

  if (!conjunto || !conjunto.activo) return [];
  return conjunto.partes.map((p) => ({
    nombre: p.nombre,
    skuAbrev: p.skuAbrev,
    porcentajeMaterial: p.porcentajeMaterial == null ? null : Number(p.porcentajeMaterial),
  }));
}
