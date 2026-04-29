import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const form       = await req.formData();
    const archivo    = form.get('archivo') as File | null;
    const productoId = form.get('productoId') as string | null;

    if (!archivo || !productoId) {
      return NextResponse.json({ error: 'Faltan archivo o productoId' }, { status: 400 });
    }

    const bytes  = await archivo.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext      = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const nombre   = `${productoId}-${Date.now()}.${ext}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads');

    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, nombre), buffer);

    const foto = await prisma.foto.create({
      data: {
        url:       `/uploads/${nombre}`,
        nombre:    archivo.name,
        productoId,
      },
    });

    return NextResponse.json(foto, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error subiendo foto' }, { status: 500 });
  }
}
