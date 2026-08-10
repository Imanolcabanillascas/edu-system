import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const claseSelect = {
  id: true, planEstudioId: true, seccionId: true, horario: true, salon: true,
  planEstudio: {
    select: {
      id: true, horasSemanales: true, orden: true,
      materia: { select: { nombre: true, area: true, codigo: true } },
      grado: { select: { nombre: true } },
    },
  },
  seccion: {
    select: {
      nombre: true,
      grado: { select: { nombre: true } },
      matriculas: { select: { alumno: { select: { id: true, dni: true, usuario: { select: { nombre: true } } } } } },
    },
  },
  profesor: { select: { id: true, usuario: { select: { nombre: true } } } },
};

// Helper: obtiene la seccionId actual de un alumno via su matrícula más reciente
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

  let clases;
  if (usuario.rol === "ADMIN") {
    clases = await prisma.clase.findMany({ select: claseSelect, orderBy: { createdAt: "desc" } });
  } else if (usuario.rol === "PROFESOR" && usuario.profesor) {
    clases = await prisma.clase.findMany({ where: { profesorId: usuario.profesor.id }, select: claseSelect });
  } else if (usuario.rol === "ALUMNO" && usuario.alumno) {
    const seccionId = await getSeccionIdAlumno(usuario.alumno.id);
    clases = seccionId
      ? await prisma.clase.findMany({ where: { seccionId }, select: claseSelect })
      : [];
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

  const { planEstudioId, seccionId, profesorId, horario, salon } = await req.json();
  if (!planEstudioId || !seccionId || !profesorId) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  try {
    const clase = await prisma.clase.create({
      data: { planEstudioId, seccionId, profesorId, horario: horario || null, salon: salon || null },
      select: claseSelect,
    });
    return NextResponse.json(clase, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe una clase para ese plan y sección" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id, planEstudioId, seccionId, profesorId, horario, salon } = await req.json();
  try {
    const clase = await prisma.clase.update({
      where: { id },
      data: { planEstudioId, seccionId, profesorId, horario: horario || null, salon: salon || null },
      select: claseSelect,
    });
    return NextResponse.json(clase);
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe una clase para ese plan y sección" }, { status: 409 });
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
    await prisma.clase.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "No se puede eliminar: tiene tareas o exámenes" }, { status: 409 });
  }
}
