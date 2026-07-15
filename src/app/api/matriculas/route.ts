import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nowPeru } from "@/lib/utils";

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

  const alumnoSelect = { select: { dni: true, usuario: { select: { nombre: true } } } };
  const anoLectivoSelect = { select: { anio: true } };

  let matriculas;
  if (usuario.rol === "ALUMNO" && usuario.alumno) {
    matriculas = await prisma.matricula.findMany({
      where: { alumnoId: usuario.alumno.id },
      select: {
        id: true, monto: true, fechaVencimiento: true, fechaPago: true,
        medioPago: true, estado: true, observaciones: true,
        alumno: alumnoSelect, anoLectivo: anoLectivoSelect,
      },
    });
  } else {
    matriculas = await prisma.matricula.findMany({
      select: {
        id: true, monto: true, fechaVencimiento: true, fechaPago: true,
        medioPago: true, estado: true, observaciones: true,
        alumno: alumnoSelect, anoLectivo: anoLectivoSelect,
      },
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

  const { alumnoId, anoLectivoId, monto, fechaVencimiento, observaciones, medioPago, marcarPagada } = await req.json();
  if (!alumnoId || !anoLectivoId || !monto || !fechaVencimiento) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const matricula = await prisma.matricula.upsert({
    where: { alumnoId },
    update: {
      anoLectivoId, monto: Number(monto), fechaVencimiento: new Date(fechaVencimiento), observaciones,
      estado: marcarPagada ? "PAGADO" : "PENDIENTE",
      medioPago: marcarPagada ? medioPago : null,
      fechaPago: marcarPagada ? nowPeru() : null,
    },
    create: {
      alumnoId, anoLectivoId, monto: Number(monto), fechaVencimiento: new Date(fechaVencimiento), observaciones,
      estado: marcarPagada ? "PAGADO" : "PENDIENTE",
      medioPago: marcarPagada ? medioPago : null,
      fechaPago: marcarPagada ? nowPeru() : null,
    },
    select: {
      id: true, monto: true, estado: true,
      alumno: { select: { dni: true, usuario: { select: { nombre: true } } } },
      anoLectivo: { select: { anio: true } },
    },
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
    select: {
      id: true, monto: true, estado: true,
      alumno: { select: { dni: true, usuario: { select: { nombre: true } } } },
      anoLectivo: { select: { anio: true } },
    },
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
