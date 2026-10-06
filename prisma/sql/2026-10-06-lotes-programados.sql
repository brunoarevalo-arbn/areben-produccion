-- Lotes planificados PROGRAMADOS y "en el taller". Ver PENDIENTES.md (6-oct-2026) y
-- lib/produccion/lotesPlanificados.ts.
--
--  - "activadoAt": NULL = la separación está PROGRAMADA y espera que la costurera confirme
--    en la tablet que terminó el proceso (p. ej. el remallado). Hasta entonces la orden es
--    un solo lote para la tablet, y todo lo cosido queda en la bolsa común.
--  - "enTaller": qué lotes tiene la costurera en la mesa. La tablet asigna sola el lote más
--    chico de los que están en el taller.
--
-- ⛔ NO usar `prisma db push` en este repo (drift preexistente en `compras_dtf`).
--
--   npx prisma db execute --file prisma/sql/2026-10-06-lotes-programados.sql

-- 🔴 La carga de los lotes que YA existen (separados a mano, activos desde que se
-- separaron) va DENTRO del mismo guard que agrega la columna: correr el archivo dos veces
-- no puede activar una separación que alguien programó en el medio.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lotes_planificados' AND column_name = 'activadoAt'
  ) THEN
    ALTER TABLE "lotes_planificados" ADD COLUMN "activadoAt" TIMESTAMP(3);
    UPDATE "lotes_planificados" SET "activadoAt" = "separadoAt";
  END IF;
END $$;

ALTER TABLE "lotes_planificados" ADD COLUMN IF NOT EXISTS "enTaller" BOOLEAN NOT NULL DEFAULT true;
