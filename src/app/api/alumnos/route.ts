import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 30;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const search = searchParams.get("search")?.trim() ?? "";
  const estado = searchParams.get("estado"); // ACTIVO | EGRESADO | RETIRADO | "" = todos
  const anoIngreso = searchParams.get("anoIngreso");
  const all = searchParams.get("all") === "true"; // uso interno: selectores que necesitan la lista completa, sin paginar

  // Por defecto solo se listan los alumnos ACTIVOS — egresados/retirados no se
  // mezclan con la operación diaria a menos que se pidan explícitamente.
  const where: any = {};
  if (estado !== "") where.estado = estado ?? "ACTIVO";
  if (anoIngreso) where.anoIngreso = Number(anoIngreso);
  if (search) {
    where.OR = [
      { dni: { contains: search } },
      { usuario: { nombre: { contains: search, mode: "insensitive" } } },
    ];
  }

  const select = {
    id: true, dni: true, fechaNac: true, anoIngreso: true, estado: true,
    tutorDni: true, tutorNombre: true, tutorTelefono: true,
    usuario: { select: { id: true, nombre: true, email: true } },
    matricula: { select: { estado: true } },
    seccion: { select: { id: true, nombre: true, gradoId: true, grado: { select: { nombre: true, nivel: true } } } },
  };

  if (all) {
    // Sin paginar: usado por selectores internos (Clases, Reportes, Promoción) que
    // ya acotan el volumen filtrando por sección/grado en el cliente.
    const alumnos = await prisma.alumno.findMany({ where, select, orderBy: { usuario: { nombre: "asc" } } });
    return NextResponse.json(alumnos);
  }

  const [alumnos, total] = await Promise.all([
    prisma.alumno.findMany({
      where, select,
      orderBy: { usuario: { nombre: "asc" } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.alumno.count({ where }),
  ]);

  return NextResponse.json({ alumnos, total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { nombre, email, dni, seccionId, fechaNac, anoIngreso, tutorDni, tutorNombre, tutorTelefono, password } = await req.json();
  const emailNorm = email.toLowerCase().trim();

  if (!dni || dni.length !== 8) {
    return NextResponse.json({ error: "El DNI debe tener 8 dígitos" }, { status: 400 });
  }
  if (tutorDni && tutorDni.length !== 8) {
    return NextResponse.json({ error: "El DNI del tutor debe tener 8 dígitos" }, { status: 400 });
  }
  if (tutorTelefono && tutorTelefono.length !== 9) {
    return NextResponse.json({ error: "El teléfono del tutor debe tener 9 dígitos" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  }
  if (!anoIngreso) {
    return NextResponse.json({ error: "El año de ingreso es obligatorio" }, { status: 400 });
  }

  try {
    const [existenteEmail, existenteDni, dniComoProfesor] = await Promise.all([
      prisma.usuario.findUnique({ where: { email: emailNorm }, select: { id: true } }),
      prisma.alumno.findUnique({ where: { dni }, select: { id: true } }),
      prisma.profesor.findUnique({ where: { dni }, select: { id: true } }),
    ]);
    if (existenteEmail) {
      return NextResponse.json({ error: "Ese email ya está registrado" }, { status: 409 });
    }
    if (existenteDni) {
      return NextResponse.json({ error: "Ya existe un alumno registrado con ese DNI" }, { status: 409 });
    }
    // El mismo DNI no puede pertenecer a un Alumno y a un Profesor a la vez.
    if (dniComoProfesor) {
      return NextResponse.json({ error: "Ese DNI ya está registrado como Profesor. Elimina ese registro antes de crear un Alumno con el mismo DNI." }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const datosAlumno = {
      dni,
      seccionId: seccionId || null,
      fechaNac: fechaNac ? new Date(fechaNac) : null,
      anoIngreso: Number(anoIngreso),
      tutorDni: tutorDni || null,
      tutorNombre: tutorNombre || null,
      tutorTelefono: tutorTelefono || null,
    };

    const usuario = await prisma.usuario.create({
      data: {
        email: emailNorm, password: hash, nombre, rol: "ALUMNO",
        alumno: { create: datosAlumno },
      },
      include: { alumno: true },
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

  const { id, nombre, email, dni, seccionId, fechaNac, anoIngreso, tutorDni, tutorNombre, tutorTelefono, password, estado } = await req.json();

  if (!dni || dni.length !== 8) {
    return NextResponse.json({ error: "El DNI debe tener 8 dígitos" }, { status: 400 });
  }
  if (tutorDni && tutorDni.length !== 8) {
    return NextResponse.json({ error: "El DNI del tutor debe tener 8 dígitos" }, { status: 400 });
  }
  if (tutorTelefono && tutorTelefono.length !== 9) {
    return NextResponse.json({ error: "El teléfono del tutor debe tener 9 dígitos" }, { status: 400 });
  }
  if (password && password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  }
  if (!anoIngreso) {
    return NextResponse.json({ error: "El año de ingreso es obligatorio" }, { status: 400 });
  }

  try {
    const alumnoActual = await prisma.alumno.findUnique({ where: { id }, select: { usuarioId: true } });
    if (!alumnoActual) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

    const emailNorm = email.toLowerCase().trim();
    const [dniEnOtroAlumno, dniComoProfesor, emailEnOtroUsuario] = await Promise.all([
      prisma.alumno.findFirst({ where: { dni, id: { not: id } }, select: { id: true } }),
      prisma.profesor.findUnique({ where: { dni }, select: { id: true } }),
      prisma.usuario.findFirst({ where: { email: emailNorm, id: { not: alumnoActual.usuarioId } }, select: { id: true } }),
    ]);
    if (dniEnOtroAlumno) {
      return NextResponse.json({ error: "Ese DNI ya pertenece a otro alumno" }, { status: 409 });
    }
    if (dniComoProfesor) {
      return NextResponse.json({ error: "Ese DNI ya está registrado como Profesor" }, { status: 409 });
    }
    if (emailEnOtroUsuario) {
      return NextResponse.json({ error: "Ese email ya está en uso por otra cuenta" }, { status: 409 });
    }

    await prisma.usuario.update({
      where: { id: alumnoActual.usuarioId },
      data: {
        nombre,
        email: emailNorm,
        ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
      },
    });

    const alumno = await prisma.alumno.update({
      where: { id },
      data: {
        dni,
        seccionId: seccionId || null,
        fechaNac: fechaNac ? new Date(fechaNac) : null,
        anoIngreso: Number(anoIngreso),
        tutorDni: tutorDni || null,
        tutorNombre: tutorNombre || null,
        tutorTelefono: tutorTelefono || null,
        ...(estado ? { estado } : {}),
      },
      select: {
        id: true, dni: true, fechaNac: true, anoIngreso: true, estado: true,
        usuario: { select: { id: true, nombre: true, email: true } },
        seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
      },
    });
    return NextResponse.json(alumno);
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
  await prisma.alumno.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
