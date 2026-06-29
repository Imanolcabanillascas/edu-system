import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const niveles = await prisma.nivel.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, nombre: true, tipo: true, criterio: true },
  });
  return NextResponse.json(niveles);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { nivelId, pesoTareas, pesoExamenes, notaAprobatoria } = await req.json();
  if (!nivelId) return NextResponse.json({ error: "Falta el nivel" }, { status: 400 });

  const pt = Number(pesoTareas);
  const pe = Number(pesoExamenes);
  if (pt + pe !== 100) {
    return NextResponse.json({ error: "El peso de tareas y exámenes debe sumar 100%" }, { status: 400 });
  }
  if (pt < 0 || pe < 0) {
    return NextResponse.json({ error: "Los pesos no pueden ser negativos" }, { status: 400 });
  }
  const nota = Number(notaAprobatoria);
  if (!nota || nota < 0 || nota > 20) {
    return NextResponse.json({ error: "La nota aprobatoria debe estar entre 0 y 20" }, { status: 400 });
  }

  const criterio = await prisma.criterioEvaluacion.upsert({
    where: { nivelId },
    update: { pesoTareas: pt, pesoExamenes: pe, notaAprobatoria: nota },
    create: { nivelId, pesoTareas: pt, pesoExamenes: pe, notaAprobatoria: nota },
  });
  return NextResponse.json(criterio);
}
