import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(req: NextRequest) {
  try {
    const form    = await req.formData();
    const archivo = form.get('archivo') as File | null;

    if (!archivo) {
      return NextResponse.json({ error: 'Falta archivo' }, { status: 400 });
    }

    const bytes     = await archivo.arrayBuffer();
    const buffer    = Buffer.from(bytes);
    const ext       = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const nombre    = `img-${Date.now()}.${ext}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads');

    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, nombre), buffer);

    return NextResponse.json({ url: `/uploads/${nombre}` }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error subiendo imagen' }, { status: 500 });
  }
}
