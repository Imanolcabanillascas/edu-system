import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { asegurarGradosBase } from "@/lib/seed-grados";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const anos = await prisma.anoLectivo.findMany({ orderBy: { anio: "desc" } });
  return NextResponse.json(anos);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { anio, activo } = await req.json();
  if (!anio) return NextResponse.json({ error: "Indica el año" }, { status: 400 });

  try {
    // Si este año se marca activo, los demás dejan de estarlo (solo un año activo a la vez)
    const ano = await prisma.$transaction(async (tx) => {
      if (activo) await tx.anoLectivo.updateMany({ where: { activo: true }, data: { activo: false } });
      return tx.anoLectivo.create({ data: { anio: Number(anio), activo: !!activo } });
    });

    // Catálogo fijo de grados (1ro-6to Primaria, 1ro-5to Secundaria): se crea
    // una sola vez, la primera vez que se da de alta un año lectivo. Si ya
    // existe (de un año anterior), esta llamada no hace nada.
    await asegurarGradosBase();

    return NextResponse.json(ano, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ese año lectivo ya existe" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id, activo } = await req.json();

  const ano = await prisma.$transaction(async (tx) => {
    if (activo) await tx.anoLectivo.updateMany({ where: { activo: true }, data: { activo: false } });
    return tx.anoLectivo.update({ where: { id }, data: { activo: !!activo } });
  });
  return NextResponse.json(ano);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await req.json();
  try {
    await prisma.anoLectivo.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "No se puede eliminar: tiene secciones o matrículas asociadas" }, { status: 409 });
  }
}
