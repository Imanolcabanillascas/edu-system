import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularPromedioAlumno } from "@/lib/promedios";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const anoActivo = await prisma.anoLectivo.findFirst({
    where: { activo: true },
    select: { id: true, anio: true },
  });
  if (!anoActivo) return NextResponse.json({ error: "No hay año lectivo activo" }, { status: 400 });

  // Obtiene todas las secciones del año activo con sus alumnos matriculados
  const secciones = await prisma.seccion.findMany({
    where: { anoLectivoId: anoActivo.id },
    select: {
      id: true, nombre: true,
      grado: {
        select: {
          id: true, nombre: true,
          nivel: { select: { id: true, nombre: true, tipo: true } },
          gradoSiguiente: { select: { id: true, nombre: true } },
        },
      },
      // Alumnos via matrículas del año activo
      matriculas: {
        where: { anoLectivoId: anoActivo.id },
        select: { alumnoId: true, alumno: { select: { id: true, usuario: { select: { nombre: true } } } } },
      },
    },
  });

  const seccionesConAlumnos = secciones.filter((s) => s.matriculas.length > 0);

  const vistaPrevia = await Promise.all(
    seccionesConAlumnos.map(async (seccion) => {
      const alumnos = await Promise.all(
        seccion.matriculas.map(async ({ alumno }) => {
          const { promedioAnual } = await calcularPromedioAlumno(alumno.id);
          return {
            id: alumno.id,
            nombre: alumno.usuario.nombre,
            promedioAnual,
            aprueba: promedioAnual != null && promedioAnual >= 10.5,
          };
        })
      );

      return {
        seccionId: seccion.id,
        seccionNombre: seccion.nombre,
        grado: seccion.grado,
        esUltimoGrado: !seccion.grado.gradoSiguiente,
        alumnos,
      };
    })
  );

  return NextResponse.json({ anoActivo, vistaPrevia });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { decisiones, anoLectivoDestinoId } = await req.json();
  // decisiones: [{ alumnoId, seccionOrigenId, accion: "PROMOVER" | "REPETIR" | "EGRESAR" }]

  if (!decisiones?.length || !anoLectivoDestinoId) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const anoActivo = await prisma.anoLectivo.findFirst({
    where: { activo: true }, select: { id: true },
  });
  if (!anoActivo) return NextResponse.json({ error: "No hay año lectivo activo" }, { status: 400 });

  let promovidos = 0, repetidores = 0, egresados = 0;

  for (const d of decisiones) {
    if (d.accion === "EGRESAR") {
      await prisma.alumno.update({ where: { id: d.alumnoId }, data: { estado: "EGRESADO" } });
      egresados++;
      continue;
    }

    if (d.accion === "PROMOVER") {
      // Busca el grado siguiente de la sección origen
      const seccionOrigen = await prisma.seccion.findUnique({
        where: { id: d.seccionOrigenId },
        select: { grado: { select: { gradoSiguienteId: true } } },
      });
      const gradoDestinoId = seccionOrigen?.grado.gradoSiguienteId;
      if (!gradoDestinoId) continue;

      // Busca o crea una sección en el grado destino para el año destino
      const seccionDestino = await prisma.seccion.findFirst({
        where: { gradoId: gradoDestinoId, anoLectivoId: anoLectivoDestinoId },
        select: { id: true },
      });
      if (!seccionDestino) continue;

      // Actualiza la matrícula del año destino con la nueva sección
      await prisma.matricula.upsert({
        where: { alumnoId_anoLectivoId: { alumnoId: d.alumnoId, anoLectivoId: anoLectivoDestinoId } },
        update: { seccionId: seccionDestino.id },
        create: {
          alumnoId: d.alumnoId, anoLectivoId: anoLectivoDestinoId,
          seccionId: seccionDestino.id, monto: 0,
          fechaVencimiento: new Date(new Date().getFullYear() + 1, 2, 31),
        },
      });
      promovidos++;
    }

    if (d.accion === "REPETIR") {
      // Mantiene al alumno en la misma sección el año siguiente
      const seccionOrigen = await prisma.seccion.findUnique({
        where: { id: d.seccionOrigenId },
        select: { gradoId: true },
      });
      if (!seccionOrigen) continue;

      const seccionDestino = await prisma.seccion.findFirst({
        where: { gradoId: seccionOrigen.gradoId, anoLectivoId: anoLectivoDestinoId },
        select: { id: true },
      });
      if (!seccionDestino) continue;

      await prisma.matricula.upsert({
        where: { alumnoId_anoLectivoId: { alumnoId: d.alumnoId, anoLectivoId: anoLectivoDestinoId } },
        update: { seccionId: seccionDestino.id },
        create: {
          alumnoId: d.alumnoId, anoLectivoId: anoLectivoDestinoId,
          seccionId: seccionDestino.id, monto: 0,
          fechaVencimiento: new Date(new Date().getFullYear() + 1, 2, 31),
        },
      });
      repetidores++;
    }
  }

  return NextResponse.json({ promovidos, repetidores, egresados });
}
