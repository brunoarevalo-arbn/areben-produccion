-- Fallas de cualquier OP, separada o no (8-oct-2026, 2ª parte). Idempotente.
-- La falla pasa a colgar de la ORDEN; el lote queda opcional (null = orden sin separar).
ALTER TABLE "fallas_lote" ADD COLUMN IF NOT EXISTS "ordenId" TEXT;
UPDATE "fallas_lote" f SET "ordenId" = lp."ordenId"
  FROM "lotes_planificados" lp WHERE lp."id" = f."loteId" AND f."ordenId" IS NULL;
ALTER TABLE "fallas_lote" ALTER COLUMN "ordenId" SET NOT NULL;
ALTER TABLE "fallas_lote" ALTER COLUMN "loteId" DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fallas_lote_ordenId_fkey') THEN
    ALTER TABLE "fallas_lote" ADD CONSTRAINT "fallas_lote_ordenId_fkey"
      FOREIGN KEY ("ordenId") REFERENCES "ordenes_produccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "fallas_lote_ordenId_idx" ON "fallas_lote"("ordenId");
