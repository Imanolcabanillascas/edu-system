import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// select explícito (en vez de include completo) para mantener el payload liviano
// y reducir el trabajo de la base de datos en listados frecuentes.
const claseSelect = {
  select: {
    id: true,
    horario: true,
    salon: true,
    materia: { select: { nombre: true } },
    seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
  },
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: { rol: true, profesor: { select: { id: true } }, alumno: { select: { id: true } } },
  });
  if (!usuario) return NextResponse.json([]);

  let tareas;
  if (usuario.rol === "PROFESOR" && usuario.profesor) {
    tareas = await prisma.tarea.findMany({
      where: { profesorId: usuario.profesor.id },
      select: {
        id: true, titulo: true, descripcion: true, archivoUrl: true, archivoNombre: true,
        fechaInicio: true, fechaLimite: true, estado: true, claseId: true,
        clase: { select: { ...claseSelect.select, alumnos: { select: { alumnoId: true } } } },
        entregas: {
          select: {
            id: true, estado: true, nota: true, archivoUrl: true, archivoNombre: true, alumnoId: true,
            alumno: { select: { usuario: { select: { nombre: true } } } },
          },
        },
      },
      orderBy: { fechaLimite: "asc" },
    });
  } else if (usuario.rol === "ALUMNO" && usuario.alumno) {
    const clases = await prisma.alumnoClase.findMany({ where: { alumnoId: usuario.alumno.id }, select: { claseId: true } });
    const claseIds = clases.map((c) => c.claseId);
    tareas = await prisma.tarea.findMany({
      where: { claseId: { in: claseIds }, estado: "PUBLICADA" },
      select: {
        id: true, titulo: true, descripcion: true, archivoUrl: true, archivoNombre: true,
        fechaInicio: true, fechaLimite: true, estado: true, claseId: true,
        clase: claseSelect,
        entregas: {
          where: { alumnoId: usuario.alumno.id },
          select: { id: true, estado: true, nota: true, comentario: true, archivoUrl: true, archivoNombre: true },
        },
      },
      orderBy: { fechaLimite: "asc" },
    });
  } else {
    tareas = [];
  }

  return NextResponse.json(tareas);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: { rol: true, profesor: { select: { id: true } } },
  });
  if (!usuario?.profesor || usuario.rol !== "PROFESOR") {
    return NextResponse.json({ error: "Solo los profesores pueden crear tareas" }, { status: 403 });
  }

  const { titulo, descripcion, archivoUrl, archivoNombre, fechaInicio, fechaLimite, estado, claseId } = await req.json();

  if (!titulo?.trim() || !claseId || !fechaLimite) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  // Solo se pueden crear tareas para una clase que el propio profesor dicta
  const clase = await prisma.clase.findUnique({ where: { id: claseId }, select: { profesorId: true } });
  if (!clase) return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
  if (clase.profesorId !== usuario.profesor.id) {
    return NextResponse.json({ error: "No puedes crear tareas para una clase que no dictas" }, { status: 403 });
  }

  const tarea = await prisma.tarea.create({
    data: {
      titulo: titulo.trim(), descripcion, archivoUrl, archivoNombre,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
      fechaLimite: new Date(fechaLimite),
      estado: estado ?? "BORRADOR",
      claseId,
      profesorId: usuario.profesor.id,
    },
    select: { id: true, titulo: true, fechaLimite: true },
  });
  return NextResponse.json(tarea, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: { rol: true, profesor: { select: { id: true } } },
  });

  const { id, titulo, descripcion, archivoUrl, archivoNombre, fechaInicio, fechaLimite, estado, claseId } = await req.json();
  if (!id || !titulo?.trim() || !claseId || !fechaLimite) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const tareaActual = await prisma.tarea.findUnique({ where: { id }, select: { profesorId: true } });
  if (!tareaActual) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  if (usuario?.rol !== "PROFESOR" || tareaActual.profesorId !== usuario.profesor?.id) {
    return NextResponse.json({ error: "Solo el profesor que creó la tarea puede editarla" }, { status: 403 });
  }

  const tarea = await prisma.tarea.update({
    where: { id },
    data: {
      titulo: titulo.trim(), descripcion, archivoUrl, archivoNombre,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
      fechaLimite: new Date(fechaLimite),
      estado, claseId,
    },
    select: { id: true, titulo: true, fechaLimite: true },
  });
  return NextResponse.json(tarea);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: { rol: true, profesor: { select: { id: true } } },
  });

  const { id } = await req.json();
  const tareaActual = await prisma.tarea.findUnique({ where: { id }, select: { profesorId: true } });
  if (!tareaActual) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

  if (usuario?.rol !== "PROFESOR" || tareaActual.profesorId !== usuario.profesor?.id) {
    return NextResponse.json({ error: "Solo el profesor que creó la tarea puede eliminarla" }, { status: 403 });
  }

  await prisma.tarea.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
