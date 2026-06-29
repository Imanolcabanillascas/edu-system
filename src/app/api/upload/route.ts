import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Sube un único archivo (PDF o imagen) a Vercel Blob Storage.
// La base de datos nunca recibe el binario — solo la URL resultante (texto corto),
// lo que mantiene las consultas a Postgres rápidas y livianas.
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "El archivo supera el límite de 10 MB" }, { status: 400 });
  }
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    return NextResponse.json({ error: "Solo se permiten archivos PDF, JPG o PNG" }, { status: 400 });
  }

  const usuarioId = (session.user as any).id;
  const nombreLimpio = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const pathname = `${usuarioId}/${Date.now()}_${nombreLimpio}`;

  try {
    const blob = await put(pathname, file, { access: "public" });
    return NextResponse.json({ url: blob.url, nombre: file.name });
  } catch (e: any) {
    return NextResponse.json({ error: "No se pudo subir el archivo: " + e.message }, { status: 500 });
  }
}