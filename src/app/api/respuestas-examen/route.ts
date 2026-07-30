import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: { rol: true, alumno: { select: { id: true } } },
  });

  const body = await req.json();

  if (usuario?.rol === "ALUMNO" && usuario.alumno) {
    const { examenId, archivoUrl, archivoNombre } = body;

    const examen = await prisma.examen.findUnique({
      where: { id: examenId },
      select: { fechaLimite: true },
    });

    const fueraDePlazo = examen ? new Date() > new Date(examen.fechaLimite) : false;

    const respuesta = await prisma.respuestaExamen.upsert({
      where: { examenId_alumnoId: { examenId, alumnoId: usuario.alumno.id } },
      update: {
        archivoUrl, archivoNombre,
        estado: fueraDePlazo ? "FUERA_DE_PLAZO" : "ENTREGADO",
        fechaEntrega: new Date(),
      },
      create: {
        examenId, alumnoId: usuario.alumno.id,
        archivoUrl, archivoNombre,
        estado: fueraDePlazo ? "FUERA_DE_PLAZO" : "ENTREGADO",
        fechaEntrega: new Date(),
      },
    });
    return NextResponse.json(respuesta);
  }

  if (usuario?.rol === "PROFESOR" || usuario?.rol === "ADMIN") {
    const { examenId, alumnoId, nota, comentario } = body;
    const respuesta = await prisma.respuestaExamen.update({
      where: { examenId_alumnoId: { examenId, alumnoId } },
      data: { nota, comentario, estado: "CALIFICADO" },
    });
    return NextResponse.json(respuesta);
  }

  return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
}