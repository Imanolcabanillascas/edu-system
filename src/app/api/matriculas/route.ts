import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nowPeru } from "@/lib/utils";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Auto-actualizar vencidas según la hora actual de Perú
  await prisma.matricula.updateMany({
    where: { estado: "PENDIENTE", fechaVencimiento: { lt: nowPeru() } },
    data: { estado: "VENCIDO" },
  });

  const usuario = await prisma.usuario.findUnique({ where: { id: (session.user as any).id }, include: { alumno: true } });
  if (!usuario) return NextResponse.json([]);

  let matriculas;
  if (usuario.rol === "ALUMNO" && usuario.alumno) {
    matriculas = await prisma.matricula.findMany({
      where: { alumnoId: usuario.alumno.id },
      include: { alumno: { include: { usuario: true } } },
    });
  } else {
    matriculas = await prisma.matricula.findMany({
      include: { alumno: { include: { usuario: true } } },
      orderBy: { fechaVencimiento: "asc" },
    });
  }

  return NextResponse.json(matriculas);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { alumnoId, anoLectivo, monto, fechaVencimiento, observaciones, medioPago, marcarPagada } = await req.json();

  const matricula = await prisma.matricula.upsert({
    where: { alumnoId },
    update: {
      anoLectivo, monto: Number(monto), fechaVencimiento: new Date(fechaVencimiento), observaciones,
      estado: marcarPagada ? "PAGADO" : "PENDIENTE",
      medioPago: marcarPagada ? medioPago : null,
      fechaPago: marcarPagada ? nowPeru() : null,
    },
    create: {
      alumnoId, anoLectivo, monto: Number(monto), fechaVencimiento: new Date(fechaVencimiento), observaciones,
      estado: marcarPagada ? "PAGADO" : "PENDIENTE",
      medioPago: marcarPagada ? medioPago : null,
      fechaPago: marcarPagada ? nowPeru() : null,
    },
    include: { alumno: { include: { usuario: true } } },
  });
  return NextResponse.json(matricula, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id, estado, medioPago, observaciones } = await req.json();

  const matricula = await prisma.matricula.update({
    where: { id },
    data: {
      estado,
      medioPago: estado === "PAGADO" ? medioPago : null,
      fechaPago: estado === "PAGADO" ? nowPeru() : null,
      observaciones,
    },
    include: { alumno: { include: { usuario: true } } },
  });
  return NextResponse.json(matricula);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await req.json();
  await prisma.matricula.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
