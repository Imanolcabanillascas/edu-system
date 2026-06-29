import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const profesores = await prisma.profesor.findMany({
    select: {
      id: true, dni: true, telefono: true,
      usuario: { select: { id: true, nombre: true, email: true } },
      clases: { select: { id: true } },
      materias: { select: { materia: { select: { id: true, nombre: true, grado: { select: { nombre: true } } } } } },
    },
    orderBy: { usuario: { nombre: "asc" } },
  });
  return NextResponse.json(profesores);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { nombre, email, dni, telefono, password, materiaIds } = await req.json();
  const emailNorm = email.toLowerCase().trim();

  if (!dni || dni.length !== 8) {
    return NextResponse.json({ error: "El DNI debe tener 8 dígitos" }, { status: 400 });
  }
  if (telefono && telefono.length !== 9) {
    return NextResponse.json({ error: "El teléfono debe tener 9 dígitos" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  }

  try {
    const [existenteEmail, existenteDni] = await Promise.all([
      prisma.usuario.findUnique({ where: { email: emailNorm }, select: { id: true } }),
      prisma.profesor.findUnique({ where: { dni }, select: { id: true } }),
    ]);
    if (existenteEmail) {
      return NextResponse.json({ error: "Ese email ya está registrado" }, { status: 409 });
    }
    if (existenteDni) {
      return NextResponse.json({ error: "Ya existe un profesor registrado con ese DNI" }, { status: 409 });
    }
    // El mismo DNI no puede pertenecer a un Profesor y a un Alumno a la vez —
    // son roles separados en el sistema; si la persona cambia de rol, debe
    // eliminarse el registro anterior antes de crear el nuevo.
    const dniComoAlumno = await prisma.alumno.findUnique({ where: { dni }, select: { id: true } });
    if (dniComoAlumno) {
      return NextResponse.json({ error: "Ese DNI ya está registrado como Alumno. Elimina ese registro antes de crear un Profesor con el mismo DNI." }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: {
        email: emailNorm, password: hash, nombre, rol: "PROFESOR",
        profesor: {
          create: {
            dni, telefono,
            materias: { create: (materiaIds ?? []).map((mid: string) => ({ materiaId: mid })) },
          },
        },
      },
      include: { profesor: { include: { materias: true } } },
    });
    return NextResponse.json(usuario, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "El DNI o email ya está registrado" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id, nombre, email, dni, telefono, password, materiaIds } = await req.json();

  if (!dni || dni.length !== 8) {
    return NextResponse.json({ error: "El DNI debe tener 8 dígitos" }, { status: 400 });
  }
  if (telefono && telefono.length !== 9) {
    return NextResponse.json({ error: "El teléfono debe tener 9 dígitos" }, { status: 400 });
  }
  if (password && password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  }

  try {
    // Verifica que el DNI no pertenezca a OTRO profesor, ni a ningún alumno
    const [dniEnOtroProfesor, dniComoAlumno, emailEnOtroUsuario] = await Promise.all([
      prisma.profesor.findFirst({ where: { dni, id: { not: id } }, select: { id: true } }),
      prisma.alumno.findUnique({ where: { dni }, select: { id: true } }),
      prisma.usuario.findFirst({ where: { email: email.toLowerCase().trim(), profesor: { id: { not: id } } }, select: { id: true } }),
    ]);
    if (dniEnOtroProfesor) {
      return NextResponse.json({ error: "Ese DNI ya pertenece a otro profesor" }, { status: 409 });
    }
    if (dniComoAlumno) {
      return NextResponse.json({ error: "Ese DNI ya está registrado como Alumno" }, { status: 409 });
    }
    if (emailEnOtroUsuario) {
      return NextResponse.json({ error: "Ese email ya está en uso por otra cuenta" }, { status: 409 });
    }

    await prisma.profesorMateria.deleteMany({ where: { profesorId: id } });
    const profesor = await prisma.profesor.update({
      where: { id },
      data: {
        dni, telefono,
        materias: { create: (materiaIds ?? []).map((mid: string) => ({ materiaId: mid })) },
        usuario: {
          update: {
            nombre,
            email: email.toLowerCase().trim(),
            ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
          },
        },
      },
      include: { usuario: true, materias: { include: { materia: true } } },
    });
    return NextResponse.json(profesor);
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "El DNI o email ya está en uso por otro usuario" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await req.json();
  await prisma.profesor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
