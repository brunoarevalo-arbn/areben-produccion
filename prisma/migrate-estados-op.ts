import 'dotenv/config';
import pg from 'pg';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL no definida');

const client = new pg.Client({ connectionString: url });

const ESTADO_MAP: Record<string, string> = {
  pendiente: 'PENDIENTE',
  en_produccion: 'COSTURA',
  terminado: 'CERRADA',
};

async function migrate() {
  await client.connect();

  // 1. Crear el enum si no existe
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "EstadoOP" AS ENUM (
        'PENDIENTE', 'CORTE', 'COSTURA', 'TERMINADO_SIN_ESTAMPA',
        'ESTAMPA', 'CONTROL_CALIDAD', 'CERRADA'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  console.log('Enum EstadoOP creado (o ya existia)');

  // 2. Leer OPs con estado string viejo
  const { rows: ops } = await client.query(
    `SELECT id, estado FROM ordenes_produccion WHERE estado IN ('pendiente', 'en_produccion', 'terminado')`
  );
  console.log(`OPs a migrar: ${ops.length}`);

  if (ops.length > 0) {
    // 3. Agregar columna temporal
    await client.query(`ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS estado_new text`);

    // 4. Mapear estados
    for (const op of ops) {
      const nuevoEstado = ESTADO_MAP[op.estado] || 'PENDIENTE';
      await client.query(
        `UPDATE ordenes_produccion SET estado_new = $1 WHERE id = $2`,
        [nuevoEstado, op.id]
      );
    }

    // 5. Drop columna vieja, renombrar nueva, aplicar tipo enum
    await client.query(`ALTER TABLE ordenes_produccion DROP COLUMN estado`);
    await client.query(`ALTER TABLE ordenes_produccion RENAME COLUMN estado_new TO estado`);
    await client.query(`ALTER TABLE ordenes_produccion ALTER COLUMN estado DROP DEFAULT`);
    await client.query(`ALTER TABLE ordenes_produccion ALTER COLUMN estado SET NOT NULL`);
    await client.query(`ALTER TABLE ordenes_produccion ALTER COLUMN estado TYPE "EstadoOP" USING estado::"EstadoOP"`);
    await client.query(`ALTER TABLE ordenes_produccion ALTER COLUMN estado SET DEFAULT 'PENDIENTE'::"EstadoOP"`);

    console.log('Columna estado migrada a EstadoOP');
  }

  // 6. Crear tabla estado_transiciones si no existe (prisma db push la creara despues,
  //    pero necesitamos insertar transiciones iniciales)
  await client.query(`
    CREATE TABLE IF NOT EXISTS estado_transiciones (
      id text PRIMARY KEY,
      "ordenId" text NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
      "estadoAnterior" "EstadoOP",
      "estadoNuevo" "EstadoOP" NOT NULL,
      fecha timestamp(3) NOT NULL DEFAULT now(),
      "usuarioId" text NOT NULL,
      notas text
    )
  `);

  // 7. Crear transicion inicial por cada OP migrada
  for (const op of ops) {
    const nuevoEstado = ESTADO_MAP[op.estado] || 'PENDIENTE';
    const id = `mig_${op.id.slice(0, 20)}`;
    await client.query(
      `INSERT INTO estado_transiciones (id, "ordenId", "estadoAnterior", "estadoNuevo", "usuarioId", notas)
       VALUES ($1, $2, NULL, $3, 'migration', 'Migración automática de estados')
       ON CONFLICT (id) DO NOTHING`,
      [id, op.id, nuevoEstado]
    );
  }
  console.log(`${ops.length} transiciones iniciales creadas`);

  await client.end();
  console.log('Migracion completada');
}

migrate().catch((e) => { console.error(e); process.exit(1); });
