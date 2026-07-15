import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Catálogo global de Materias — ya no pertenecen a un Grado.
// La asignación Materia↔Grado vive en PlanEstudio.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const materias = await prisma.materia.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id: true, nombre: true, area: true, codigo: true,
      planEstudios: { select: { grado: { select: { nombre: true, nivel: { select: { nombre: true } } } } } },
    },
  });
  return NextResponse.json(materias);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { nombre, area, codigo } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  try {
    const materia = await prisma.materia.create({
      data: { nombre: nombre.trim(), area: area?.trim() || null, codigo: codigo?.trim() || null },
    });
    return NextResponse.json(materia, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe una materia con ese nombre o código" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id, nombre, area, codigo } = await req.json();
  try {
    const materia = await prisma.materia.update({
      where: { id },
      data: { nombre: nombre?.trim(), area: area?.trim() || null, codigo: codigo?.trim() || null },
    });
    return NextResponse.json(materia);
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe una materia con ese nombre o código" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await req.json();
  try {
    await prisma.materia.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "No se puede eliminar: la materia está en uso en algún Plan de Estudios" }, { status: 409 });
  }
}
