-- Un corte de conjunto produce DOS artículos: el lote entra POR PARTE.
--
-- La bikini se tiza junta (corpiño + bombacha, 6 por espacio) y se vende por pieza.
-- Hasta acá una OP tenía un solo SKU y el lote que entraba iba entero a ese SKU. Ahora
-- un ingreso crea UN LoteCorte POR PARTE, cada uno con su propio SKU de pieza, sus
-- talles y su costo congelado — porque el corpiño y la bombacha no cuestan lo mismo y
-- no salen necesariamente en la misma cantidad (40 corpiños y 39 bombachas se tiene
-- que poder decir).
--
-- 🔴 NO aplicar con `db push`: hay drift preexistente en `compras_dtf` que se
-- arrastraría solo. Esto va con `psql` o `prisma db execute --file`.
--
-- Idempotente: se puede correr dos veces.
--
--   npx prisma db execute --file prisma/sql/2026-09-18-lote-por-parte.sql --schema prisma/schema.prisma

BEGIN;

-- ---------------------------------------------------------------- partes_prenda
-- `skuAbrev`: el 2º segmento del SKU de la pieza (ZAT-BIK-VER-001 → ZAT-COR-VER-001).
-- Va GUARDADO por parte y no derivado del nombre: "Corpiño" → "COR" sería una regla
-- que se rompe con la primera parte que no empiece igual, y en silencio.
ALTER TABLE partes_prenda ADD COLUMN IF NOT EXISTS "skuAbrev" text;

-- Qué porcentaje del material del corte se lleva esta parte. NULL = NADIE LO DIJO, y
-- eso planta el ingreso cuando hay material que repartir. Es a propósito: no hay dato
-- medido (molderia_catalogo tiene "bikini triangulito" como UN molde, sin área por
-- pieza), así que el número tiene que venir de una persona — y mientras no venga, el
-- sistema no inventa un 50/50 que después se lee como si lo hubiera medido alguien.
ALTER TABLE partes_prenda ADD COLUMN IF NOT EXISTS "porcentajeMaterial" DECIMAL(5,2);

-- ------------------------------------------------------------------- lotes_corte
-- La parte que entró en este lote. NULL = la prenda no se parte (todo lo anterior).
ALTER TABLE lotes_corte ADD COLUMN IF NOT EXISTS "parte" text;

-- El SKU que efectivamente fue al stock. GUARDADO, no derivado: se deriva una vez al
-- ingresar y se congela junto al costo. Si mañana cambia la convención del SKU o la
-- abreviatura de la parte, lo que entró sigue diciendo a dónde entró.
ALTER TABLE lotes_corte ADD COLUMN IF NOT EXISTS "sku" text;

-- De los `minutosImputados`, cuántos NO tenían pieza y entraron por el reparto mitad y
-- mitad (los 'Compartido' y los que la tablet dejó sin etiquetar). Sin esto el costo de
-- MO de una pieza no se puede explicar: no se sabe qué parte de él fue medido.
ALTER TABLE lotes_corte ADD COLUMN IF NOT EXISTS "minutosCompartidos" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- Los lotes que ya existían son de órdenes sin partes: su SKU es el de la orden.
UPDATE lotes_corte l
   SET sku = o.sku
  FROM ordenes_produccion o
 WHERE o.id = l."ordenId"
   AND l.sku IS NULL;

-- El único por orden pasa a ser (orden, numero, parte): un mismo ingreso deja un lote
-- por parte y los dos comparten `numero` ("Lote 1 · Corpiño" y "Lote 1 · Bombacha").
--
-- ⚠️ En un UNIQUE de Postgres dos NULL son DISTINTOS entre sí, así que sobre las órdenes
-- sin partes (parte = NULL, que son todas las de hoy) un unique común no defiende nada:
-- la misma orden podría recibir dos veces el lote 1 sin que nada se queje, y ése es
-- justo el caso que este índice existe para atajar. Por eso va NULLS NOT DISTINCT.
-- Existe desde PG 15; si la base es más vieja se crea el unique común y se avisa, en vez
-- de que la migración entera se plante.
ALTER TABLE lotes_corte DROP CONSTRAINT IF EXISTS "lotes_corte_ordenId_numero_key";
DROP INDEX IF EXISTS "lotes_corte_ordenId_numero_key";
DO $$ BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS "lotes_corte_orden_numero_parte_key"
        ON lotes_corte ("ordenId", "numero", "parte") NULLS NOT DISTINCT;
  EXCEPTION WHEN syntax_error THEN
    RAISE NOTICE 'Postgres < 15: el unico va sin NULLS NOT DISTINCT (dos lotes sin parte con el mismo numero no quedan atajados por la base)';
    CREATE UNIQUE INDEX IF NOT EXISTS "lotes_corte_orden_numero_parte_key"
        ON lotes_corte ("ordenId", "numero", "parte");
  END;
END $$;

COMMIT;
