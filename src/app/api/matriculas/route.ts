import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nowPeru } from "@/lib/utils";

const matriculaSelect = {
  id: true, monto: true, fechaVencimiento: true, fechaPago: true,
  medioPago: true, estado: true, observaciones: true, anoLectivoId: true,
  alumno: { select: { id: true, dni: true, usuario: { select: { nombre: true } } } },
  anoLectivo: { select: { anio: true } },
  seccion: { select: { id: true, nombre: true, grado: { select: { nombre: true, nivel: { select: { nombre: true } } } } } },
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await prisma.matricula.updateMany({
    where: { estado: "PENDIENTE", fechaVencimiento: { lt: nowPeru() } },
    data: { estado: "VENCIDO" },
  });

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: { rol: true, alumno: { select: { id: true } } },
  });
  if (!usuario) return NextResponse.json([]);

  if (usuario.rol === "ALUMNO" && usuario.alumno) {
    const matriculas = await prisma.matricula.findMany({
      where: { alumnoId: usuario.alumno.id },
      select: matriculaSelect,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(matriculas);
  }

  const matriculas = await prisma.matricula.findMany({
    select: matriculaSelect,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(matriculas);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { alumnoId, anoLectivoId, seccionId, monto, fechaVencimiento, observaciones, medioPago, marcarPagada } = await req.json();
  if (!alumnoId || !anoLectivoId || !monto || !fechaVencimiento) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  try {
    const matricula = await prisma.matricula.upsert({
      where: { alumnoId_anoLectivoId: { alumnoId, anoLectivoId } },
      update: {
        seccionId: seccionId || null,
        monto: Number(monto),
        fechaVencimiento: new Date(fechaVencimiento),
        observaciones: observaciones || null,
        estado: marcarPagada ? "PAGADO" : "PENDIENTE",
        medioPago: marcarPagada ? (medioPago ?? null) : null,
        fechaPago: marcarPagada ? nowPeru() : null,
      },
      create: {
        alumnoId, anoLectivoId,
        seccionId: seccionId || null,
        monto: Number(monto),
        fechaVencimiento: new Date(fechaVencimiento),
        observaciones: observaciones || null,
        estado: marcarPagada ? "PAGADO" : "PENDIENTE",
        medioPago: marcarPagada ? (medioPago ?? null) : null,
        fechaPago: marcarPagada ? nowPeru() : null,
      },
      select: matriculaSelect,
    });
    return NextResponse.json(matricula, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { id, estado, medioPago, observaciones, seccionId, monto, fechaVencimiento } = body;

  const data: any = {};

  // Actualizar estado
  if (estado !== undefined) {
    data.estado = estado;
    data.medioPago = estado === "PAGADO" ? (medioPago ?? null) : null;
    data.fechaPago = estado === "PAGADO" ? nowPeru() : null;
  }

  // Actualizar sección
  if (seccionId !== undefined) data.seccionId = seccionId || null;

  // Actualizar observaciones
  if (observaciones !== undefined) data.observaciones = observaciones || null;

  // Actualizar costo y vencimiento
  if (monto !== undefined) data.monto = Number(monto);
  if (fechaVencimiento !== undefined) data.fechaVencimiento = new Date(fechaVencimiento);

  const matricula = await prisma.matricula.update({
    where: { id },
    data,
    select: matriculaSelect,
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
