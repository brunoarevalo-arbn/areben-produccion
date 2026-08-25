import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { calcularEstado } from '@/lib/diseno/estado';
import { ProyectoView } from '@/components/diseno/ProyectoView';
import { volverASeguro } from '@/lib/volverA';

export const dynamic = 'force-dynamic';

export default async function ProyectoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volverA?: string }> }) {
  const { id } = await params;
  const volver = volverASeguro((await searchParams).volverA, '/diseno');
  const [proyecto, catalogoFases] = await Promise.all([
    prisma.proyectoDiseno.findUnique({
      where: { id },
      include: {
        iteraciones: { orderBy: { version: 'asc' } },
        fases:       { include: { fase: true }, orderBy: { fase: { orden: 'asc' } } },
      },
    }),
    prisma.faseCatalogo.findMany({ where: { activo: true }, orderBy: { orden: 'asc' } }),
  ]);

  if (!proyecto) notFound();

  const estado = calcularEstado(proyecto);

  return (
    <ProyectoView
      volver={volver}
      proyecto={{
        id:          proyecto.id,
        nombre:      proyecto.nombre,
        marca:       proyecto.marca,
        inspiracion: proyecto.inspiracion,
        moodboard:   proyecto.moodboard,
        molderia:    proyecto.molderia,
        tela:        proyecto.tela,
        archivado:   proyecto.archivado,
        fechaObjetivo: proyecto.fechaObjetivo?.toISOString() ?? null,
        iteraciones: proyecto.iteraciones.map((it) => ({
          id:              it.id,
          version:         it.version,
          estado:          it.estado,
          fotos:           it.fotos ? (JSON.parse(it.fotos) as string[]) : [],
          notas:           it.notas,
          ajustesMolderia: it.ajustesMolderia,
          createdAt:       it.createdAt.toISOString(),
        })),
        fases: proyecto.fases.map((f) => ({
          id:              f.id,
          faseId:          f.faseId,
          nombre:          f.fase.nombre,
          orden:           f.fase.orden,
          estado:          f.estado,
          responsable:     f.responsable,
          externo:         f.externo,
          seguidorInterno: f.seguidorInterno,
          fechaInicio:     f.fechaInicio?.toISOString() ?? null,
          fechaFin:        f.fechaFin?.toISOString() ?? null,
          notas:           f.notas,
        })),
      }}
      catalogoFases={catalogoFases.map((c) => ({ id: c.id, nombre: c.nombre, orden: c.orden }))}
      estadoActual={estado}
    />
  );
}
