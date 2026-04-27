// app/api/tiempos/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { TiempoSchema } from '@/lib/validators/tiempos';
import { ZodError } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const usuario = searchParams.get('usuario');
    const fecha = searchParams.get('fecha');

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario requerido' }, { status: 400 });
    }

    // Por ahora retorna array vacío (sin DB)
    // Cuando conectemos Supabase, aquí haremos la query
    const tiempos = [];

    return NextResponse.json(tiempos);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error fetching tiempos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = TiempoSchema.parse(body);

    // Por ahora solo validamos y retornamos
    // Cuando conectemos Supabase, aquí guardamos en DB
    const tiempo = {
      id: `tiempo-${Date.now()}`,
      ...validated,
    };

    return NextResponse.json(tiempo, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error creating tiempo' }, { status: 500 });
  }
}
