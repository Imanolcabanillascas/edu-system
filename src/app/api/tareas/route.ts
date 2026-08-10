import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const claseSelect = {
  select: {
    id: true, horario: true, salon: true,
    planEstudio: { select: { materia: { select: { nombre: true } } } },
    seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
  },
};

async function getSeccionIdAlumno(alumnoId: string): Promise<string | null> {
  const anoActivo = await prisma.anoLectivo.findFirst({ where: { activo: true }, select: { id: true } });
  if (!anoActivo) return null;
  const matricula = await prisma.matricula.findUnique({
    where: { alumnoId_anoLectivoId: { alumnoId, anoLectivoId: anoActivo.id } },
    select: { seccionId: true },
  });
  return matricula?.seccionId ?? null;
}

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
        clase: { select: { ...claseSelect.select, seccion: { select: { nombre: true, grado: { select: { nombre: true } }, matriculas: { select: { alumno: { select: { id: true } } } } } } } },
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
    const seccionId = await getSeccionIdAlumno(usuario.alumno.id);
    tareas = seccionId ? await prisma.tarea.findMany({
      where: { clase: { seccionId }, estado: "PUBLICADA" },
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
    }) : [];
  } else {
    tareas = [];
  }

  return NextResponse.json(tareas);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "PROFESOR") {
    return NextResponse.json({ error: "Solo los profesores pueden crear tareas" }, { status: 403 });
  }
  const profesor = await prisma.profesor.findUnique({ where: { usuarioId: (session.user as any).id }, select: { id: true } });
  if (!profesor) return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });

  const { titulo, descripcion, archivoUrl, archivoNombre, fechaInicio, fechaLimite, estado, claseId } = await req.json();
  if (!titulo?.trim() || !claseId || !fechaLimite) return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });

  const tarea = await prisma.tarea.create({
    data: { titulo: titulo.trim(), descripcion, archivoUrl, archivoNombre, claseId, profesorId: profesor.id,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
      fechaLimite: new Date(fechaLimite), estado: estado ?? "BORRADOR" },
    select: { id: true, titulo: true, estado: true },
  });
  return NextResponse.json(tarea, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "PROFESOR") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id, titulo, descripcion, archivoUrl, archivoNombre, fechaInicio, fechaLimite, estado, claseId } = await req.json();
  const tarea = await prisma.tarea.update({
    where: { id },
    data: { titulo: titulo?.trim(), descripcion, archivoUrl, archivoNombre, claseId,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
      fechaLimite: new Date(fechaLimite), estado },
    select: { id: true, titulo: true, estado: true },
  });
  return NextResponse.json(tarea);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "PROFESOR") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await req.json();
  await prisma.tarea.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
