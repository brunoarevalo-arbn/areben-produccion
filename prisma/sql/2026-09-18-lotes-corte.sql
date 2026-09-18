-- Fase 1 del producir por LOTE: la fracción de un corte que entra terminada, con su
-- costo congelado. Ver PENDIENTES.md (18-sep-2026) y lib/produccion/loteCorte.ts.
--
-- ⛔ NO usar `prisma db push` en este repo: hay drift preexistente en `compras_dtf`
-- (dos FK que se dropean y recrean + un índice que se renombra) y un push se lo
-- llevaría puesto de arrastre. Este archivo tiene SÓLO lo de los lotes.
--
--   npx prisma db execute --file prisma/sql/2026-09-18-lotes-corte.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "lotes_corte" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "unidades" INTEGER NOT NULL,
    "ingresadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingresadoPor" TEXT NOT NULL,
    "costoMaterialUnit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoMoUnit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minutosImputados" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costoMinuto" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sinCostoMaterial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_corte_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "lotes_corte_talles" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "talle" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "lotes_corte_talles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lotes_corte_ordenId_idx" ON "lotes_corte"("ordenId");
CREATE UNIQUE INDEX IF NOT EXISTS "lotes_corte_ordenId_numero_key" ON "lotes_corte"("ordenId", "numero");
CREATE UNIQUE INDEX IF NOT EXISTS "lotes_corte_talles_loteId_talle_key" ON "lotes_corte_talles"("loteId", "talle");

-- Las FK van con guard: `ADD CONSTRAINT` no acepta IF NOT EXISTS, así que correr el
-- archivo dos veces fallaría sin esto.
DO $$ BEGIN
  ALTER TABLE "lotes_corte" ADD CONSTRAINT "lotes_corte_ordenId_fkey"
    FOREIGN KEY ("ordenId") REFERENCES "ordenes_produccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "lotes_corte_talles" ADD CONSTRAINT "lotes_corte_talles_loteId_fkey"
    FOREIGN KEY ("loteId") REFERENCES "lotes_corte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sobre qué se repartió el material. Va guardado porque el costo está CONGELADO: si el
-- denominador fue lo planificado (orden sin corte cargado), el unitario puede estar lejos
-- del real y hay que poder encontrar esos lotes después. `cantidadCortada()` cae a lo
-- planificado sin decirlo, así que el número solo no alcanza.
ALTER TABLE "lotes_corte" ADD COLUMN IF NOT EXISTS "unidadesBase" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lotes_corte" ADD COLUMN IF NOT EXISTS "baseMaterial" TEXT NOT NULL DEFAULT 'planificado';
