-- Avíos al costo del lote y avío en UNA sola pieza (19-oct-2026, Bruno).
-- Idempotente. Sólo agrega columnas: no toca datos.
-- `etiqueta_catalogo.parte` NULL = va en todas las piezas (como hasta hoy).
-- `lotes_corte.costoAviosUnit` 0 en los lotes ya ingresados: entraron sin avíos y quedan así.
ALTER TABLE "etiqueta_catalogo" ADD COLUMN IF NOT EXISTS "parte" TEXT;
ALTER TABLE "lotes_corte" ADD COLUMN IF NOT EXISTS "costoAviosUnit" DECIMAL(65,30) NOT NULL DEFAULT 0;
