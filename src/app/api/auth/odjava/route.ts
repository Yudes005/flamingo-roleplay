import { NextResponse, type NextRequest } from 'next/server';
import { obrisiSesiju } from '@/lib/session';
import { adresaSajta } from '@/config/site';

export async function POST(req: NextRequest) {
  await obrisiSesiju();
  void req;
  const base = adresaSajta();
  return NextResponse.redirect(`${base}/`, { status: 303 });
}
