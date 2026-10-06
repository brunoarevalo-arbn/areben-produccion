-- Orden EN ESPERA: se saca del taller sin terminar porque falta algo (p. ej. el dije) y
-- se guarda para cerrar después. Sale de la tablet hasta que alguien la retoma; la cola la
-- muestra con el motivo. Ver PENDIENTES.md (6-oct-2026).
--
-- ⛔ NO usar `prisma db push` en este repo (drift preexistente en `compras_dtf`).
--
--   npx prisma db execute --file prisma/sql/2026-10-06-orden-en-espera.sql

ALTER TABLE "ordenes_produccion" ADD COLUMN IF NOT EXISTS "enEsperaDesde" TIMESTAMP(3);
ALTER TABLE "ordenes_produccion" ADD COLUMN IF NOT EXISTS "enEsperaMotivo" TEXT;
ALTER TABLE "ordenes_produccion" ADD COLUMN IF NOT EXISTS "enEsperaPor" TEXT;
