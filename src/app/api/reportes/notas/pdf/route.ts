import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularPromedioAlumno } from "@/lib/promedios";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const seccionId = searchParams.get("seccionId");
  const alumnoId = searchParams.get("alumnoId");

  if (!seccionId && !alumnoId) {
    return NextResponse.json({ error: "Indica seccionId o alumnoId" }, { status: 400 });
  }

  // Obtiene alumnos via matrículas
  const matriculas = await prisma.matricula.findMany({
    where: alumnoId ? { alumnoId } : { seccionId: seccionId! },
    select: {
      seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
      alumno: { select: { id: true, dni: true, usuario: { select: { nombre: true } } } },
    },
  });

  const alumnos = matriculas.map((m) => m.alumno);
  const seccionInfo = matriculas[0]?.seccion;

  const resultados = await Promise.all(
    alumnos.map(async (alumno) => {
      const { promedioAnual, materias } = await calcularPromedioAlumno(alumno.id);
      return { alumno, promedioAnual, materias };
    })
  );

  // Genera PDF
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const MARGEN = 50;
  const ANCHO = 595;
  const ALTO = 842;
  const COLOR_PRIMARIO = rgb(0.4, 0.32, 0.88);
  const COLOR_TEXTO = rgb(0.11, 0.11, 0.16);
  const COLOR_MUTED = rgb(0.42, 0.41, 0.52);
  const COLOR_BORDE = rgb(0.88, 0.89, 0.93);

  const page = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - 60;

  // Header
  page.drawRectangle({ x: 0, y: ALTO - 70, width: ANCHO, height: 70, color: COLOR_PRIMARIO });
  page.drawText("EduAdmin — Reporte de Notas", { x: MARGEN, y: ALTO - 28, size: 13, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`Emitido: ${new Date().toLocaleDateString("es-PE")}`, { x: MARGEN, y: ALTO - 48, size: 9, font: regular, color: rgb(0.9, 0.9, 1) });

  y = ALTO - 90;
  const titulo = seccionInfo
    ? `${seccionInfo.grado.nombre} "${seccionInfo.nombre}"`
    : alumnos[0]?.usuario.nombre ?? "Reporte de Notas";
  page.drawText(titulo, { x: MARGEN, y, size: 16, font: bold, color: COLOR_TEXTO });
  y -= 20;
  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 0.5, color: COLOR_BORDE });
  y -= 14;

  for (const { alumno, promedioAnual, materias } of resultados) {
    if (y < 120) {
      const newPage = pdf.addPage([ANCHO, ALTO]);
      y = ALTO - 60;
    }

    page.drawText(alumno.usuario.nombre, { x: MARGEN, y, size: 11, font: bold, color: COLOR_TEXTO });
    page.drawText(`DNI: ${alumno.dni}`, { x: MARGEN + 200, y, size: 9, font: regular, color: COLOR_MUTED });
    if (promedioAnual != null) {
      page.drawText(`Promedio: ${promedioAnual.toFixed(2)}`, { x: MARGEN + 350, y, size: 9, font: bold, color: promedioAnual >= 10.5 ? rgb(0.16, 0.65, 0.38) : rgb(0.87, 0.27, 0.27) });
    }
    y -= 14;

    for (const m of materias) {
      if (y < 60) break;
      page.drawText(`• ${m.materia}`, { x: MARGEN + 10, y, size: 8, font: regular, color: COLOR_TEXTO });
      page.drawText(m.notaFinal != null ? m.notaFinal.toFixed(2) : "—", { x: MARGEN + 250, y, size: 8, font: bold, color: COLOR_MUTED });
      y -= 12;
    }
    y -= 8;
    page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 0.3, color: COLOR_BORDE });
    y -= 10;
  }

  const bytes = await pdf.save();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="notas-${Date.now()}.pdf"`,
    },
  });
}
