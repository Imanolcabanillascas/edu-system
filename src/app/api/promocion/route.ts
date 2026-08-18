import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { seccionOrigenId, alumnoIds, egresar, gradoDestinoId, anoLectivoDestinoId } = await req.json();

  if (!seccionOrigenId || !alumnoIds?.length) {
    return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
  }

  // Obtiene el año activo para saber de dónde vienen los alumnos
  const anoActivo = await prisma.anoLectivo.findFirst({
    where: { activo: true },
    select: { id: true },
  });
  if (!anoActivo) return NextResponse.json({ error: "No hay año lectivo activo" }, { status: 400 });

  let promovidos = 0, egresados = 0;

  for (const alumnoId of alumnoIds) {
    if (egresar) {
      await prisma.alumno.update({
        where: { id: alumnoId },
        data: { estado: "EGRESADO" },
      });
      egresados++;
      continue;
    }

    // Busca la primera sección disponible del grado destino en el año destino
    const seccionDestino = await prisma.seccion.findFirst({
      where: { gradoId: gradoDestinoId, anoLectivoId: anoLectivoDestinoId },
      select: { id: true },
    });
    if (!seccionDestino) continue;

    // Crea o actualiza la matrícula del año destino con la nueva sección
    await prisma.matricula.upsert({
      where: { alumnoId_anoLectivoId: { alumnoId, anoLectivoId: anoLectivoDestinoId } },
      update: { seccionId: seccionDestino.id },
      create: {
        alumnoId,
        anoLectivoId: anoLectivoDestinoId,
        seccionId: seccionDestino.id,
        monto: 0,
        fechaVencimiento: new Date(new Date().getFullYear() + 1, 2, 31),
      },
    });
    promovidos++;
  }

  return NextResponse.json({
    ok: true,
    promovidos,
    egresados,
    mensaje: egresar
      ? `${egresados} alumno(s) egresado(s)`
      : `${promovidos} alumno(s) promovido(s) al grado destino`,
  });
}
