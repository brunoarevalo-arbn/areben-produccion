import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ProyectoView } from '@/components/diseno/ProyectoView';
import type { ProyectoDiseno } from '@/types/diseno';

export const dynamic = 'force-dynamic';

export default async function ProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const raw = await prisma.proyectoDiseno.findUnique({
    where: { id },
    include: {
      pasos: { orderBy: { numeroPaso: 'asc' } },
      iteraciones: {
        include: {
          ajustes: { orderBy: { createdAt: 'asc' } },
          insumos: true,
        },
        orderBy: { version: 'asc' },
      },
      ideas:   { orderBy: { createdAt: 'desc' } },
      insumos: { orderBy: { createdAt: 'asc' } },
      skus:    { orderBy: { codigo: 'asc' } },
    },
  });

  if (!raw) notFound();

  const proyecto: ProyectoDiseno = {
    id:              raw.id,
    nombre:          raw.nombre,
    marca:           raw.marca,
    estado:          (raw.estado as ProyectoDiseno['estado'])          ?? 'activo',
    estadoDiseno:    (raw.estadoDiseno as ProyectoDiseno['estadoDiseno']) ?? 'inspiracion',
    inspiracion:     raw.inspiracion,
    moodboard:       raw.moodboard ? JSON.parse(raw.moodboard) : [],
    molderia:        raw.molderia,
    tela:            raw.tela,
    costo:           raw.costo,
    precioEstimado:  raw.precioEstimado,
    estadoProduccion: raw.estadoProduccion,
    cantidad:        raw.cantidad,
    createdAt:       raw.createdAt.toISOString(),
    updatedAt:       raw.updatedAt.toISOString(),

    pasos: raw.pasos.map((p) => ({
      id:              p.id,
      numeroPaso:      p.numeroPaso,
      nombrePaso:      p.nombrePaso,
      estado:          p.estado,
      saltado:         p.saltado,
      observaciones:   p.observaciones,
      datos:           p.datos,
      fechaInicio:     p.fechaInicio?.toISOString()     ?? null,
      fechaCompletado: p.fechaCompletado?.toISOString() ?? null,
      updatedAt:       p.updatedAt.toISOString(),
    })),

    iteraciones: raw.iteraciones.map((it) => ({
      id:         it.id,
      proyectoId: it.proyectoId,
      version:    it.version,
      tipo:       it.tipo as ProyectoDiseno['iteraciones'][0]['tipo'],
      estado:     it.estado as ProyectoDiseno['iteraciones'][0]['estado'],
      fotos:      it.fotos ? JSON.parse(it.fotos) : [],
      notas:      it.notas,
      createdAt:  it.createdAt.toISOString(),
      updatedAt:  it.updatedAt.toISOString(),
      ajustes: it.ajustes.map((aj) => ({
        id:            aj.id,
        iteracionId:   aj.iteracionId,
        descripcion:   aj.descripcion,
        estado:        aj.estado as ProyectoDiseno['iteraciones'][0]['ajustes'][0]['estado'],
        fechaRealizado: aj.fechaRealizado?.toISOString() ?? null,
        createdAt:     aj.createdAt.toISOString(),
      })),
      insumos: it.insumos.map((ins) => ({
        id:          ins.id,
        iteracionId: ins.iteracionId,
        nombre:      ins.nombre,
        cantidad:    ins.cantidad,
        unidad:      ins.unidad,
        costo:       ins.costo,
        notas:       ins.notas,
      })),
    })),

    ideas: raw.ideas.map((idea) => ({
      id:          idea.id,
      proyectoId:  idea.proyectoId,
      titulo:      idea.titulo,
      descripcion: idea.descripcion,
      foto:        idea.foto,
      etiquetas:   idea.etiquetas ? JSON.parse(idea.etiquetas) : [],
      createdAt:   idea.createdAt.toISOString(),
    })),

    insumos: raw.insumos.map((ins) => ({
      id:            ins.id,
      proyectoId:    ins.proyectoId,
      nombre:        ins.nombre,
      tipo:          ins.tipo,
      proveedor:     ins.proveedor,
      unidad:        ins.unidad,
      cantidad:      ins.cantidad,
      costoUnitario: ins.costoUnitario,
      notas:         ins.notas,
      createdAt:     ins.createdAt.toISOString(),
      updatedAt:     ins.updatedAt.toISOString(),
    })),

    skus: raw.skus.map((s) => ({
      id:         s.id,
      proyectoId: s.proyectoId,
      codigo:     s.codigo,
      talle:      s.talle,
      color:      s.color,
      cantidad:   s.cantidad,
      notas:      s.notas,
      createdAt:  s.createdAt.toISOString(),
      updatedAt:  s.updatedAt.toISOString(),
    })),
  };

  return (
    <div className="min-h-screen">
      {/* Breadcrumb */}
      <div className="px-6 pt-5 pb-3 border-b border-stone-100 bg-white">
        <div className="flex items-center gap-2 text-sm text-stone-400">
          <Link href="/diseno" className="hover:text-stone-600 transition">Diseño</Link>
          <span>/</span>
          <span className="text-stone-700 font-medium">{raw.nombre}</span>
        </div>
      </div>

      <ProyectoView proyecto={proyecto} />
    </div>
  );
}
