import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

const PAD = 3;

// Próximo número libre para un prefijo de SKU (ej. "ZAT-TOP-NG-"), mirando las OP
// existentes que ya empiezan con ese prefijo. Sirve tanto fuera como dentro de una
// transacción (pasarle el `tx`).
export async function siguienteNumeroSku(db: Db, prefijo: string): Promise<number> {
  const existentes = await db.ordenProduccion.findMany({
    where:  { sku: { startsWith: prefijo } },
    select: { sku: true },
  });
  let maxN = 0;
  for (const { sku } of existentes) {
    if (!sku) continue;
    const n = parseInt(sku.slice(prefijo.length), 10);
    if (!isNaN(n) && n > maxN) maxN = n;
  }
  return maxN + 1;
}

export function formatSku(prefijo: string, numero: number, pad = PAD): string {
  return prefijo + String(numero).padStart(Math.max(pad, String(numero).length), '0');
}
