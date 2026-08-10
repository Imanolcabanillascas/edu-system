import { prisma } from "@/lib/prisma";

const CRITERIO_DEFAULT = { pesoTareas: 40, pesoExamenes: 60, notaAprobatoria: 10.5, usaEscalaLiteral: false, maxMateriasDesaprob: 0 };

export function escalaLiteral(nota: number): string {
  if (nota >= 18) return "AD";
  if (nota >= 14) return "A";
  if (nota >= 11) return "B";
  return "C";
}

async function getSeccionIdAlumno(alumnoId: string): Promise<string | null> {
  const anoActivo = await prisma.anoLectivo.findFirst({ where: { activo: true }, select: { id: true } });
  if (!anoActivo) return null;
  const matricula = await prisma.matricula.findUnique({
    where: { alumnoId_anoLectivoId: { alumnoId, anoLectivoId: anoActivo.id } },
    select: { seccionId: true },
  });
  return matricula?.seccionId ?? null;
}

export async function calcularPromedioAlumno(alumnoId: string, periodoId?: string) {
  const seccionId = await getSeccionIdAlumno(alumnoId);
  if (!seccionId) return { promedioAnual: null, materias: [], criterio: CRITERIO_DEFAULT, puedePromover: false, materiasDesaprobadas: 0, esPrimaria: false };

  const seccion = await prisma.seccion.findUnique({
    where: { id: seccionId },
    select: { grado: { select: { nivelId: true, nivel: { select: { tipo: true } } } } },
  });

  const criterioDb = seccion?.grado.nivelId
    ? await prisma.criterioEvaluacion.findUnique({ where: { nivelId: seccion.grado.nivelId } })
    : null;

  const criterio = criterioDb
    ? { pesoTareas: criterioDb.pesoTareas, pesoExamenes: criterioDb.pesoExamenes, notaAprobatoria: criterioDb.notaAprobatoria, usaEscalaLiteral: criterioDb.usaEscalaLiteral, maxMateriasDesaprob: criterioDb.maxMateriasDesaprob }
    : CRITERIO_DEFAULT;

  const whereEntregas: any = { alumnoId };
  const whereRespuestas: any = { alumnoId };
  if (periodoId) { whereEntregas.tarea = { periodoId }; whereRespuestas.examen = { periodoId }; }

  const clases = await prisma.clase.findMany({
    where: { seccionId },
    select: {
      id: true,
      planEstudio: { select: { materia: { select: { nombre: true } } } },
      tareas: { select: { entregas: { where: whereEntregas, select: { nota: true } } } },
      examenes: { select: { respuestas: { where: whereRespuestas, select: { nota: true } } } },
    },
  });

  const materias = clases.map((clase) => {
    const notasTareas = clase.tareas.flatMap((t) => t.entregas.map((e) => e.nota)).filter((n): n is number => n != null);
    const notasExamenes = clase.examenes.flatMap((e) => e.respuestas.map((r) => r.nota)).filter((n): n is number => n != null);
    const promTareas = notasTareas.length > 0 ? notasTareas.reduce((s, n) => s + n, 0) / notasTareas.length : null;
    const promExamenes = notasExamenes.length > 0 ? notasExamenes.reduce((s, n) => s + n, 0) / notasExamenes.length : null;
    let notaFinal: number | null = null;
    if (promTareas != null && promExamenes != null) notaFinal = (promTareas * criterio.pesoTareas + promExamenes * criterio.pesoExamenes) / 100;
    else if (promTareas != null) notaFinal = promTareas;
    else if (promExamenes != null) notaFinal = promExamenes;
    const notaRedondeada = notaFinal !== null ? Math.round(notaFinal * 100) / 100 : null;
    const aprueba = notaRedondeada !== null && notaRedondeada >= criterio.notaAprobatoria;
    return {
      claseId: clase.id, materia: clase.planEstudio.materia.nombre,
      promedioTareas: promTareas !== null ? Math.round(promTareas * 100) / 100 : null,
      promedioExamenes: promExamenes !== null ? Math.round(promExamenes * 100) / 100 : null,
      notaFinal: notaRedondeada,
      escala: notaRedondeada !== null && criterio.usaEscalaLiteral ? escalaLiteral(notaRedondeada) : null,
      aprueba, cantidadNotasTareas: notasTareas.length, cantidadNotasExamenes: notasExamenes.length,
    };
  });

  const materiasConNota = materias.filter((m) => m.notaFinal !== null);
  const promedioAnual = materiasConNota.length > 0 ? Math.round((materiasConNota.reduce((s, m) => s + m.notaFinal!, 0) / materiasConNota.length) * 100) / 100 : null;
  const materiasDesaprobadas = materias.filter((m) => m.notaFinal !== null && !m.aprueba).length;
  const esPrimaria = seccion?.grado.nivel.tipo === "PRIMARIA";
  const puedePromover = esPrimaria
    ? (promedioAnual !== null && promedioAnual >= criterio.notaAprobatoria)
    : (materiasDesaprobadas <= criterio.maxMateriasDesaprob);

  const escala = promedioAnual !== null && criterio.usaEscalaLiteral ? escalaLiteral(promedioAnual) : null;
  return { promedioAnual, escala, materias, criterio, puedePromover, materiasDesaprobadas, esPrimaria };
}
