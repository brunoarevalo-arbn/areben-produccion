import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getSession } from '@/lib/auth';

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

// Sube una imagen a Vercel Blob y devuelve la URL pública. La usa el drag & drop
// de estampas (y cualquier ImageDrop). El filesystem de Vercel es efímero, por eso
// no se escribe a disco.
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const form = await req.formData();
  const archivo = form.get('archivo');
  if (!(archivo instanceof File)) return NextResponse.json({ error: 'Falta archivo' }, { status: 400 });
  if (!archivo.type.startsWith('image/')) return NextResponse.json({ error: 'El archivo no es una imagen' }, { status: 400 });
  if (archivo.size > MAX_BYTES) return NextResponse.json({ error: 'La imagen supera 6 MB' }, { status: 400 });

  const { url } = await put(`estampas/${archivo.name}`, archivo, { access: 'public', addRandomSuffix: true });
  return NextResponse.json({ url }, { status: 201 });
}
