-- La PARTE de la prenda en el registro de costura, y el catálogo de prendas que
-- se cosen por partes (la bikini: corpiño + bombacha).
--
-- ⛔ NO se aplica con `prisma db push` ni con `migrate dev`. Este repo tiene un
-- DRIFT PREEXISTENTE en `compras_dtf` (dos FK que se dropean y recrean, y un
-- índice que se renombra) y cualquiera de esos dos comandos lo arrastra sin que
-- nadie lo haya pedido. Se verificó con:
--
--   DIRECT_URL=... npx prisma migrate diff --from-config-datasource \
--     --to-schema prisma/schema.prisma --script
--
-- y de esa salida se copió SÓLO lo de abajo. Se aplica con:
--
--   DIRECT_URL="<la url>" npx prisma db execute --file prisma/sql/2026-09-18-parte-y-conjuntos.sql --schema prisma/schema.prisma
--
-- Es idempotente: se puede correr dos veces sin romper nada.

ALTER TABLE "tiempos_produccion" ADD COLUMN IF NOT EXISTS "parte" TEXT;

CREATE TABLE IF NOT EXISTS "conjuntos_prenda" (
    "id" TEXT NOT NULL,
    "prendaAbrev" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conjuntos_prenda_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "partes_prenda" (
    "id" TEXT NOT NULL,
    "conjuntoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partes_prenda_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "conjuntos_prenda_prendaAbrev_key" ON "conjuntos_prenda"("prendaAbrev");
CREATE UNIQUE INDEX IF NOT EXISTS "partes_prenda_conjuntoId_orden_key" ON "partes_prenda"("conjuntoId", "orden");

-- `ADD CONSTRAINT` no acepta IF NOT EXISTS, así que va guardado.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partes_prenda_conjuntoId_fkey') THEN
    ALTER TABLE "partes_prenda"
      ADD CONSTRAINT "partes_prenda_conjuntoId_fkey"
      FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos_prenda"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
