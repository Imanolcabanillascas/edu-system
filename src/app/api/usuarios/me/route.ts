import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json(null, { status: 401 });

  const usuario = await prisma.usuario.findUnique({ where: { id: (session.user as any).id } });
  return NextResponse.json(usuario);
}
