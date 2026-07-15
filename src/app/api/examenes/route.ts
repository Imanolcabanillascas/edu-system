import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const claseSelect = {
  select: {
    id: true,
    horario: true,
    salon: true,
    planEstudio: { select: { materia: { select: { nombre: true } } } },
    seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
  },
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: { rol: true, profesor: { select: { id: true } }, alumno: { select: { id: true, seccionId: true } } },
  });
  if (!usuario) return NextResponse.json([]);

  let examenes;
  if (usuario.rol === "PROFESOR" && usuario.profesor) {
    examenes = await prisma.examen.findMany({
      where: { profesorId: usuario.profesor.id },
      select: {
        id: true, titulo: true, descripcion: true, archivoUrl: true, archivoNombre: true,
        fechaInicio: true, fechaLimite: true, duracion: true, salon: true,
        clase: claseSelect,
        respuestas: {
          select: {
            id: true, estado: true, nota: true, archivoUrl: true, archivoNombre: true, alumnoId: true,
            alumno: { select: { usuario: { select: { nombre: true } } } },
          },
        },
      },
      orderBy: { fechaLimite: "asc" },
    });
  } else if (usuario.rol === "ALUMNO" && usuario.alumno?.seccionId) {
    // El alumno obtiene sus exámenes via las clases de su sección, sin AlumnoClase
    examenes = await prisma.examen.findMany({
      where: { clase: { seccionId: usuario.alumno.seccionId } },
      select: {
        id: true, titulo: true, descripcion: true, archivoUrl: true, archivoNombre: true,
        fechaInicio: true, fechaLimite: true, duracion: true, salon: true,
        clase: claseSelect,
        respuestas: {
          where: { alumnoId: usuario.alumno.id },
          select: { id: true, estado: true, nota: true, comentario: true, archivoUrl: true, archivoNombre: true },
        },
      },
      orderBy: { fechaLimite: "asc" },
    });
  } else {
    examenes = [];
  }

  return NextResponse.json(examenes);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: { rol: true, profesor: { select: { id: true } } },
  });
  if (!usuario?.profesor || usuario.rol !== "PROFESOR") {
    return NextResponse.json({ error: "Solo los profesores pueden crear exámenes" }, { status: 403 });
  }

  const { titulo, descripcion, archivoUrl, archivoNombre, fechaInicio, fechaLimite, duracion, salon, claseId } = await req.json();

  if (!titulo?.trim() || !claseId || !fechaLimite) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const clase = await prisma.clase.findUnique({ where: { id: claseId }, select: { profesorId: true } });
  if (!clase) return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
  if (clase.profesorId !== usuario.profesor.id) {
    return NextResponse.json({ error: "No puedes crear exámenes para una clase que no dictas" }, { status: 403 });
  }

  const examen = await prisma.examen.create({
    data: {
      titulo: titulo.trim(), descripcion, archivoUrl, archivoNombre,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
      fechaLimite: new Date(fechaLimite),
      duracion: Number(duracion) || 60,
      salon, claseId,
      profesorId: usuario.profesor.id,
    },
    select: { id: true, titulo: true },
  });
  return NextResponse.json(examen, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: { rol: true, profesor: { select: { id: true } } },
  });

  const { id, titulo, descripcion, archivoUrl, archivoNombre, fechaInicio, fechaLimite, duracion, salon, claseId } = await req.json();
  if (!id || !titulo?.trim() || !claseId || !fechaLimite) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const examenActual = await prisma.examen.findUnique({ where: { id }, select: { profesorId: true } });
  if (!examenActual) return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 });
  if (usuario?.rol !== "PROFESOR" || examenActual.profesorId !== usuario.profesor?.id) {
    return NextResponse.json({ error: "Solo el profesor que creó el examen puede editarlo" }, { status: 403 });
  }

  const examen = await prisma.examen.update({
    where: { id },
    data: {
      titulo: titulo.trim(), descripcion, archivoUrl, archivoNombre,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
      fechaLimite: new Date(fechaLimite),
      duracion: Number(duracion) || 60,
      salon, claseId,
    },
    select: { id: true, titulo: true },
  });
  return NextResponse.json(examen);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: { rol: true, profesor: { select: { id: true } } },
  });

  const { id } = await req.json();
  const examenActual = await prisma.examen.findUnique({ where: { id }, select: { profesorId: true } });
  if (!examenActual) return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 });

  if (usuario?.rol !== "PROFESOR" || examenActual.profesorId !== usuario.profesor?.id) {
    return NextResponse.json({ error: "Solo el profesor que creó el examen puede eliminarlo" }, { status: 403 });
  }

  await prisma.examen.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
