-- La solicitud de corrección también puede cambiar la PIEZA de la bikini (16-oct-2026, Bruno).
-- Idempotente. Sólo agrega columnas vacías: no toca datos.
-- `parteNueva` NULL = la pieza no se cambia; '' = sacarle la pieza (el SKU nuevo no se parte).
ALTER TABLE "solicitudes_cambio_tiempo" ADD COLUMN IF NOT EXISTS "parteAnterior" TEXT;
ALTER TABLE "solicitudes_cambio_tiempo" ADD COLUMN IF NOT EXISTS "parteNueva" TEXT;
