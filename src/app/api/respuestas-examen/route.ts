import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { yaVencio } from "@/lib/utils";

// El alumno envía sus respuestas de selección múltiple; se califica automáticamente
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({ where: { id: (session.user as any).id }, include: { alumno: true } });
  if (!usuario?.alumno) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { examenId, respuestas } = await req.json(); // respuestas: [{ preguntaId, opcionElegida }]

  const examen = await prisma.examen.findUnique({ where: { id: examenId }, include: { preguntas: true } });
  if (!examen) return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 });

  if (yaVencio(examen.fechaLimite)) {
    return NextResponse.json({ error: "El plazo para este examen ya venció" }, { status: 400 });
  }

  let correctas = 0;
  for (const r of respuestas) {
    const pregunta = examen.preguntas.find((p) => p.id === r.preguntaId);
    if (pregunta && pregunta.correcta === r.opcionElegida) correctas++;
  }
  const nota = examen.preguntas.length > 0 ? Math.round((correctas / examen.preguntas.length) * 20 * 100) / 100 : 0;

  const respuestaExamen = await prisma.respuestaExamen.upsert({
    where: { examenId_alumnoId: { examenId, alumnoId: usuario.alumno.id } },
    update: { nota, enviado: true },
    create: { examenId, alumnoId: usuario.alumno.id, nota, enviado: true },
  });

  await prisma.respuestaPregunta.deleteMany({ where: { respuestaExamenId: respuestaExamen.id } });
  await prisma.respuestaPregunta.createMany({
    data: respuestas.map((r: any) => ({
      respuestaExamenId: respuestaExamen.id,
      preguntaId: r.preguntaId,
      opcionElegida: r.opcionElegida,
    })),
  });

  return NextResponse.json({ nota, correctas, total: examen.preguntas.length });
}
