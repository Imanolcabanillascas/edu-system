import { prisma } from "@/lib/prisma";

const CRITERIO_DEFAULT = { pesoTareas: 40, pesoExamenes: 60, notaAprobatoria: 10.5 };

export async function calcularPromedioAlumno(alumnoId: string) {
  const alumno = await prisma.alumno.findUnique({
    where: { id: alumnoId },
    select: { seccionId: true, seccion: { select: { grado: { select: { nivelId: true } } } } },
  });
  if (!alumno?.seccionId) return { promedioAnual: null, materias: [], criterio: CRITERIO_DEFAULT };

  const criterio = alumno.seccion?.grado.nivelId
    ? await prisma.criterioEvaluacion.findUnique({ where: { nivelId: alumno.seccion.grado.nivelId } })
    : null;
  const pesos = criterio
    ? { pesoTareas: criterio.pesoTareas, pesoExamenes: criterio.pesoExamenes, notaAprobatoria: criterio.notaAprobatoria }
    : CRITERIO_DEFAULT;

  const clases = await prisma.clase.findMany({
    where: { seccionId: alumno.seccionId },
    select: {
      id: true,
      planEstudio: { select: { materia: { select: { nombre: true } } } },
      tareas: { select: { entregas: { where: { alumnoId }, select: { nota: true } } } },
      examenes: { select: { respuestas: { where: { alumnoId }, select: { nota: true } } } },
    },
  });

  const materias = clases.map((clase) => {
    const notasTareas = clase.tareas.flatMap((t) => t.entregas.map((e) => e.nota)).filter((n): n is number => n != null);
    const notasExamenes = clase.examenes.flatMap((e) => e.respuestas.map((r) => r.nota)).filter((n): n is number => n != null);

    const promTareas = notasTareas.length > 0 ? notasTareas.reduce((s, n) => s + n, 0) / notasTareas.length : null;
    const promExamenes = notasExamenes.length > 0 ? notasExamenes.reduce((s, n) => s + n, 0) / notasExamenes.length : null;

    let notaFinal: number | null = null;
    if (promTareas != null && promExamenes != null) {
      notaFinal = (promTareas * pesos.pesoTareas + promExamenes * pesos.pesoExamenes) / 100;
    } else if (promTareas != null) {
      notaFinal = promTareas;
    } else if (promExamenes != null) {
      notaFinal = promExamenes;
    }

    return {
      claseId: clase.id,
      materia: clase.planEstudio.materia.nombre,
      promedioTareas: promTareas !== null ? Math.round(promTareas * 100) / 100 : null,
      promedioExamenes: promExamenes !== null ? Math.round(promExamenes * 100) / 100 : null,
      notaFinal: notaFinal !== null ? Math.round(notaFinal * 100) / 100 : null,
      cantidadNotasTareas: notasTareas.length,
      cantidadNotasExamenes: notasExamenes.length,
    };
  });

  const materiasConNota = materias.filter((m) => m.notaFinal !== null);
  const promedioAnual = materiasConNota.length > 0
    ? Math.round((materiasConNota.reduce((s, m) => s + m.notaFinal!, 0) / materiasConNota.length) * 100) / 100
    : null;

  return { promedioAnual, materias, criterio: pesos };
}
