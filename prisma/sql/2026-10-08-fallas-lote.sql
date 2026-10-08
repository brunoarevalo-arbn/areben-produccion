-- Fallas de un lote planificado (8-oct-2026). Idempotente.
-- Un lote con fallas ⛔ se deshace (lo frena deshacerLote); borrar la OP entera sí se las lleva.
CREATE TABLE IF NOT EXISTS "fallas_lote" (
  "id"            TEXT PRIMARY KEY,
  "loteId"        TEXT NOT NULL REFERENCES "lotes_planificados"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "parte"         TEXT,
  "talle"         TEXT NOT NULL,
  "cantidad"      INTEGER NOT NULL CHECK ("cantidad" > 0),
  "proceso"       TEXT NOT NULL,
  "motivo"        TEXT,
  "registradoPor" TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "fallas_lote_loteId_idx" ON "fallas_lote"("loteId");
