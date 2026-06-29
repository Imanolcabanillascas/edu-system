import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// select explícito: solo los campos que la UI realmente usa, para reducir
// el tamaño de la respuesta y el trabajo de la base de datos.
const claseSelect = {
  id: true,
  materiaId: true,
  seccionId: true,
  horario: true,
  salon: true,
  materia: { select: { nombre: true, grado: { select: { secciones: { select: { id: true, nombre: true } } } } } },
  seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
  profesor: { select: { id: true, usuario: { select: { nombre: true } } } },
  alumnos: { select: { alumno: { select: { id: true, usuario: { select: { nombre: true } } } } } },
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: { rol: true, profesor: { select: { id: true } }, alumno: { select: { id: true } } },
  });
  if (!usuario) return NextResponse.json([]);

  let clases;
  if (usuario.rol === "ADMIN") {
    clases = await prisma.clase.findMany({ select: claseSelect, orderBy: { createdAt: "desc" } });
  } else if (usuario.rol === "PROFESOR" && usuario.profesor) {
    clases = await prisma.clase.findMany({ where: { profesorId: usuario.profesor.id }, select: claseSelect });
  } else if (usuario.rol === "ALUMNO" && usuario.alumno) {
    clases = await prisma.clase.findMany({
      where: { alumnos: { some: { alumnoId: usuario.alumno.id } } },
      select: claseSelect,
    });
  } else {
    clases = [];
  }

  return NextResponse.json(clases);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { materiaId, seccionId, profesorId, horario, salon, alumnoIds } = await req.json();
  if (!materiaId || !seccionId || !profesorId) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  try {
    const clase = await prisma.clase.create({
      data: {
        materiaId, seccionId, profesorId, horario, salon,
        alumnos: { create: (alumnoIds ?? []).map((aid: string) => ({ alumnoId: aid })) },
      },
      select: claseSelect,
    });
    return NextResponse.json(clase, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe una clase para esta materia y sección" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id, materiaId, seccionId, profesorId, horario, salon, alumnoIds } = await req.json();
  await prisma.alumnoClase.deleteMany({ where: { claseId: id } });

  try {
    const clase = await prisma.clase.update({
      where: { id },
      data: {
        materiaId, seccionId, profesorId, horario, salon,
        alumnos: { create: (alumnoIds ?? []).map((aid: string) => ({ alumnoId: aid })) },
      },
      select: claseSelect,
    });
    return NextResponse.json(clase);
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe una clase para esta materia y sección" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await req.json();
  await prisma.clase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}