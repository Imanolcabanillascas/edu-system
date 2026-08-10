import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const claseId = searchParams.get("claseId");
  const fecha = searchParams.get("fecha");
  const alumnoId = searchParams.get("alumnoId");

  if (!claseId) return NextResponse.json({ error: "Falta claseId" }, { status: 400 });

  if (alumnoId && alumnoId !== "me") {
    const asistencias = await prisma.asistencia.findMany({
      where: { claseId, alumnoId },
      orderBy: { fecha: "desc" },
      select: { id: true, fecha: true, estado: true, observacion: true },
    });
    const total = asistencias.length;
    const presentes = asistencias.filter((a) => a.estado === "PRESENTE" || a.estado === "TARDANZA").length;
    const ausentes = asistencias.filter((a) => a.estado === "AUSENTE").length;
    return NextResponse.json({ asistencias, total, presentes, ausentes, porcentajeAsistencia: total > 0 ? Math.round((presentes / total) * 100) : 100 });
  }

  if (alumnoId === "me") {
    const usuario = await prisma.usuario.findUnique({ where: { id: (session.user as any).id }, select: { alumno: { select: { id: true } } } });
    const aid = usuario?.alumno?.id;
    if (!aid) return NextResponse.json({ presentes: 0, ausentes: 0, porcentajeAsistencia: 100, asistencias: [] });
    const asistencias = await prisma.asistencia.findMany({
      where: { claseId, alumnoId: aid }, orderBy: { fecha: "desc" },
      select: { id: true, fecha: true, estado: true, observacion: true },
    });
    const total = asistencias.length;
    const presentes = asistencias.filter((a) => a.estado === "PRESENTE" || a.estado === "TARDANZA").length;
    const ausentes = asistencias.filter((a) => a.estado === "AUSENTE").length;
    return NextResponse.json({ asistencias, total, presentes, ausentes, porcentajeAsistencia: total > 0 ? Math.round((presentes / total) * 100) : 100 });
  }

  if (fecha) {
    const fechaDate = new Date(fecha);
    const inicio = new Date(fechaDate); inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fechaDate); fin.setHours(23, 59, 59, 999);
    const [asistencias, clase] = await Promise.all([
      prisma.asistencia.findMany({
        where: { claseId, fecha: { gte: inicio, lte: fin } },
        select: { id: true, fecha: true, estado: true, observacion: true,
          alumno: { select: { id: true, dni: true, usuario: { select: { nombre: true } } } } },
      }),
      prisma.clase.findUnique({
        where: { id: claseId },
        select: { seccion: { select: { matriculas: { select: { alumno: { select: { id: true, dni: true, usuario: { select: { nombre: true } } } } } } } } },
      }),
    ]);
    const alumnos = clase?.seccion.matriculas.map((m) => m.alumno) ?? [];
    return NextResponse.json({ alumnos, asistencias, fecha });
  }

  return NextResponse.json({ error: "Indica fecha o alumnoId" }, { status: 400 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol === "ALUMNO") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const profesor = await prisma.profesor.findUnique({ where: { usuarioId: (session.user as any).id }, select: { id: true } });
  const { claseId, fecha, registros } = await req.json();
  if (!claseId || !fecha || !registros?.length) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const fechaDate = new Date(fecha);
  const profesorId = profesor?.id ?? (await prisma.clase.findUnique({ where: { id: claseId }, select: { profesorId: true } }))?.profesorId;
  if (!profesorId) return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });

  const resultado = await prisma.$transaction(
    registros.map((r: any) =>
      prisma.asistencia.upsert({
        where: { claseId_alumnoId_fecha: { claseId, alumnoId: r.alumnoId, fecha: fechaDate } },
        update: { estado: r.estado, observacion: r.observacion || null },
        create: { claseId, alumnoId: r.alumnoId, profesorId, fecha: fechaDate, estado: r.estado, observacion: r.observacion || null },
        select: { id: true },
      })
    )
  );
  return NextResponse.json({ ok: true, total: resultado.length });
}
