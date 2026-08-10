import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const POR_PAGINA = 20;

// select compartido — incluye la matrícula activa para saber
// la sección actual del alumno (nuevo modelo)
const alumnoSelect = {
  id: true, dni: true, fechaNac: true, anoIngreso: true, estado: true,
  tutorDni: true, tutorNombre: true, tutorTelefono: true,
  usuario: { select: { id: true, nombre: true, email: true } },
  matriculas: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      id: true, estado: true, anoLectivoId: true,
      seccion: { select: { id: true, nombre: true, gradoId: true, grado: { select: { nombre: true, nivel: { select: { nombre: true, tipo: true } } } } } },
    },
  },
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const estado = searchParams.get("estado") ?? "ACTIVO";
  const search = searchParams.get("search")?.trim() ?? "";
  const all = searchParams.get("all") === "true";

  const where: any = { estado };
  if (search) {
    where.OR = [
      { usuario: { nombre: { contains: search, mode: "insensitive" } } },
      { dni: { contains: search } },
    ];
  }

  if (all) {
    const alumnos = await prisma.alumno.findMany({
      where,
      select: alumnoSelect,
      orderBy: { usuario: { nombre: "asc" } },
    });
    return NextResponse.json(alumnos);
  }

  const [total, alumnos] = await Promise.all([
    prisma.alumno.count({ where }),
    prisma.alumno.findMany({
      where, select: alumnoSelect,
      orderBy: { usuario: { nombre: "asc" } },
      skip: (page - 1) * POR_PAGINA, take: POR_PAGINA,
    }),
  ]);

  return NextResponse.json({ alumnos, total, page, totalPages: Math.ceil(total / POR_PAGINA) });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { nombre, email, dni, fechaNac, anoIngreso, estado, tutorDni, tutorNombre, tutorTelefono, password } = await req.json();
  const emailNorm = email?.toLowerCase().trim();

  if (!nombre?.trim() || !dni || !emailNorm || !password) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }
  if (dni.length !== 8) return NextResponse.json({ error: "El DNI debe tener 8 dígitos" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });

  const [existeEmail, existeDni, dniComoProfesor] = await Promise.all([
    prisma.usuario.findUnique({ where: { email: emailNorm }, select: { id: true } }),
    prisma.alumno.findUnique({ where: { dni }, select: { id: true } }),
    prisma.profesor.findUnique({ where: { dni }, select: { id: true } }),
  ]);
  if (existeEmail) return NextResponse.json({ error: "Ese email ya está registrado" }, { status: 409 });
  if (existeDni) return NextResponse.json({ error: "Ya existe un alumno con ese DNI" }, { status: 409 });
  if (dniComoProfesor) return NextResponse.json({ error: "Ese DNI ya está registrado como Profesor" }, { status: 409 });

  const hash = await bcrypt.hash(password, 10);
  const alumno = await prisma.usuario.create({
    data: {
      email: emailNorm, password: hash, nombre: nombre.trim(), rol: "ALUMNO",
      alumno: {
        create: {
          dni, anoIngreso: Number(anoIngreso) || new Date().getFullYear(),
          fechaNac: fechaNac ? new Date(fechaNac) : null,
          estado: estado ?? "ACTIVO",
          tutorDni: tutorDni || null, tutorNombre: tutorNombre || null, tutorTelefono: tutorTelefono || null,
        },
      },
    },
    include: { alumno: true },
  });

  return NextResponse.json(alumno, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id, nombre, email, dni, fechaNac, anoIngreso, estado, tutorDni, tutorNombre, tutorTelefono, password } = await req.json();

  if (dni?.length !== 8) return NextResponse.json({ error: "El DNI debe tener 8 dígitos" }, { status: 400 });

  const [dniEnOtro, emailEnOtro] = await Promise.all([
    prisma.alumno.findFirst({ where: { dni, id: { not: id } }, select: { id: true } }),
    prisma.usuario.findFirst({ where: { email: email?.toLowerCase().trim(), alumno: { id: { not: id } } }, select: { id: true } }),
  ]);
  if (dniEnOtro) return NextResponse.json({ error: "Ese DNI ya pertenece a otro alumno" }, { status: 409 });
  if (emailEnOtro) return NextResponse.json({ error: "Ese email ya está en uso" }, { status: 409 });

  const alumno = await prisma.alumno.update({
    where: { id },
    data: {
      dni, anoIngreso: Number(anoIngreso),
      fechaNac: fechaNac ? new Date(fechaNac) : null,
      estado: estado ?? "ACTIVO",
      tutorDni: tutorDni || null, tutorNombre: tutorNombre || null, tutorTelefono: tutorTelefono || null,
      usuario: {
        update: {
          nombre: nombre.trim(), email: email.toLowerCase().trim(),
          ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
        },
      },
    },
    select: alumnoSelect,
  });

  return NextResponse.json(alumno);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await req.json();
  try {
    const alumno = await prisma.alumno.findUnique({ where: { id }, select: { usuarioId: true } });
    if (!alumno) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    await prisma.usuario.delete({ where: { id: alumno.usuarioId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "No se puede eliminar" }, { status: 409 });
  }
}
