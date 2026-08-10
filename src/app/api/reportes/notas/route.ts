import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularPromedioAlumno } from "@/lib/promedios";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const seccionId = searchParams.get("seccionId");
  const alumnoId = searchParams.get("alumnoId");

  if (!seccionId && !alumnoId) {
    return NextResponse.json({ error: "Indica seccionId o alumnoId" }, { status: 400 });
  }

  // Obtiene alumnos via matrículas (nuevo modelo — seccionId está en Matricula)
  const matriculas = await prisma.matricula.findMany({
    where: alumnoId ? { alumnoId } : { seccionId: seccionId! },
    select: {
      alumno: {
        select: {
          id: true, dni: true,
          usuario: { select: { nombre: true } },
        },
      },
    },
  });

  const alumnos = matriculas.map((m) => m.alumno);

  const resultados = await Promise.all(
    alumnos.map(async (alumno) => {
      const { promedioAnual, materias } = await calcularPromedioAlumno(alumno.id);
      return { alumno, promedioAnual, materias };
    })
  );

  return NextResponse.json(resultados);
}
