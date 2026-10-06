-- Lotes PLANIFICADOS: separar un corte en "Lote 1 / Lote 2" ANTES de ingresarlo, para
-- etiquetar las bolsas y que la tablet marque a qué lote van los minutos. Ver PENDIENTES.md
-- (6-oct-2026) y lib/produccion/lotesPlanificados.ts.
--
-- ⚠️ NO es `lotes_corte`: un LoteCorte es lo que YA ENTRÓ al stock con su costo congelado.
-- Un lote planificado es la bolsa de producción que existe desde que se separa.
--
-- ⛔ NO usar `prisma db push` en este repo: hay drift preexistente en `compras_dtf`
-- (dos FK que se dropean y recrean + un índice que se renombra) y un push se lo
-- llevaría puesto de arrastre. Este archivo tiene SÓLO lo de los lotes planificados.
--
--   npx prisma db execute --file prisma/sql/2026-10-06-lotes-planificados.sql

CREATE TABLE IF NOT EXISTS "lotes_planificados" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "despuesDe" TEXT NOT NULL,
    "separadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "separadoPor" TEXT NOT NULL,

    CONSTRAINT "lotes_planificados_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "lotes_planificados_talles" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "talle" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "lotes_planificados_talles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lotes_planificados_ordenId_numero_key" ON "lotes_planificados"("ordenId", "numero");
CREATE UNIQUE INDEX IF NOT EXISTS "lotes_planificados_talles_loteId_talle_key" ON "lotes_planificados_talles"("loteId", "talle");

DO $$ BEGIN
  ALTER TABLE "lotes_planificados" ADD CONSTRAINT "lotes_planificados_ordenId_fkey"
    FOREIGN KEY ("ordenId") REFERENCES "ordenes_produccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "lotes_planificados_talles" ADD CONSTRAINT "lotes_planificados_talles_loteId_fkey"
    FOREIGN KEY ("loteId") REFERENCES "lotes_planificados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A qué lote planificado fue un registro de la tablet. NULL = sin lote: todo lo anterior a
-- la separación, y lo de las órdenes que nunca se separaron (casi todas).
ALTER TABLE "tiempos_produccion" ADD COLUMN IF NOT EXISTS "lote" INTEGER;

-- De qué lote planificado salió un ingreso, y cuántos de sus minutos vinieron de la bolsa
-- común (los registros sin lote, repartidos por unidades).
ALTER TABLE "lotes_corte" ADD COLUMN IF NOT EXISTS "lotePlanificadoId" TEXT;
ALTER TABLE "lotes_corte" ADD COLUMN IF NOT EXISTS "minutosComunes" DECIMAL(65,30) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "lotes_corte_lotePlanificadoId_idx" ON "lotes_corte"("lotePlanificadoId");

DO $$ BEGIN
  ALTER TABLE "lotes_corte" ADD CONSTRAINT "lotes_corte_lotePlanificadoId_fkey"
    FOREIGN KEY ("lotePlanificadoId") REFERENCES "lotes_planificados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
