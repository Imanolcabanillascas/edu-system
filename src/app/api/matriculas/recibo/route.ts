import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const matricula = await prisma.matricula.findUnique({
    where: { id },
    select: {
      id: true, monto: true, fechaVencimiento: true, fechaPago: true,
      medioPago: true, estado: true, observaciones: true,
      alumno: {
        select: {
          dni: true, tutorNombre: true, tutorDni: true, tutorTelefono: true,
          usuario: { select: { nombre: true, email: true } },
        },
      },
      anoLectivo: { select: { anio: true } },
      seccion: {
        select: {
          nombre: true,
          grado: { select: { nombre: true, nivel: { select: { nombre: true } } } },
        },
      },
    },
  });

  if (!matricula) return NextResponse.json({ error: "Matrícula no encontrada" }, { status: 404 });

  // ── Dimensiones A5 apaisado (para recibo tipo voucher) ────────────────────
  const W = 595;  // A4 ancho
  const H = 420;  // A5 alto
  const M = 40;   // margen

  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  const PRIMARIO = rgb(0.40, 0.32, 0.88);
  const TEXTO    = rgb(0.11, 0.11, 0.16);
  const MUTED    = rgb(0.42, 0.41, 0.52);
  const BORDE    = rgb(0.88, 0.89, 0.93);
  const VERDE    = rgb(0.16, 0.65, 0.38);
  const ROJO     = rgb(0.87, 0.27, 0.27);
  const BLANCO   = rgb(1, 1, 1);

  const page = pdf.addPage([W, H]);

  // ── Cabecera institucional ─────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: PRIMARIO });
  page.drawText("EduAdmin", { x: M, y: H - 28, size: 18, font: bold, color: BLANCO });
  page.drawText("Sistema de Gestión Escolar", { x: M, y: H - 46, size: 9, font: regular, color: rgb(0.85, 0.85, 1) });

  // Número de recibo (esquina derecha)
  const recibo = `REC-${matricula.id.slice(-8).toUpperCase()}`;
  page.drawText("RECIBO DE MATRÍCULA", { x: W - M - 160, y: H - 26, size: 10, font: bold, color: BLANCO });
  page.drawText(recibo, { x: W - M - 160, y: H - 44, size: 9, font: regular, color: rgb(0.85, 0.85, 1) });

  // ── Estado badge ──────────────────────────────────────────────────────────
  const estadoColor = matricula.estado === "PAGADO" ? VERDE : matricula.estado === "VENCIDO" ? ROJO : PRIMARIO;
  const estadoLabel = matricula.estado === "PAGADO" ? "PAGADO" : matricula.estado === "VENCIDO" ? "VENCIDO" : "PENDIENTE";
  page.drawRectangle({ x: W - M - 90, y: H - 68, width: 90, height: 22, color: estadoColor });
  page.drawText(estadoLabel, { x: W - M - 82, y: H - 60, size: 9, font: bold, color: BLANCO });

  // ── Fecha emisión ─────────────────────────────────────────────────────────
  let y = H - 90;
  const ahora = new Date().toLocaleString("es-PE", { dateStyle: "long", timeStyle: "short", timeZone: "America/Lima" });
  page.drawText(`Emitido: ${ahora}`, { x: M, y, size: 8, font: regular, color: MUTED });
  page.drawText(`Año lectivo: ${matricula.anoLectivo.anio}`, { x: W - M - 120, y, size: 8, font: regular, color: MUTED });

  // ── Línea divisoria ───────────────────────────────────────────────────────
  y -= 12;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: BORDE });
  y -= 18;

  // ── Dos columnas: datos alumno | datos pago ───────────────────────────────
  const COL2 = W / 2 + 10;

  const drawField = (label: string, value: string, x: number, yPos: number, color = TEXTO) => {
    page.drawText(label.toUpperCase(), { x, y: yPos, size: 7, font: bold, color: MUTED });
    page.drawText(value || "—", { x, y: yPos - 14, size: 9.5, font: regular, color });
  };

  // Columna izquierda — datos del alumno
  page.drawText("DATOS DEL ALUMNO", { x: M, y, size: 8, font: bold, color: PRIMARIO });
  y -= 18;
  drawField("Nombre completo", matricula.alumno.usuario.nombre, M, y);
  drawField("DNI", matricula.alumno.dni, COL2, y);
  y -= 32;
  drawField("Correo electrónico", matricula.alumno.usuario.email, M, y);
  if (matricula.alumno.tutorNombre) {
    drawField("Apoderado", matricula.alumno.tutorNombre, COL2, y);
  }
  y -= 32;
  if (matricula.seccion) {
    drawField("Nivel", matricula.seccion.grado.nivel.nombre, M, y);
    drawField("Grado y sección", `${matricula.seccion.grado.nombre} "${matricula.seccion.nombre}"`, COL2, y);
    y -= 32;
  }

  // ── Separador ─────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: BORDE });
  y -= 18;

  // Columna izquierda — datos de pago
  page.drawText("DETALLE DEL PAGO", { x: M, y, size: 8, font: bold, color: PRIMARIO });
  y -= 18;

  drawField("Concepto", `Matrícula ${matricula.anoLectivo.anio}`, M, y);
  drawField("Fecha de vencimiento", matricula.fechaVencimiento
    ? new Date(matricula.fechaVencimiento).toLocaleDateString("es-PE", { dateStyle: "long" })
    : "—", COL2, y);
  y -= 32;

  if (matricula.estado === "PAGADO") {
    drawField("Fecha de pago", matricula.fechaPago
      ? new Date(matricula.fechaPago).toLocaleDateString("es-PE", { dateStyle: "long" })
      : "—", M, y);
    drawField("Medio de pago", matricula.medioPago ?? "—", COL2, y);
    y -= 32;
  }

  if (matricula.observaciones) {
    drawField("Observaciones", matricula.observaciones, M, y);
    y -= 32;
  }

  // ── Monto destacado ───────────────────────────────────────────────────────
  page.drawRectangle({ x: W - M - 160, y: y - 10, width: 160, height: 52, color: PRIMARIO });
  page.drawText("MONTO TOTAL", { x: W - M - 148, y: y + 28, size: 8, font: bold, color: rgb(0.85, 0.85, 1) });
  page.drawText(`S/. ${Number(matricula.monto).toFixed(2)}`, { x: W - M - 148, y: y + 8, size: 20, font: bold, color: BLANCO });

  // ── Pie de página ─────────────────────────────────────────────────────────
  page.drawLine({ start: { x: M, y: 30 }, end: { x: W - M, y: 30 }, thickness: 0.4, color: BORDE });
  page.drawText("Este documento es un comprobante de matrícula generado automáticamente por EduAdmin.", {
    x: M, y: 18, size: 7, font: regular, color: MUTED,
  });
  page.drawText(recibo, { x: W - M - 80, y: 18, size: 7, font: regular, color: MUTED });

  const bytes = await pdf.save();
  const nombre = `recibo-matricula-${matricula.alumno.dni}-${matricula.anoLectivo.anio}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  });
}
