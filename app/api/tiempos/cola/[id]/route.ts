import { NextRequest, NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(_req: NextRequest, { params: _params }: Ctx) {
  return NextResponse.json(
    { error: 'Cambio de estado migrado a /api/produccion/cola/[id]/estado' },
    { status: 410 }
  );
}
