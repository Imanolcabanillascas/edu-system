import { prisma } from "@/lib/prisma";

const NOMBRES_PRIMARIA = ["1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado", "6to Grado"];
const NOMBRES_SECUNDARIA = ["1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado"];

/**
 * Crea el catálogo fijo de Grados (6 de Primaria + 5 de Secundaria) si todavía
 * no existen, con su secuencia de progresión ya enlazada: 1ro→2do→...→6to
 * Primaria → 1ro Secundaria → ... → 5to Secundaria (sin grado siguiente = egresa).
 *
 * Es idempotente y seguro de llamar varias veces: si ya existe al menos un
 * grado en Primaria o Secundaria, no hace nada (se asume que el catálogo ya
 * fue configurado, posiblemente con nombres o secuencia personalizados por el admin).
 */
export async function asegurarGradosBase() {
  const [nivelPrimaria, nivelSecundaria] = await Promise.all([
    prisma.nivel.findUnique({ where: { tipo: "PRIMARIA" } }),
    prisma.nivel.findUnique({ where: { tipo: "SECUNDARIA" } }),
  ]);
  if (!nivelPrimaria || !nivelSecundaria) return; // los niveles se siembran en /api/niveles; si aún no existen, no hay nada que hacer

  const [gradosPrimaria, gradosSecundaria] = await Promise.all([
    prisma.grado.count({ where: { nivelId: nivelPrimaria.id } }),
    prisma.grado.count({ where: { nivelId: nivelSecundaria.id } }),
  ]);
  if (gradosPrimaria > 0 || gradosSecundaria > 0) return; // ya hay grados configurados, no se toca nada

  await prisma.$transaction(async (tx) => {
    const creadosPrimaria = [];
    for (let i = 0; i < NOMBRES_PRIMARIA.length; i++) {
      creadosPrimaria.push(await tx.grado.create({
        data: { nombre: NOMBRES_PRIMARIA[i], nivelId: nivelPrimaria.id, ordenSecuencia: i + 1 },
      }));
    }

    const creadosSecundaria = [];
    for (let i = 0; i < NOMBRES_SECUNDARIA.length; i++) {
      creadosSecundaria.push(await tx.grado.create({
        data: { nombre: NOMBRES_SECUNDARIA[i], nivelId: nivelSecundaria.id, ordenSecuencia: i + 1 },
      }));
    }

    // Enlaza la secuencia completa: dentro de Primaria, dentro de Secundaria,
    // y el puente especial 6to Primaria → 1er Secundaria.
    const todos = [...creadosPrimaria, ...creadosSecundaria];
    for (let i = 0; i < todos.length - 1; i++) {
      // El último de Primaria (índice 5) enlaza con el primero de Secundaria (índice 6) — ya cubierto por el bucle continuo
      await tx.grado.update({ where: { id: todos[i].id }, data: { gradoSiguienteId: todos[i + 1].id } });
    }
    // El último de Secundaria (5to) queda sin gradoSiguienteId — egresa al aprobar.
  });
}
