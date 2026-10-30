// La NYA FLOVIO no salía en la tablet aunque el Lote 1 estaba visible (👁): el 21-oct se
// programó un Lote 2 y se deshizo a los 3 minutos, y deshacer dejaba el Lote 1 con
// `activadoAt` en null (nació esperando la separación). Desde el 30-oct `deshacerLote` lo
// activa solo; esto arregla la orden que ya había quedado trabada.
//   npx tsx --env-file=.env prisma/activar-lote1-flovio-30oct.ts
import { prisma } from '@/lib/prisma';

(async () => {
  const orden = await prisma.ordenProduccion.findFirstOrThrow({ where: { sku: 'ZAT-BIK-FLOVIO-001' } });
  const bruno = await prisma.usuario.findFirstOrThrow({ where: { nombre: 'Bruno Arevalo' }, select: { id: true } });
  await prisma.$transaction(async (tx) => {
    const r = await tx.lotePlanificado.updateMany({
      where: { ordenId: orden.id, numero: 1, activadoAt: null }, data: { activadoAt: new Date() },
    });
    if (r.count !== 1) throw new Error(`Esperaba 1 lote sin activar y hay ${r.count}: no toco nada`);
    await tx.estadoTransicion.create({
      data: {
        ordenId: orden.id, estadoAnterior: orden.estado, estadoNuevo: orden.estado, usuarioId: bruno.id,
        notas: 'Lote 1 activado: quedó sin activar al deshacer el Lote 2 programado (21-oct) y no salía en la tablet.',
      },
    });
  });
  console.log('Listo: el Lote 1 de la FLOVIO ya sale en la tablet.');
  await prisma.$disconnect();
})();
