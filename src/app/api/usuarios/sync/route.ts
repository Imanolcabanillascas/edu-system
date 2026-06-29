import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function syncUsuario(userId: string) {
  let usuario = await prisma.usuario.findUnique({ where: { clerkId: userId } });
  if (usuario) return usuario;

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? `user_${userId}@eduadmin.com`;
  const nombre = `${clerkUser?.firstName ?? ""} ${clerkUser?.lastName ?? ""}`.trim() || email;

  const existentePorEmail = await prisma.usuario.findUnique({ where: { email } });

  if (existentePorEmail && existentePorEmail.clerkId.startsWith("manual_")) {
    return prisma.usuario.update({ where: { id: existentePorEmail.id }, data: { clerkId: userId, nombre } });
  }
  if (existentePorEmail) return existentePorEmail;

  const count = await prisma.usuario.count();
  return prisma.usuario.create({
    data: { clerkId: userId, email, nombre, rol: count === 0 ? "ADMIN" : "ALUMNO" },
  });
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const usuario = await syncUsuario(userId);
  return NextResponse.json(usuario);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const usuario = await syncUsuario(userId);
  return NextResponse.json(usuario);
}
