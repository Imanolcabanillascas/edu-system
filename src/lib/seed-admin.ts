import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "admin@colegio.edu";
const ADMIN_PASSWORD = "admin123";

/**
 * Crea la cuenta de Administrador por defecto solo si todavía no existe
 * ningún usuario con ese email. Seguro de llamar múltiples veces (idempotente):
 * en cada arranque verifica primero y no duplica nada si ya fue creada.
 */
export async function seedAdmin() {
  try {
    const existente = await prisma.usuario.findUnique({ where: { email: ADMIN_EMAIL } });
    if (existente) return; // ya existe, no hacer nada

    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await prisma.usuario.create({
      data: {
        email: ADMIN_EMAIL,
        password: hash,
        nombre: "Administrador",
        rol: "ADMIN",
      },
    });
    console.log(`[seed] Usuario Admin creado: ${ADMIN_EMAIL}`);
  } catch (e) {
    // No interrumpe el arranque del servidor si la base de datos no está
    // lista todavía (ej. durante el primer build) — solo se registra el error.
    console.error("[seed] No se pudo verificar/crear el Admin por defecto:", e);
  }
}
