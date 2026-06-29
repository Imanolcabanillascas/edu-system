import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { nombre, nivelId, totalCiclos } = await req.json();
  if (!nombre?.trim() || !nivelId) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const numCiclos = Number(totalCiclos) || 0;
  if (numCiclos < 0 || numCiclos > 20) {
    return NextResponse.json({ error: "El número de ciclos debe estar entre 1 y 20" }, { status: 400 });
  }

  try {
    // Crea la carrera y, si se indicó un número de ciclos, los Grados "Ciclo 1"..."Ciclo N"
    // ya enlazados en secuencia (gradoSiguienteId) para que la promoción automática
    // de fin de periodo sepa a dónde mover a un alumno que aprueba cada ciclo.
    const carrera = await prisma.$transaction(async (tx) => {
      const nuevaCarrera = await tx.carrera.create({ data: { nombre: nombre.trim(), nivelId } });

      if (numCiclos > 0) {
        const ciclos = [];
        for (let i = 1; i <= numCiclos; i++) {
          const ciclo = await tx.grado.create({
            data: { nombre: `Ciclo ${i}`, nivelId, carreraId: nuevaCarrera.id, ordenSecuencia: i },
          });
          ciclos.push(ciclo);
        }
        // Enlaza cada ciclo con el siguiente (Ciclo 1 → Ciclo 2 → ... → Ciclo N → null = egresa)
        for (let i = 0; i < ciclos.length - 1; i++) {
          await tx.grado.update({ where: { id: ciclos[i].id }, data: { gradoSiguienteId: ciclos[i + 1].id } });
        }
      }

      return nuevaCarrera;
    });

    return NextResponse.json(carrera, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe una carrera con ese nombre en este nivel" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id, nombre } = await req.json();
  try {
    const carrera = await prisma.carrera.update({ where: { id }, data: { nombre: nombre.trim() } });
    return NextResponse.json(carrera);
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe una carrera con ese nombre en este nivel" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await req.json();
  try {
    await prisma.carrera.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "No se puede eliminar: tiene grados asociados" }, { status: 409 });
  }
}
