import { NextResponse, type NextRequest } from 'next/server';
import { obrisiSesiju } from '@/lib/session';

export async function POST(req: NextRequest) {
  await obrisiSesiju();
  const base = (process.env.SITE_URL || req.nextUrl.origin).replace(/\/+$/, '');
  return NextResponse.redirect(`${base}/`, { status: 303 });
}
