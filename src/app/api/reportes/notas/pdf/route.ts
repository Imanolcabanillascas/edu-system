import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularPromedioAlumno } from "@/lib/promedios";

// Genera el PDF en memoria con pdf-lib (sin Chromium) — solo corre al solicitarse,
// reutilizando el mismo cálculo ponderado por materia que el reporte en pantalla.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const seccionId = searchParams.get("seccionId");
  const alumnoId = searchParams.get("alumnoId");
  if (!seccionId && !alumnoId) return NextResponse.json({ error: "Indica seccionId o alumnoId" }, { status: 400 });

  const alumnos = await prisma.alumno.findMany({
    where: alumnoId ? { id: alumnoId } : { seccionId },
    select: {
      id: true, dni: true, usuario: { select: { nombre: true } },
      seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
    },
    orderBy: { usuario: { nombre: "asc" } },
  });

  const datos = await Promise.all(
    alumnos.map(async (a) => ({ alumno: a, ...(await calcularPromedioAlumno(a.id)) }))
  );

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const colorAccent = rgb(0.486, 0.416, 0.961);
  const colorMuted = rgb(0.478, 0.459, 0.6);
  const colorText = rgb(0.1, 0.1, 0.12);
  const colorGreen = rgb(0.337, 0.776, 0.588);
  const colorRed = rgb(0.878, 0.361, 0.361);

  const drawText = (text: string, x: number, size: number, bold = false, color = colorText) => {
    page.drawText(text, { x, y, size, font: bold ? fontBold : font, color });
  };
  const newPageIfNeeded = (needed: number) => {
    if (y - needed < margin) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin; }
  };

  const titulo = alumnoId ? "Reporte de notas — Alumno" : "Reporte de notas — Aula";
  drawText(`EduAdmin — ${titulo}`, margin, 18, true, colorAccent);
  y -= 26;

  if (seccionId && alumnos[0]?.seccion) {
    const s = alumnos[0].seccion;
    drawText(`Sección: ${s.grado.nombre} "${s.nombre}"`, margin, 11, false, colorMuted);
    y -= 16;
  }
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: colorMuted });
  y -= 24;

  for (const { alumno: a, promedioAnual, materias, criterio } of datos) {
    newPageIfNeeded(60);
    const aprobado = promedioAnual !== null ? promedioAnual >= criterio.notaAprobatoria : null;

    drawText(`${a.usuario.nombre}  —  DNI: ${a.dni}`, margin, 12, true, colorAccent);
    if (promedioAnual !== null) {
      drawText(`Promedio: ${promedioAnual.toFixed(2)} ${aprobado ? "(Aprobado)" : "(No aprobado)"}`, pageWidth - margin - 190, 12, true, aprobado ? colorGreen : colorRed);
    }
    y -= 16;

    const materiasConNota = materias.filter((m) => m.notaFinal !== null);
    if (materiasConNota.length === 0) {
      drawText("Sin calificaciones registradas.", margin + 10, 9.5, false, colorMuted);
      y -= 16;
    } else {
      for (const m of materiasConNota) {
        newPageIfNeeded(14);
        drawText(`•  ${m.materia} — Nota final: ${m.notaFinal} (Tareas: ${m.promedioTareas ?? "—"} · Exámenes: ${m.promedioExamenes ?? "—"})`, margin + 10, 9.5, false, colorText);
        y -= 13;
      }
    }
    y -= 14;
  }

  const fechaGeneracion = new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });
  page.drawText(`Generado el ${fechaGeneracion} (hora de Perú)`, { x: margin, y: margin / 2, size: 8, font, color: colorMuted });

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(pdfBytes, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="reporte_notas.pdf"` },
  });
}
