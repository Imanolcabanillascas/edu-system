import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const claseId = searchParams.get("claseId");
  if (!claseId) return NextResponse.json({ error: "Falta claseId" }, { status: 400 });
  const materiales = await prisma.material.findMany({
    where: { claseId }, orderBy: { createdAt: "desc" },
    select: { id: true, titulo: true, descripcion: true, tipo: true, url: true, contenido: true, createdAt: true },
  });
  return NextResponse.json(materiales);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol === "ALUMNO") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { claseId, titulo, descripcion, tipo, url, contenido } = await req.json();
  if (!claseId || !titulo?.trim()) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  const material = await prisma.material.create({
    data: { claseId, titulo: titulo.trim(), descripcion, tipo: tipo ?? "ARCHIVO", url: url || null, contenido: contenido || null },
    select: { id: true, titulo: true, tipo: true, createdAt: true },
  });
  return NextResponse.json(material, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol === "ALUMNO") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await req.json();
  await prisma.material.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
