import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularPromedioAlumno } from "@/lib/promedios";

// Vista previa: para cada sección del año de ORIGEN, calcula el promedio de
// cada alumno activo y determina si aprueba (según el criterio de su Nivel)
// y a qué grado pasaría (vía Grado.gradoSiguienteId). No modifica nada todavía;
// el Admin revisa esta lista antes de confirmar con POST /aplicar.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const anoOrigenId = searchParams.get("anoLectivoOrigenId");
  if (!anoOrigenId) return NextResponse.json({ error: "Falta el año lectivo de origen" }, { status: 400 });

  const secciones = await prisma.seccion.findMany({
    where: { anoLectivoId: anoOrigenId },
    select: {
      id: true, nombre: true,
      grado: {
        select: {
          id: true, nombre: true, ordenSecuencia: true,
          nivel: { select: { id: true, nombre: true, tipo: true } },
          carrera: { select: { id: true, nombre: true } },
          gradoSiguiente: { select: { id: true, nombre: true } },
        },
      },
      alumnos: { where: { estado: "ACTIVO" }, select: { id: true, dni: true, usuario: { select: { nombre: true } } } },
    },
  });

  const resultado = await Promise.all(
    secciones
      .filter((s) => s.alumnos.length > 0)
      .map(async (s) => {
        const alumnosConPromedio = await Promise.all(
          s.alumnos.map(async (a) => {
            const { promedioAnual, criterio } = await calcularPromedioAlumno(a.id);
            const aprueba = promedioAnual !== null && promedioAnual >= criterio.notaAprobatoria;
            return { id: a.id, dni: a.dni, nombre: a.usuario.nombre, promedio: promedioAnual, aprueba };
          })
        );
        return {
          seccionId: s.id,
          seccionNombre: s.nombre,
          grado: s.grado,
          esUltimoGrado: !s.grado.gradoSiguiente,
          alumnos: alumnosConPromedio,
        };
      })
  );

  return NextResponse.json(resultado);
}

// Aplica la promoción: recibe la lista ya revisada por el Admin (puede incluir
// ajustes manuales sobre quién pasa y quién repite) y mueve a cada alumno
// "promovido" al grado siguiente en el año destino (creando la sección si falta),
// marca como EGRESADO a quienes terminan el último grado, y deja sin tocar a
// quienes repiten (mismo grado, año origen — el Admin decide aparte si los
// reinscribe manualmente en el mismo grado del año nuevo).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { anoLectivoDestinoId, decisiones } = await req.json();
  // decisiones: [{ alumnoId, seccionOrigenId, accion: "PROMOVER" | "EGRESAR" | "REPETIR" }]
  if (!anoLectivoDestinoId || !Array.isArray(decisiones) || decisiones.length === 0) {
    return NextResponse.json({ error: "Faltan datos para aplicar la promoción" }, { status: 400 });
  }

  try {
    let promovidos = 0, egresados = 0, repiten = 0;

    await prisma.$transaction(async (tx) => {
      // Agrupa por sección de origen para reutilizar el cálculo de grado destino
      const seccionIds = [...new Set(decisiones.map((d: any) => d.seccionOrigenId))];
      const secciones = await tx.seccion.findMany({
        where: { id: { in: seccionIds } },
        select: { id: true, nombre: true, grado: { select: { gradoSiguienteId: true } } },
      });
      const seccionMap = new Map(secciones.map((s) => [s.id, s]));

      // Cache de secciones destino ya creadas/encontradas en esta corrida (gradoId -> seccionId)
      const seccionDestinoCache = new Map<string, string>();

      for (const d of decisiones) {
        if (d.accion === "REPETIR") { repiten++; continue; }

        if (d.accion === "EGRESAR") {
          await tx.alumno.update({ where: { id: d.alumnoId }, data: { estado: "EGRESADO", seccionId: null } });
          egresados++;
          continue;
        }

        // PROMOVER
        const seccionOrigen = seccionMap.get(d.seccionOrigenId);
        const gradoSiguienteId = seccionOrigen?.grado.gradoSiguienteId;
        if (!gradoSiguienteId) continue; // sin grado siguiente configurado, se omite (no se puede promover a ciegas)

        const cacheKey = `${gradoSiguienteId}|${seccionOrigen!.nombre}`;
        let seccionDestinoId = seccionDestinoCache.get(cacheKey);
        if (!seccionDestinoId) {
          const seccionDestino = await tx.seccion.upsert({
            where: { gradoId_anoLectivoId_nombre: { gradoId: gradoSiguienteId, anoLectivoId: anoLectivoDestinoId, nombre: seccionOrigen!.nombre } },
            update: {},
            create: { gradoId: gradoSiguienteId, anoLectivoId: anoLectivoDestinoId, nombre: seccionOrigen!.nombre },
          });
          seccionDestinoId = seccionDestino.id;
          seccionDestinoCache.set(cacheKey, seccionDestinoId);
        }

        await tx.alumno.update({ where: { id: d.alumnoId }, data: { seccionId: seccionDestinoId } });
        promovidos++;
      }
    });

    return NextResponse.json({ promovidos, egresados, repiten });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
