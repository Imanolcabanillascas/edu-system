import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Calcula promedios de todos los alumnos de una sección en una sola consulta
async function calcularPromediosSeccion(seccionId: string, alumnoIds: string[]) {
  if (alumnoIds.length === 0) return {};

  const criterioDb = await prisma.seccion.findUnique({
    where: { id: seccionId },
    select: { grado: { select: { nivelId: true, nivel: { select: { tipo: true } } } } },
  });

  const nivelId = criterioDb?.grado.nivelId;
  const criterio = nivelId
    ? await prisma.criterioEvaluacion.findUnique({ where: { nivelId } })
    : null;

  const pesoTareas = criterio?.pesoTareas ?? 40;
  const pesoExamenes = criterio?.pesoExamenes ?? 60;
  const notaAprobatoria = criterio?.notaAprobatoria ?? 10.5;
  const esPrimaria = criterioDb?.grado.nivel.tipo === "PRIMARIA";

  // Una sola query para todas las entregas de todos los alumnos de la sección
  const entregas = await prisma.entrega.findMany({
    where: {
      alumnoId: { in: alumnoIds },
      tarea: { clase: { seccionId } },
      nota: { not: null },
    },
    select: { alumnoId: true, nota: true },
  });

  const respuestasExamen = await prisma.respuestaExamen.findMany({
    where: {
      alumnoId: { in: alumnoIds },
      examen: { clase: { seccionId } },
      nota: { not: null },
    },
    select: { alumnoId: true, nota: true },
  });

  // Agrupa por alumno
  const promedios: Record<string, { promedioAnual: number | null; aprueba: boolean }> = {};

  for (const alumnoId of alumnoIds) {
    const notasTareas = entregas.filter((e) => e.alumnoId === alumnoId).map((e) => e.nota!);
    const notasExamenes = respuestasExamen.filter((r) => r.alumnoId === alumnoId).map((r) => r.nota!);

    const promTareas = notasTareas.length > 0 ? notasTareas.reduce((s, n) => s + n, 0) / notasTareas.length : null;
    const promExamenes = notasExamenes.length > 0 ? notasExamenes.reduce((s, n) => s + n, 0) / notasExamenes.length : null;

    let notaFinal: number | null = null;
    if (promTareas != null && promExamenes != null)
      notaFinal = (promTareas * pesoTareas + promExamenes * pesoExamenes) / 100;
    else if (promTareas != null) notaFinal = promTareas;
    else if (promExamenes != null) notaFinal = promExamenes;

    const promedio = notaFinal !== null ? Math.round(notaFinal * 100) / 100 : null;
    promedios[alumnoId] = {
      promedioAnual: promedio,
      aprueba: promedio !== null && promedio >= notaAprobatoria,
    };
  }

  return { promedios, notaAprobatoria, esPrimaria };
}

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
      matriculas: {
        where: { anoLectivoId: anoActivo.id },
        select: { alumnoId: true, alumno: { select: { id: true, usuario: { select: { nombre: true } } } } },
      },
    },
  });

  const seccionesConAlumnos = secciones.filter((s) => s.matriculas.length > 0);

  // Calcula todos los promedios por sección en batch (evita N+1)
  const vistaPrevia = await Promise.all(
    seccionesConAlumnos.map(async (seccion) => {
      const alumnoIds = seccion.matriculas.map((m) => m.alumnoId);
      const resultado = await calcularPromediosSeccion(seccion.id, alumnoIds);
      const promedios = (resultado as any).promedios ?? {};

      const alumnos = seccion.matriculas.map(({ alumno }) => ({
        id: alumno.id,
        nombre: alumno.usuario.nombre,
        promedioAnual: promedios[alumno.id]?.promedioAnual ?? null,
        aprueba: promedios[alumno.id]?.aprueba ?? false,
      }));

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
  if (!decisiones?.length || !anoLectivoDestinoId) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  // Pre-carga todas las secciones del año destino para evitar N+1
  const seccionesDestino = await prisma.seccion.findMany({
    where: { anoLectivoId: anoLectivoDestinoId },
    select: { id: true, gradoId: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  // Pre-carga las secciones origen
  const seccionOrigenIds = [...new Set(decisiones.map((d: any) => d.seccionOrigenId))];
  const seccionesOrigen = await prisma.seccion.findMany({
    where: { id: { in: seccionOrigenIds as string[] } },
    select: { id: true, gradoId: true, grado: { select: { gradoSiguienteId: true } } },
  });
  const seccionOrigenMap = Object.fromEntries(seccionesOrigen.map((s) => [s.id, s]));

  // Obtiene monto promedio de matrículas existentes para usarlo en las nuevas
  const montoReferencia = await prisma.matricula.findFirst({
    where: { anoLectivoId: anoLectivoDestinoId, monto: { gt: 0 } },
    select: { monto: true, fechaVencimiento: true },
  });

  let promovidos = 0, repetidores = 0, egresados = 0;

  // Procesa en paralelo para mejor rendimiento
  await Promise.all(decisiones.map(async (d: any) => {
    if (d.accion === "EGRESAR") {
      await prisma.alumno.update({ where: { id: d.alumnoId }, data: { estado: "EGRESADO" } });
      egresados++;
      return;
    }

    const seccionOrigen = seccionOrigenMap[d.seccionOrigenId];
    if (!seccionOrigen) return;

    let gradoDestinoId: string | null = null;
    if (d.accion === "PROMOVER") {
      gradoDestinoId = seccionOrigen.grado.gradoSiguienteId ?? null;
    } else if (d.accion === "REPETIR") {
      gradoDestinoId = seccionOrigen.gradoId;
    }
    if (!gradoDestinoId) return;

    // Distribuye entre secciones disponibles del grado destino
    const seccionesDelGrado = seccionesDestino.filter((s) => s.gradoId === gradoDestinoId);
    if (seccionesDelGrado.length === 0) return;

    // Asigna a la sección con menos alumnos para distribuir equitativamente
    const conteos = await Promise.all(
      seccionesDelGrado.map(async (s) => ({
        id: s.id,
        count: await prisma.matricula.count({ where: { seccionId: s.id, anoLectivoId: anoLectivoDestinoId } }),
      }))
    );
    const seccionDestino = conteos.sort((a, b) => a.count - b.count)[0];

    await prisma.matricula.upsert({
      where: { alumnoId_anoLectivoId: { alumnoId: d.alumnoId, anoLectivoId: anoLectivoDestinoId } },
      update: { seccionId: seccionDestino.id },
      create: {
        alumnoId: d.alumnoId,
        anoLectivoId: anoLectivoDestinoId,
        seccionId: seccionDestino.id,
        monto: montoReferencia?.monto ?? 0,
        fechaVencimiento: montoReferencia?.fechaVencimiento ?? new Date(new Date().getFullYear() + 1, 2, 31),
      },
    });

    if (d.accion === "PROMOVER") promovidos++;
    else repetidores++;
  }));

  return NextResponse.json({ promovidos, repetidores, egresados });
}
