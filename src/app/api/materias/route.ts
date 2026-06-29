import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Las secciones que se muestran para crear/editar clases son siempre las del
  // año lectivo activo, para no mezclar secciones de años distintos al matricular clases.
  const anoActivo = await prisma.anoLectivo.findFirst({ where: { activo: true }, select: { id: true } });

  const materias = await prisma.materia.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id: true, nombre: true, gradoId: true,
      grado: {
        select: {
          nombre: true, nivel: true,
          secciones: { where: anoActivo ? { anoLectivoId: anoActivo.id } : undefined, select: { id: true, nombre: true } },
        },
      },
      profesores: { select: { profesor: { select: { id: true, usuario: { select: { nombre: true } } } } } },
      clases: { select: { id: true } },
    },
  });
  return NextResponse.json(materias);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { nombre, gradoId, profesorIds } = await req.json();
  if (!nombre?.trim() || !gradoId) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  try {
    const materia = await prisma.materia.create({
      data: {
        nombre: nombre.trim(),
        gradoId,
        profesores: { create: (profesorIds ?? []).map((pid: string) => ({ profesorId: pid })) },
      },
      include: {
        grado: { include: { nivel: true } },
        profesores: { include: { profesor: { include: { usuario: true } } } },
      },
    });
    return NextResponse.json(materia, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe esa materia en este grado" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id, nombre, profesorIds } = await req.json();

  try {
    await prisma.profesorMateria.deleteMany({ where: { materiaId: id } });
    const materia = await prisma.materia.update({
      where: { id },
      data: {
        nombre: nombre.trim(),
        profesores: { create: (profesorIds ?? []).map((pid: string) => ({ profesorId: pid })) },
      },
      include: {
        grado: { include: { nivel: true } },
        profesores: { include: { profesor: { include: { usuario: true } } } },
      },
    });
    return NextResponse.json(materia);
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe esa materia en este grado" }, { status: 409 });
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
    return NextResponse.json({ error: "No se puede eliminar: tiene clases asociadas" }, { status: 409 });
  }
}
