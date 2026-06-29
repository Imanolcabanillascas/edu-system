import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const anoLectivoId = searchParams.get("anoLectivoId");

  const secciones = await prisma.seccion.findMany({
    where: anoLectivoId ? { anoLectivoId } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, nombre: true, gradoId: true, anoLectivoId: true,
      anoLectivo: { select: { anio: true } },
      grado: { select: { nombre: true, nivel: true } },
      alumnos: { select: { id: true } },
    },
  });
  return NextResponse.json(secciones);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { nombre, gradoId, anoLectivoId } = await req.json();
  if (!nombre?.trim() || !gradoId || !anoLectivoId) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  try {
    const seccion = await prisma.seccion.create({
      data: { nombre: nombre.trim().toUpperCase(), gradoId, anoLectivoId },
      select: {
        id: true, nombre: true, anoLectivoId: true,
        anoLectivo: { select: { anio: true } },
        grado: { select: { nombre: true, nivel: true } },
      },
    });
    return NextResponse.json(seccion, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe esa sección/periodo en este grado y año" }, { status: 409 });
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
    await prisma.seccion.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "No se puede eliminar: tiene alumnos o clases asociadas" }, { status: 409 });
  }
}
