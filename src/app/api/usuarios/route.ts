import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getAdmin(userId: string) {
  return prisma.usuario.findFirst({ where: { clerkId: userId, rol: "ADMIN" } });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuarios = await prisma.usuario.findMany({
    orderBy: { createdAt: "desc" },
    include: { profesor: true, alumno: true },
  });
  return NextResponse.json(usuarios);
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = await getAdmin(userId);
  if (!admin) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id, rol } = await req.json();
  const usuario = await prisma.usuario.update({ where: { id }, data: { rol } });
  return NextResponse.json(usuario);
}
