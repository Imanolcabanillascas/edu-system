import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const seccionId = searchParams.get("seccionId");
  const claseId = searchParams.get("claseId");
  if (claseId) {
    const horarios = await prisma.horarioClase.findMany({ where: { claseId }, orderBy: [{ dia: "asc" }, { horaInicio: "asc" }] });
    return NextResponse.json(horarios);
  }
  if (seccionId) {
    const clases = await prisma.clase.findMany({
      where: { seccionId },
      select: { id: true, planEstudio: { select: { materia: { select: { nombre: true } } } }, profesor: { select: { usuario: { select: { nombre: true } } } }, horarios: { orderBy: [{ dia: "asc" }, { horaInicio: "asc" }] } },
    });
    return NextResponse.json(clases);
  }
  return NextResponse.json({ error: "Indica seccionId o claseId" }, { status: 400 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { claseId, dia, horaInicio, horaFin, salon } = await req.json();
  if (!claseId || !dia || !horaInicio || !horaFin) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  const clase = await prisma.clase.findUnique({ where: { id: claseId }, select: { seccionId: true } });
  if (!clase) return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
  const conflicto = await prisma.horarioClase.findFirst({
    where: { dia, clase: { seccionId: clase.seccionId, id: { not: claseId } }, OR: [{ horaInicio: { lt: horaFin }, horaFin: { gt: horaInicio } }] },
    select: { clase: { select: { planEstudio: { select: { materia: { select: { nombre: true } } } } } } },
  });
  if (conflicto) return NextResponse.json({ error: `Conflicto con ${conflicto.clase.planEstudio.materia.nombre}` }, { status: 409 });
  const horario = await prisma.horarioClase.create({ data: { claseId, dia, horaInicio, horaFin, salon: salon || null } });
  return NextResponse.json(horario, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await req.json();
  await prisma.horarioClase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
