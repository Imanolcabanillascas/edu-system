// Script manual para crear (o confirmar que ya existe) la cuenta de
// Administrador por defecto. Se ejecuta a mano cuando se necesita, por
// ejemplo justo después de `npx prisma migrate reset`.
//
// Uso:
//   npx tsx prisma/seed-admin.ts
//
// Es idempotente: si el email ya existe, no hace nada y simplemente lo informa.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const ADMIN_EMAIL = "admin@colegio.edu";
const ADMIN_PASSWORD = "admin123";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const existente = await prisma.usuario.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existente) {
    console.log(`Ya existe una cuenta con ${ADMIN_EMAIL} — no se crea nada.`);
    await prisma.$disconnect();
    return;
  }

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.usuario.create({
    data: { email: ADMIN_EMAIL, password: hash, nombre: "Administrador", rol: "ADMIN" },
  });

  console.log(`Cuenta Admin creada:`);
  console.log(`  Email: ${ADMIN_EMAIL}`);
  console.log(`  Contraseña: ${ADMIN_PASSWORD}`);
  console.log(`  ⚠ Cámbiala apenas inicies sesión.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error al crear el Admin:", e);
  process.exit(1);
});
