import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dni = searchParams.get("dni")?.trim();

  if (!dni) return NextResponse.json({ error: "DNI requerido" }, { status: 400 });

  const alumno = await prisma.alumno.findUnique({
    where: { dni },
    select: {
      id: true, dni: true, anoIngreso: true,
      usuario: { select: { nombre: true } },
      matricula: { select: { estado: true } },
      seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
    },
  });

  if (!alumno) return NextResponse.json(null);
  return NextResponse.json(alumno);
}
