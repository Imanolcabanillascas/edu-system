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

  let examenes;
  if (usuario.rol === "PROFESOR" && usuario.profesor) {
    examenes = await prisma.examen.findMany({
      where: { profesorId: usuario.profesor.id },
      select: {
        id: true, titulo: true, descripcion: true, tipo: true,
        archivoUrl: true, archivoNombre: true,
        fechaInicio: true, fechaLimite: true, duracion: true, salon: true, claseId: true,
        clase: claseSelect,
        preguntas: { select: { id: true } },
        respuestas: {
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
    examenes = seccionId ? await prisma.examen.findMany({
      where: { clase: { seccionId } },
      select: {
        id: true, titulo: true, descripcion: true, tipo: true,
        archivoUrl: true, archivoNombre: true,
        fechaInicio: true, fechaLimite: true, duracion: true, salon: true,
        clase: claseSelect,
        preguntas: { select: { id: true } },
        respuestas: {
          where: { alumnoId: usuario.alumno.id },
          select: { id: true, estado: true, nota: true, comentario: true, archivoUrl: true, archivoNombre: true },
        },
      },
      orderBy: { fechaLimite: "asc" },
    }) : [];
  } else {
    examenes = [];
  }

  return NextResponse.json(examenes);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "PROFESOR") return NextResponse.json({ error: "Solo los profesores pueden crear exámenes" }, { status: 403 });

  const profesor = await prisma.profesor.findUnique({ where: { usuarioId: (session.user as any).id }, select: { id: true } });
  if (!profesor) return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });

  const { titulo, descripcion, archivoUrl, archivoNombre, claseId, fechaInicio, fechaLimite, duracion, salon } = await req.json();
  if (!titulo?.trim() || !claseId || !fechaLimite) return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });

  const examen = await prisma.examen.create({
    data: { titulo: titulo.trim(), descripcion, archivoUrl, archivoNombre, claseId, profesorId: profesor.id,
      tipo: "ARCHIVO",
      fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
      fechaLimite: new Date(fechaLimite), duracion: Number(duracion) || 60, salon: salon || null },
    select: { id: true, titulo: true, tipo: true },
  });
  return NextResponse.json(examen, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "PROFESOR") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id, titulo, descripcion, archivoUrl, archivoNombre, claseId, fechaInicio, fechaLimite, duracion, salon } = await req.json();
  const examen = await prisma.examen.update({
    where: { id },
    data: { titulo: titulo?.trim(), descripcion, archivoUrl, archivoNombre, claseId,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
      fechaLimite: new Date(fechaLimite), duracion: Number(duracion), salon: salon || null },
    select: { id: true, titulo: true, tipo: true },
  });
  return NextResponse.json(examen);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "PROFESOR") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await req.json();
  try {
    await prisma.examen.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "No se puede eliminar" }, { status: 409 });
  }
}
