import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PlanEstudio: asigna una Materia a un Grado con metadatos curriculares.
// GET ?gradoId=xxx → devuelve el plan completo de ese grado
// GET sin params → devuelve todos (para selectores generales)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const gradoId = searchParams.get("gradoId");

  const planes = await prisma.planEstudio.findMany({
    where: gradoId ? { gradoId } : undefined,
    orderBy: [{ orden: "asc" }, { materia: { nombre: "asc" } }],
    select: {
      id: true, horasSemanales: true, orden: true, obligatoria: true, observaciones: true,
      grado: { select: { id: true, nombre: true, nivel: { select: { nombre: true, tipo: true } } } },
      materia: { select: { id: true, nombre: true, area: true, codigo: true } },
    },
  });
  return NextResponse.json(planes);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { gradoId, materiaId, horasSemanales, orden, obligatoria, observaciones } = await req.json();
  if (!gradoId || !materiaId) {
    return NextResponse.json({ error: "Faltan gradoId y materiaId" }, { status: 400 });
  }

  try {
    const plan = await prisma.planEstudio.create({
      data: {
        gradoId, materiaId,
        horasSemanales: Number(horasSemanales) || 0,
        orden: Number(orden) || 0,
        obligatoria: obligatoria !== false,
        observaciones: observaciones || null,
      },
      select: {
        id: true, horasSemanales: true, orden: true, obligatoria: true, observaciones: true,
        grado: { select: { nombre: true, nivel: { select: { nombre: true } } } },
        materia: { select: { nombre: true, area: true } },
      },
    });
    return NextResponse.json(plan, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Esa materia ya está en el plan de estudios de este grado" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id, horasSemanales, orden, obligatoria, observaciones } = await req.json();
  const plan = await prisma.planEstudio.update({
    where: { id },
    data: {
      horasSemanales: Number(horasSemanales) || 0,
      orden: Number(orden) || 0,
      obligatoria: obligatoria !== false,
      observaciones: observaciones || null,
    },
    select: { id: true, horasSemanales: true, orden: true, obligatoria: true, observaciones: true },
  });
  return NextResponse.json(plan);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await req.json();
  try {
    await prisma.planEstudio.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "No se puede eliminar: tiene clases asociadas" }, { status: 409 });
  }
}
