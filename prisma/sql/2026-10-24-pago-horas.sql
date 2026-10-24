-- Pago de horas de costureras. Sólo CREA tablas nuevas (idempotente).
CREATE TABLE IF NOT EXISTS "config_pago_horas" (
  "id" TEXT PRIMARY KEY, "usuarioId" TEXT NOT NULL UNIQUE,
  "jornadaMin" INTEGER NOT NULL DEFAULT 540, "toleranciaMin" INTEGER NOT NULL DEFAULT 29,
  "fraccionMin" INTEGER NOT NULL DEFAULT 30, "redondeo" TEXT NOT NULL DEFAULT 'CERCANO',
  "descuentaPausas" BOOLEAN NOT NULL DEFAULT true, "recargoExtraPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "periodo" TEXT NOT NULL DEFAULT 'QUINCENAL', "anclaPeriodo" TEXT,
  "diasSemana" INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5], "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "tarifas_hora" (
  "id" TEXT PRIMARY KEY, "usuarioId" TEXT NOT NULL, "desde" TEXT NOT NULL, "montoHora" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE ("usuarioId","desde"));
CREATE TABLE IF NOT EXISTS "ajustes_horas_dia" (
  "id" TEXT PRIMARY KEY, "usuarioId" TEXT NOT NULL, "fecha" TEXT NOT NULL, "minutos" INTEGER NOT NULL, "nota" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE ("usuarioId","fecha"));
CREATE TABLE IF NOT EXISTS "liquidaciones_horas" (
  "id" TEXT PRIMARY KEY, "usuarioId" TEXT NOT NULL, "desde" TEXT NOT NULL, "hasta" TEXT NOT NULL,
  "totalMin" INTEGER NOT NULL, "totalMonto" DOUBLE PRECISION NOT NULL, "detalle" JSONB NOT NULL, "pagadoEl" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE ("usuarioId","desde","hasta"));
