import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: devuelve un examen de selección con sus preguntas y opciones.
// Para el alumno: las preguntas y opciones vienen barajadas (seed=alumnoId)
// y sin indicar cuál es la correcta. Para el profesor: orden original + correcta visible.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const examenId = searchParams.get("examenId");
  if (!examenId) return NextResponse.json({ error: "Falta examenId" }, { status: 400 });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: { rol: true, alumno: { select: { id: true } } },
  });

  const examen = await prisma.examen.findUnique({
    where: { id: examenId },
    select: {
      id: true, titulo: true, descripcion: true, tipo: true,
      fechaInicio: true, fechaLimite: true, duracion: true, claseId: true,
      preguntas: {
        orderBy: { orden: "asc" },
        select: {
          id: true, texto: true, orden: true, puntaje: true,
          opciones: {
            orderBy: { orden: "asc" },
            select: {
              id: true, texto: true, orden: true,
              // El alumno no ve cuál es la correcta hasta después de enviar
              correcta: usuario?.rol !== "ALUMNO",
            },
          },
        },
      },
    },
  });
  if (!examen) return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 });

  // Si es alumno: barajamos usando su ID como semilla determinista
  // (mismo orden en cada carga, distinto al de otros alumnos)
  if (usuario?.rol === "ALUMNO" && usuario.alumno) {
    const seed = usuario.alumno.id;
    const shuffle = <T>(arr: T[], salt: string): T[] => {
      const seeded = [...arr].map((item, i) => ({ item, sort: hashCode(seed + salt + i) }));
      return seeded.sort((a, b) => a.sort - b.sort).map((x) => x.item);
    };

    examen.preguntas = shuffle(examen.preguntas, "preguntas") as any;
    examen.preguntas = examen.preguntas.map((p: any) => ({
      ...p,
      opciones: shuffle(p.opciones, p.id),
    }));

    // ¿Ya respondió este examen?
    const yaRespondio = await prisma.respuestaExamen.findUnique({
      where: { examenId_alumnoId: { examenId, alumnoId: usuario.alumno.id } },
      select: { id: true, estado: true, nota: true, respuestasPreguntas: { select: { preguntaId: true, opcionId: true } } },
    });
    return NextResponse.json({ examen, yaRespondio });
  }

  return NextResponse.json({ examen, yaRespondio: null });
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// POST: crea un examen de tipo SELECCION con sus preguntas y opciones en un solo paso.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "PROFESOR") {
    return NextResponse.json({ error: "Solo los profesores pueden crear exámenes" }, { status: 403 });
  }

  const profesor = await prisma.profesor.findUnique({
    where: { usuarioId: (session.user as any).id },
    select: { id: true },
  });
  if (!profesor) return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });

  const { titulo, descripcion, claseId, fechaInicio, fechaLimite, duracion, salon, preguntas } = await req.json();

  if (!titulo || !claseId || !fechaLimite || !preguntas?.length) {
    return NextResponse.json({ error: "Faltan campos obligatorios o no hay preguntas" }, { status: 400 });
  }

  // Valida que cada pregunta tenga exactamente una opción correcta
  for (const p of preguntas) {
    if (!p.texto?.trim()) return NextResponse.json({ error: "Todas las preguntas deben tener texto" }, { status: 400 });
    if (!p.opciones || p.opciones.length < 2) return NextResponse.json({ error: "Cada pregunta debe tener al menos 2 opciones" }, { status: 400 });
    const correctas = p.opciones.filter((o: any) => o.correcta).length;
    if (correctas !== 1) return NextResponse.json({ error: `La pregunta "${p.texto.slice(0, 30)}…" debe tener exactamente 1 opción correcta` }, { status: 400 });
  }

  const examen = await prisma.examen.create({
    data: {
      titulo, descripcion, claseId, profesorId: profesor.id,
      tipo: "SELECCION",
      fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
      fechaLimite: new Date(fechaLimite),
      duracion: Number(duracion) || 60,
      salon: salon || null,
      preguntas: {
        create: preguntas.map((p: any, pi: number) => ({
          texto: p.texto.trim(),
          orden: pi,
          puntaje: Number(p.puntaje) || 1,
          opciones: {
            create: p.opciones.map((o: any, oi: number) => ({
              texto: o.texto.trim(),
              correcta: !!o.correcta,
              orden: oi,
            })),
          },
        })),
      },
    },
    select: {
      id: true, titulo: true, tipo: true, fechaLimite: true,
      preguntas: { select: { id: true, texto: true, opciones: { select: { id: true, texto: true, correcta: true } } } },
    },
  });

  return NextResponse.json(examen, { status: 201 });
}

// PUT: actualiza preguntas y opciones de un examen de selección existente.
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "PROFESOR") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id, titulo, descripcion, fechaInicio, fechaLimite, duracion, salon, preguntas } = await req.json();

  for (const p of preguntas) {
    const correctas = p.opciones.filter((o: any) => o.correcta).length;
    if (correctas !== 1) return NextResponse.json({ error: `Cada pregunta debe tener exactamente 1 opción correcta` }, { status: 400 });
  }

  const examen = await prisma.$transaction(async (tx) => {
    // Borra preguntas anteriores (cascade borra opciones y respuestasPreguntas)
    await tx.pregunta.deleteMany({ where: { examenId: id } });

    return tx.examen.update({
      where: { id },
      data: {
        titulo, descripcion,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
        fechaLimite: new Date(fechaLimite),
        duracion: Number(duracion),
        salon: salon || null,
        preguntas: {
          create: preguntas.map((p: any, pi: number) => ({
            texto: p.texto.trim(), orden: pi, puntaje: Number(p.puntaje) || 1,
            opciones: { create: p.opciones.map((o: any, oi: number) => ({ texto: o.texto.trim(), correcta: !!o.correcta, orden: oi })) },
          })),
        },
      },
      select: { id: true, titulo: true, tipo: true },
    });
  });

  return NextResponse.json(examen);
}
