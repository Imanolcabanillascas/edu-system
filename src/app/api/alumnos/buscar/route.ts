import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dni = searchParams.get("dni")?.trim();
  const nombre = searchParams.get("nombre")?.trim();

  if (!dni && !nombre) return NextResponse.json({ error: "Indica dni o nombre" }, { status: 400 });

  const alumnos = await prisma.alumno.findMany({
    where: dni
      ? { dni: { contains: dni } }
      : { usuario: { nombre: { contains: nombre!, mode: "insensitive" } } },
    take: 10,
    select: {
      id: true, dni: true, estado: true,
      usuario: { select: { nombre: true, email: true } },
      // Matrícula más reciente para saber la sección actual
      matriculas: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true, estado: true, anoLectivoId: true,
          seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
        },
      },
    },
  });

  return NextResponse.json(alumnos);
}
