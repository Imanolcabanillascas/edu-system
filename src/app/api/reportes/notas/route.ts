import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularPromedioAlumno } from "@/lib/promedios";

// Reporte de notas para el Admin: usa el mismo cálculo ponderado (criterio por
// nivel) que ve el propio alumno en "Mi Promedio", para que ambas pantallas
// sean siempre consistentes entre sí.
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

  const alumnos = await prisma.alumno.findMany({
    where: alumnoId ? { id: alumnoId } : { seccionId },
    select: { id: true, dni: true, usuario: { select: { nombre: true } } },
    orderBy: { usuario: { nombre: "asc" } },
  });
  if (alumnos.length === 0) return NextResponse.json({ alumnos: [], detalle: [] });

  // Se calcula uno por uno (el volumen típico de una sección es pequeño,
  // y reutilizar el helper evita mantener dos lógicas de promedio distintas)
  const resultados = await Promise.all(
    alumnos.map(async (a) => {
      const { promedioAnual, materias, criterio } = await calcularPromedioAlumno(a.id);
      return { id: a.id, dni: a.dni, nombre: a.usuario.nombre, promedio: promedioAnual, materias, criterio };
    })
  );

  return NextResponse.json({
    alumnos: resultados.map(({ id, dni, nombre, promedio, criterio }) => ({
      id, dni, nombre, promedio,
      aprobado: promedio !== null ? promedio >= criterio.notaAprobatoria : null,
    })),
    detalle: resultados.map(({ id, materias }) => ({ alumnoId: id, materias })),
  });
}
