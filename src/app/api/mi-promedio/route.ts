import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularPromedioAlumno } from "@/lib/promedios";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: { rol: true, alumno: { select: { id: true } } },
  });
  if (usuario?.rol !== "ALUMNO" || !usuario.alumno) {
    return NextResponse.json({ error: "Solo disponible para alumnos" }, { status: 403 });
  }

  const resultado = await calcularPromedioAlumno(usuario.alumno.id);
  return NextResponse.json(resultado);
}
