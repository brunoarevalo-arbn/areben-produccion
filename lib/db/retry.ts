import { Prisma } from '@prisma/client';

// Reintenta una operación que puede chocar con un índice único cuando dos requests
// generan el mismo valor "leyendo el máximo y sumando uno" sin lock (SKU de OP,
// código de rollo/lote). Ante P2002 (unique constraint), reintenta regenerando el
// número; cualquier otro error se propaga. Cubre la race sin necesidad de locks.
export async function retryOnUniqueConflict<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
