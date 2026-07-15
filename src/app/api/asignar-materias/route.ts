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

// Asigna un profesor a varios ítems del Plan de Estudios en una sección,
// sin marcarlo como "tutor". Aplica a cualquier nivel.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { profesorId, seccionId, horario, salon, planEstudioIds } = await req.json();
  if (!profesorId || !seccionId) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }
  if (!planEstudioIds?.length) {
    return NextResponse.json({ error: "Selecciona al menos una materia del plan de estudios" }, { status: 400 });
  }

  const seccion = await prisma.seccion.findUnique({ where: { id: seccionId }, select: { gradoId: true } });
  if (!seccion) return NextResponse.json({ error: "Sección no encontrada" }, { status: 404 });

  const planesValidos = await prisma.planEstudio.findMany({
    where: { id: { in: planEstudioIds }, gradoId: seccion.gradoId },
    select: { id: true },
  });
  if (planesValidos.length === 0) {
    return NextResponse.json({ error: "Las materias seleccionadas no pertenecen al plan de este grado" }, { status: 400 });
  }

  const clases = await prisma.$transaction(
    planesValidos.map((p) =>
      prisma.clase.upsert({
        where: { planEstudioId_seccionId: { planEstudioId: p.id, seccionId } },
        update: { profesorId, horario: horario || null, salon: salon || null },
        create: { planEstudioId: p.id, seccionId, profesorId, horario: horario || null, salon: salon || null },
        select: claseSelect,
      })
    )
  );

  return NextResponse.json({ clases, total: clases.length });
}
