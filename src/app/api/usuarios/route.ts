import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  const usuarios = await prisma.usuario.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, nombre: true, rol: true, createdAt: true,
      profesor: { select: { id: true, dni: true } },
      alumno: { select: { id: true, dni: true } },
    },
  });
  return NextResponse.json(usuarios);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  const { id, rol } = await req.json();
  const usuario = await prisma.usuario.update({ where: { id }, data: { rol } });
  return NextResponse.json(usuario);
}
