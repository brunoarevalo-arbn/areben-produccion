-- MO de las piezas falladas en confección (22-nov-2026, Bruno): el lote guarda cuántas falladas
-- contó al repartir sus minutos; esa parte es pérdida y ⛔ la pagan las buenas. Idempotente.
ALTER TABLE "lotes_corte" ADD COLUMN IF NOT EXISTS "unidadesFalladasMo" INTEGER NOT NULL DEFAULT 0;
