import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Generación 100% en memoria con pdf-lib (sin Chromium/Puppeteer) — bajo consumo de RAM/CPU,
// ideal para funciones serverless de Vercel. Solo se ejecuta cuando el usuario lo solicita.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const usuarioSesion = session.user as any;

  const profesor = await prisma.profesor.findUnique({
    where: { id },
    include: {
      usuario: true,
      materias: { include: { materia: true } },
      clases: {
        include: {
          materia: true,
          seccion: { include: { grado: { include: { nivel: true, carrera: true } } } },
          alumnos: { include: { alumno: { include: { usuario: true } } } },
        },
        orderBy: { horario: "asc" },
      },
    },
  });

  if (!profesor) return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });

  if (usuarioSesion.rol !== "ADMIN" && profesor.usuarioId !== usuarioSesion.id) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

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

  const drawText = (text: string, x: number, size: number, bold = false, color = colorText) => {
    page.drawText(text, { x, y, size, font: bold ? fontBold : font, color });
  };

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const materiasTexto = profesor.materias.map((m) => m.materia.nombre).join(", ") || "Sin materias asignadas";

  drawText("EduAdmin — Horario de clases", margin, 18, true, colorAccent);
  y -= 26;
  drawText(`Profesor: ${profesor.usuario.nombre}`, margin, 12, true);
  y -= 16;
  drawText(`DNI: ${profesor.dni}   |   Materias: ${materiasTexto}`, margin, 10, false, colorMuted);
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: colorMuted });
  y -= 24;

  if (profesor.clases.length === 0) {
    drawText("Este profesor no tiene clases asignadas.", margin, 11, false, colorMuted);
  }

  for (const clase of profesor.clases) {
    newPageIfNeeded(90);

    const nombreClase = `${clase.materia.nombre} — ${clase.seccion.grado.nombre} "${clase.seccion.nombre}"`;
    drawText(nombreClase, margin, 13, true, colorAccent);
    y -= 16;
    drawText(`Horario: ${clase.horario}    Salón: ${clase.salon}`, margin, 10, false, colorMuted);
    y -= 18;

    const alumnos = clase.alumnos.map((ac) => ac.alumno);
    if (alumnos.length === 0) {
      drawText("Sin alumnos matriculados en esta clase.", margin + 10, 9.5, false, colorMuted);
      y -= 16;
    } else {
      drawText(`Alumnos (${alumnos.length}):`, margin + 10, 9.5, true);
      y -= 14;
      for (const alumno of alumnos) {
        newPageIfNeeded(14);
        drawText(`•  ${alumno.usuario.nombre}   —   DNI: ${alumno.dni}`, margin + 16, 9.5, false, colorText);
        y -= 13;
      }
    }
    y -= 12;
  }

  const fechaGeneracion = new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });
  page.drawText(`Generado el ${fechaGeneracion} (hora de Perú)`, {
    x: margin, y: margin / 2, size: 8, font, color: colorMuted,
  });

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="horario_${profesor.usuario.nombre.replace(/\s+/g, "_")}.pdf"`,
    },
  });
}