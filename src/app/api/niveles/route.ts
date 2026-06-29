import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const NIVELES_BASE: { tipo: "PRIMARIA" | "SECUNDARIA"; nombre: string }[] = [
  { tipo: "PRIMARIA", nombre: "Primaria" },
  { tipo: "SECUNDARIA", nombre: "Secundaria" },
];

// Los 2 niveles son fijos en el sistema (no se crean ni eliminan); se siembran
// automáticamente la primera vez. El nombre visible sí es editable por el admin.
async function asegurarNiveles() {
  const existentes = await prisma.nivel.count();
  if (existentes === 2) return;
  for (const n of NIVELES_BASE) {
    await prisma.nivel.upsert({ where: { tipo: n.tipo }, update: {}, create: n });
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await asegurarNiveles();

  const { searchParams } = new URL(req.url);
  let anoLectivoId = searchParams.get("anoLectivoId");

  // Por defecto, mostrar las secciones del año lectivo activo
  if (!anoLectivoId) {
    const activo = await prisma.anoLectivo.findFirst({ where: { activo: true }, select: { id: true } });
    anoLectivoId = activo?.id ?? null;
  }

  const niveles = await prisma.nivel.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      grados: {
        orderBy: [{ ordenSecuencia: "asc" }, { createdAt: "asc" }],
        include: {
          secciones: {
            where: anoLectivoId ? { anoLectivoId } : undefined,
            orderBy: { createdAt: "asc" },
            include: { anoLectivo: true },
          },
          gradoSiguiente: { select: { id: true, nombre: true } },
        },
      },
    },
  });
  return NextResponse.json(niveles);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id, nombre } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });

  const nivel = await prisma.nivel.update({ where: { id }, data: { nombre: nombre.trim() } });
  return NextResponse.json(nivel);
}
