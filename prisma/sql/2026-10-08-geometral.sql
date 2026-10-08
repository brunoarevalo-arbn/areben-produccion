-- Geometral (el dibujo técnico) para reconocer cada color y su bolsa (8-oct-2026). Idempotente.
-- Va en la ORDEN (un color) y en el LoteProduccion (el modelo): si un color no tiene el suyo,
-- se muestra el del modelo marcado como tal. Sólo agrega columnas vacías: no toca datos.
ALTER TABLE "ordenes_produccion" ADD COLUMN IF NOT EXISTS "geometralUrl" TEXT;
ALTER TABLE "lotes_produccion" ADD COLUMN IF NOT EXISTS "geometralUrl" TEXT;
