import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const anoLectivoId = searchParams.get("anoLectivoId");
  const periodos = await prisma.periodo.findMany({
    where: anoLectivoId ? { anoLectivoId } : {},
    orderBy: { orden: "asc" },
    select: { id: true, nombre: true, tipo: true, orden: true, fechaInicio: true, fechaFin: true, activo: true, anoLectivo: { select: { anio: true } } },
  });
  return NextResponse.json(periodos);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { anoLectivoId, nombre, tipo, orden, fechaInicio, fechaFin } = await req.json();
  if (!anoLectivoId || !nombre || !fechaInicio || !fechaFin) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  try {
    const periodo = await prisma.periodo.create({
      data: { anoLectivoId, nombre, tipo: tipo ?? "BIMESTRE", orden: Number(orden) || 1, fechaInicio: new Date(fechaInicio), fechaFin: new Date(fechaFin) },
      select: { id: true, nombre: true, tipo: true, orden: true, fechaInicio: true, fechaFin: true, activo: true },
    });
    return NextResponse.json(periodo, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe un período con ese orden en este año" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id, nombre, fechaInicio, fechaFin, activo } = await req.json();
  const periodo = await prisma.periodo.update({
    where: { id }, data: { nombre, fechaInicio: new Date(fechaInicio), fechaFin: new Date(fechaFin), activo: activo ?? false },
    select: { id: true, nombre: true, activo: true },
  });
  return NextResponse.json(periodo);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await req.json();
  try { await prisma.periodo.delete({ where: { id } }); return NextResponse.json({ ok: true }); }
  catch (e: any) { return NextResponse.json({ error: "No se puede eliminar: tiene tareas o exámenes asociados" }, { status: 409 }); }
}
