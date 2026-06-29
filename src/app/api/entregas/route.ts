import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { yaVencio } from "@/lib/utils";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    include: { alumno: true },
  });
  if (!usuario) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { tareaId, alumnoId, nota, comentario } = await req.json();

  if (usuario.rol === "ALUMNO" && usuario.alumno) {
    const tarea = await prisma.tarea.findUnique({ where: { id: tareaId } });
    if (!tarea) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

    const fueraDePlazo = yaVencio(tarea.fechaLimite);
    const entrega = await prisma.entrega.upsert({
      where: { tareaId_alumnoId: { tareaId, alumnoId: usuario.alumno.id } },
      update: { estado: fueraDePlazo ? "FUERA_DE_PLAZO" : "ENTREGADA", fechaEntrega: new Date() },
      create: { tareaId, alumnoId: usuario.alumno.id, estado: fueraDePlazo ? "FUERA_DE_PLAZO" : "ENTREGADA", fechaEntrega: new Date() },
    });
    return NextResponse.json(entrega);
  }

  if (usuario.rol === "PROFESOR" || usuario.rol === "ADMIN") {
    const entrega = await prisma.entrega.upsert({
      where: { tareaId_alumnoId: { tareaId, alumnoId } },
      update: { nota, comentario, estado: "CALIFICADA" },
      create: { tareaId, alumnoId, nota, comentario, estado: "CALIFICADA" },
    });
    return NextResponse.json(entrega);
  }

  return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
}
