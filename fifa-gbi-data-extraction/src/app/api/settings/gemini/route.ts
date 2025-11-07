import { NextResponse } from 'next/server';

import { mockDb } from '@/lib/mock-db';
import { readActiveProfileSession } from '@/lib/session';

export const runtime = 'nodejs';

export async function GET() {
  const profile = await readActiveProfileSession();
  if (!profile) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const configured = await mockDb.hasProfileGeminiKey(profile.id);
  return NextResponse.json({ configured });
}

export async function POST(request: Request) {
  const profile = await readActiveProfileSession();
  if (!profile) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { apiKey?: string };
  const value = body.apiKey?.trim();
  if (!value) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  await mockDb.setProfileGeminiKey(profile.id, value);
  return NextResponse.json({ configured: true });
}

export async function DELETE() {
  const profile = await readActiveProfileSession();
  if (!profile) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  await mockDb.clearProfileGeminiKey(profile.id);
  return NextResponse.json({ configured: false });
}
