import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST: el alumno envía sus respuestas. El sistema calcula la nota automáticamente.
// Fórmula: nota = (preguntas correctas / total preguntas) × 20
// Si hay puntajes distintos por pregunta: nota = (suma puntajes correctas / suma total puntajes) × 20
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: { rol: true, alumno: { select: { id: true } } },
  });
  if (usuario?.rol !== "ALUMNO" || !usuario.alumno) {
    return NextResponse.json({ error: "Solo los alumnos pueden responder exámenes" }, { status: 403 });
  }

  const alumnoId = usuario.alumno.id;
  const { examenId, respuestas } = await req.json();
  // respuestas: [{ preguntaId, opcionId }]

  if (!examenId || !Array.isArray(respuestas)) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  // Verifica que el examen existe, es de tipo SELECCION y no fue respondido ya
  const examen = await prisma.examen.findUnique({
    where: { id: examenId },
    select: {
      id: true, tipo: true, fechaLimite: true,
      preguntas: {
        select: {
          id: true, puntaje: true,
          opciones: { select: { id: true, correcta: true } },
        },
      },
    },
  });
  if (!examen) return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 });
  if (examen.tipo !== "SELECCION") return NextResponse.json({ error: "Este examen no es de selección múltiple" }, { status: 400 });

  const yaExiste = await prisma.respuestaExamen.findUnique({
    where: { examenId_alumnoId: { examenId, alumnoId } },
    select: { id: true },
  });
  if (yaExiste) return NextResponse.json({ error: "Ya enviaste este examen" }, { status: 409 });

  const ahora = new Date();
  const fueraDeplazo = ahora > new Date(examen.fechaLimite);

  // Calcula la nota: suma puntajes de las preguntas respondidas correctamente
  let puntajeObtenido = 0;
  let puntajeTotal = 0;

  const validacionRespuestas: { preguntaId: string; opcionId: string; esCorrecta: boolean }[] = [];

  for (const pregunta of examen.preguntas) {
    puntajeTotal += pregunta.puntaje;
    const respuestaAlumno = respuestas.find((r: any) => r.preguntaId === pregunta.id);
    if (!respuestaAlumno) continue;

    const opcionElegida = pregunta.opciones.find((o) => o.id === respuestaAlumno.opcionId);
    const esCorrecta = opcionElegida?.correcta ?? false;
    if (esCorrecta) puntajeObtenido += pregunta.puntaje;

    validacionRespuestas.push({ preguntaId: pregunta.id, opcionId: respuestaAlumno.opcionId, esCorrecta });
  }

  const nota = puntajeTotal > 0 ? Math.round((puntajeObtenido / puntajeTotal) * 20 * 100) / 100 : 0;

  // Crea la RespuestaExamen con todas las RespuestaPreguntas en una sola transacción
  const respuestaExamen = await prisma.respuestaExamen.create({
    data: {
      examenId, alumnoId,
      nota,
      estado: fueraDeplazo ? "FUERA_DE_PLAZO" : "CALIFICADO",
      fechaEntrega: ahora,
      respuestasPreguntas: {
        create: validacionRespuestas.map((r) => ({
          preguntaId: r.preguntaId,
          opcionId: r.opcionId,
        })),
      },
    },
    select: {
      id: true, nota: true, estado: true,
      respuestasPreguntas: { select: { preguntaId: true, opcionId: true } },
    },
  });

  // Devuelve también qué preguntas fueron correctas (para mostrar al alumno el resultado)
  return NextResponse.json({
    nota,
    estado: respuestaExamen.estado,
    correctas: validacionRespuestas.filter((r) => r.esCorrecta).length,
    total: examen.preguntas.length,
    detalle: validacionRespuestas,
  });
}
