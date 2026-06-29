import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const anoLectivoId = searchParams.get("anoLectivoId");

  const grados = await prisma.grado.findMany({
    orderBy: [{ ordenSecuencia: "asc" }, { createdAt: "asc" }],
    include: {
      nivel: true, carrera: true,
      gradoSiguiente: { select: { id: true, nombre: true, nivel: { select: { tipo: true } } } },
      secciones: {
        where: anoLectivoId ? { anoLectivoId } : undefined,
        orderBy: { createdAt: "desc" },
        include: { anoLectivo: true },
      },
    },
  });
  return NextResponse.json(grados);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { nombre, nivelId, carreraId, ordenSecuencia } = await req.json();
  if (!nombre?.trim() || !nivelId) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  try {
    const grado = await prisma.grado.create({
      data: { nombre: nombre.trim(), nivelId, carreraId: carreraId || null, ordenSecuencia: Number(ordenSecuencia) || 0 },
      include: { nivel: true, carrera: true, secciones: true },
    });
    return NextResponse.json(grado, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe un grado con ese nombre en ese nivel/carrera" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id, nombre, ordenSecuencia, gradoSiguienteId } = await req.json();
  try {
    const grado = await prisma.grado.update({
      where: { id },
      data: {
        ...(nombre ? { nombre: nombre.trim() } : {}),
        ...(ordenSecuencia !== undefined ? { ordenSecuencia: Number(ordenSecuencia) } : {}),
        ...(gradoSiguienteId !== undefined ? { gradoSiguienteId: gradoSiguienteId || null } : {}),
      },
      include: { nivel: true, carrera: true, secciones: true, gradoSiguiente: { select: { id: true, nombre: true } } },
    });
    return NextResponse.json(grado);
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe un grado con ese nombre en ese nivel/carrera, o ese grado siguiente ya está asignado a otro grado" }, { status: 409 });
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
    await prisma.grado.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "No se puede eliminar: tiene secciones o materias asociadas" }, { status: 409 });
  }
}
