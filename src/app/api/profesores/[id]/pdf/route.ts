import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await params;
  const profesor = await prisma.profesor.findUnique({
    where: { id },
    select: {
      dni: true, telefono: true, especialidad: true,
      usuario: { select: { nombre: true, email: true } },
      clases: {
        select: {
          horario: true, salon: true,
          planEstudio: { select: { materia: { select: { nombre: true } } } },
          seccion: {
            select: {
              nombre: true,
              grado: { select: { nombre: true, nivel: { select: { nombre: true } } } },
              // Alumnos via matrículas (nuevo modelo)
              matriculas: { select: { alumnoId: true, alumno: { select: { usuario: { select: { nombre: true } } } } } },
            },
          },
        },
      },
    },
  });

  if (!profesor) return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });

  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  const page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - 60;

  // Header
  page.drawRectangle({ x: 0, y: height - 70, width, height: 70, color: rgb(0.41, 0.32, 0.88) });
  page.drawText("EduAdmin — Ficha de Profesor", { x: margin, y: height - 28, size: 13, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`Generado: ${new Date().toLocaleDateString("es-PE")}`, { x: margin, y: height - 48, size: 9, font: regular, color: rgb(0.9, 0.9, 1) });
  y = height - 90;

  // Datos del profesor
  page.drawText(profesor.usuario.nombre, { x: margin, y, size: 18, font: bold, color: rgb(0.11, 0.11, 0.16) });
  y -= 20;
  page.drawText(`DNI: ${profesor.dni}  |  Email: ${profesor.usuario.email}${profesor.telefono ? `  |  Tel: ${profesor.telefono}` : ""}`, { x: margin, y, size: 9, font: regular, color: rgb(0.42, 0.41, 0.52) });
  if (profesor.especialidad) {
    y -= 14;
    page.drawText(`Especialidad: ${profesor.especialidad}`, { x: margin, y, size: 9, font: regular, color: rgb(0.42, 0.41, 0.52) });
  }
  y -= 24;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.88, 0.89, 0.93) });
  y -= 16;

  // Clases
  page.drawText("CLASES ASIGNADAS", { x: margin, y, size: 8, font: bold, color: rgb(0.41, 0.32, 0.88) });
  y -= 14;

  for (const clase of profesor.clases) {
    if (y < 80) break;
    const alumnos = clase.seccion.matriculas.map((m) => m.alumno);
    page.drawText(`${clase.planEstudio.materia.nombre} — ${clase.seccion.grado.nombre} "${clase.seccion.nombre}"`, { x: margin, y, size: 10, font: bold, color: rgb(0.11, 0.11, 0.16) });
    y -= 13;
    page.drawText(`${clase.seccion.grado.nivel.nombre}${clase.horario ? `  ·  ${clase.horario}` : ""}${clase.salon ? `  ·  ${clase.salon}` : ""}  ·  ${alumnos.length} alumno(s)`, { x: margin + 10, y, size: 8, font: regular, color: rgb(0.42, 0.41, 0.52) });
    y -= 18;
  }

  const bytes = await pdf.save();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="profesor-${profesor.usuario.nombre.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
