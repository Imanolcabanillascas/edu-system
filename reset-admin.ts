import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env") });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  
  const hash = await bcrypt.hash("admin123", 10);
  
  const u = await prisma.usuario.update({
    where: { email: "admin@colegio.edu" },
    data: { password: hash },
  });
  
  // Verifica inmediatamente
  const verify = await bcrypt.compare("admin123", hash);
  console.log("Password actualizado:", u.email);
  console.log("Verificacion:", verify);
  
  await prisma.$disconnect();
}
main();