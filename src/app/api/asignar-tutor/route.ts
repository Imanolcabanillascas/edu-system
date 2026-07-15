import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const claseSelect = {
  id: true, planEstudioId: true, seccionId: true, horario: true, salon: true,
  planEstudio: { select: { materia: { select: { nombre: true } } } },
  seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
  profesor: { select: { id: true, usuario: { select: { nombre: true } } } },
};

// Asigna un profesor como tutor de una sección de Primaria:
// crea (o actualiza) una Clase por cada entrada del PlanEstudio del grado,
// todas con el mismo profesor. Luego el Admin puede reasignar materias
// especialistas individualmente.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { profesorId, seccionId, horario, salon, planEstudioIds } = await req.json();
  if (!profesorId || !seccionId) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const seccion = await prisma.seccion.findUnique({
    where: { id: seccionId },
    select: { gradoId: true, grado: { select: { nivel: { select: { tipo: true } } } } },
  });
  if (!seccion) return NextResponse.json({ error: "Sección no encontrada" }, { status: 404 });
  if (seccion.grado.nivel.tipo !== "PRIMARIA") {
    return NextResponse.json({ error: "La asignación de tutor único solo aplica a Primaria" }, { status: 400 });
  }

  const todosLosPlanes = await prisma.planEstudio.findMany({
    where: { gradoId: seccion.gradoId },
    select: { id: true },
  });
  if (todosLosPlanes.length === 0) {
    return NextResponse.json({ error: "Este grado no tiene Plan de Estudios creado todavía" }, { status: 400 });
  }

  const planesAAsignar = planEstudioIds?.length
    ? todosLosPlanes.filter((p) => planEstudioIds.includes(p.id))
    : todosLosPlanes;

  const resultado = await prisma.$transaction(async (tx) => {
    const clases = await Promise.all(
      planesAAsignar.map((p) =>
        tx.clase.upsert({
          where: { planEstudioId_seccionId: { planEstudioId: p.id, seccionId } },
          update: { profesorId, horario: horario || null, salon: salon || null },
          create: { planEstudioId: p.id, seccionId, profesorId, horario: horario || null, salon: salon || null },
          select: claseSelect,
        })
      )
    );
    await tx.seccion.update({ where: { id: seccionId }, data: { profesorTutorId: profesorId } });
    return clases;
  });

  return NextResponse.json({ clases: resultado, total: resultado.length });
}
