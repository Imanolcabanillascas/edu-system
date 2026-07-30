import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { nowPeru } from "@/lib/utils";

// ── Helpers de dibujo ─────────────────────────────────────────────────────
const MARGEN = 50;
const ANCHO = 595;   // A4
const ALTO = 842;    // A4
const COLOR_PRIMARIO = rgb(0.4, 0.32, 0.88);  // accent2
const COLOR_TEXTO = rgb(0.11, 0.11, 0.16);
const COLOR_MUTED = rgb(0.42, 0.41, 0.52);
const COLOR_BORDE = rgb(0.88, 0.89, 0.93);
const COLOR_HEADER_BG = rgb(0.96, 0.96, 0.98);

function dibujarEncabezado(page: any, fonts: any, titulo: string, subtitulo: string, adminNombre: string, pagina: number, totalPaginas: number) {
  const { bold, regular } = fonts;
  // Banda superior
  page.drawRectangle({ x: 0, y: ALTO - 70, width: ANCHO, height: 70, color: COLOR_PRIMARIO });
  // Nombre institución
  page.drawText("EduAdmin — Sistema de Gestión Escolar", { x: MARGEN, y: ALTO - 28, size: 13, font: bold, color: rgb(1,1,1) });
  // Título reporte
  page.drawText(titulo, { x: MARGEN, y: ALTO - 48, size: 10, font: regular, color: rgb(0.9,0.9,1) });

  // Subtítulo debajo de la banda
  page.drawText(subtitulo, { x: MARGEN, y: ALTO - 90, size: 14, font: bold, color: COLOR_TEXTO });
  // Línea divisoria
  page.drawLine({ start: { x: MARGEN, y: ALTO - 98 }, end: { x: ANCHO - MARGEN, y: ALTO - 98 }, thickness: 1, color: COLOR_BORDE });

  // Metadatos: emisión, admin, página
  const fechaEmision = `Emitido: ${nowPeru().toLocaleString("es-PE", { dateStyle: "long", timeStyle: "short" })}`;
  page.drawText(fechaEmision, { x: MARGEN, y: ALTO - 114, size: 7.5, font: regular, color: COLOR_MUTED });
  page.drawText(`Generado por: ${adminNombre}`, { x: MARGEN + 200, y: ALTO - 114, size: 7.5, font: regular, color: COLOR_MUTED });
  page.drawText(`Página ${pagina} de ${totalPaginas}`, { x: ANCHO - MARGEN - 60, y: ALTO - 114, size: 7.5, font: regular, color: COLOR_MUTED });

  return ALTO - 130; // y inicial de contenido
}

function dibujarPiePagina(page: any, fonts: any) {
  page.drawLine({ start: { x: MARGEN, y: 36 }, end: { x: ANCHO - MARGEN, y: 36 }, thickness: .5, color: COLOR_BORDE });
  page.drawText("EduAdmin — Documento generado automáticamente · Confidencial", { x: MARGEN, y: 22, size: 7, font: fonts.regular, color: COLOR_MUTED });
}

function dibujarFilaTabla(page: any, fonts: any, columnas: { texto: string; x: number; ancho: number }[], y: number, esEncabezado = false) {
  if (esEncabezado) {
    page.drawRectangle({ x: MARGEN, y: y - 4, width: ANCHO - MARGEN * 2, height: 18, color: COLOR_HEADER_BG });
  }
  for (const col of columnas) {
    const texto = col.texto.length > Math.floor(col.ancho / 5.5) ? col.texto.slice(0, Math.floor(col.ancho / 5.5) - 1) + "…" : col.texto;
    page.drawText(texto, {
      x: col.x + 4, y: y + 1, size: esEncabezado ? 7.5 : 8,
      font: esEncabezado ? fonts.bold : fonts.regular,
      color: esEncabezado ? COLOR_PRIMARIO : COLOR_TEXTO,
    });
  }
  return y - 18;
}

function dibujarLineaTabla(page: any, y: number) {
  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: .4, color: COLOR_BORDE });
}

// ── Handler principal ─────────────────────────────────────────────────────
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") ?? "alumnos";
  const gradoId = searchParams.get("gradoId");
  const seccionId = searchParams.get("seccionId");
  const estado = searchParams.get("estado");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const admin = await prisma.usuario.findUnique({ where: { id: (session.user as any).id }, select: { nombre: true } });
  const adminNombre = admin?.nombre ?? "Administrador";

  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const fonts = { bold, regular };

  let titulo = "Reporte";
  let paginas: any[] = [];

  // ── ALUMNOS ───────────────────────────────────────────────────────────────
  if (tipo === "alumnos" || tipo === "retirados" || tipo === "egresados") {
    const estadoFiltro = tipo === "retirados" ? "RETIRADO" : tipo === "egresados" ? "EGRESADO" : (estado ?? "ACTIVO");
    titulo = tipo === "retirados" ? "Alumnos Retirados" : tipo === "egresados" ? "Alumnos Egresados" : "Alumnos Registrados";

    const where: any = { estado: estadoFiltro };
    if (seccionId) where.seccionId = seccionId;
    else if (gradoId) where.seccion = { gradoId };

    const alumnos = await prisma.alumno.findMany({
      where,
      select: {
        dni: true, anoIngreso: true, estado: true,
        usuario: { select: { nombre: true, email: true } },
        seccion: { select: { nombre: true, grado: { select: { nombre: true, nivel: { select: { nombre: true } } } } } },
      },
      orderBy: { usuario: { nombre: "asc" } },
    });

    const POR_PAGINA = 28;
    const grupos = Array.from({ length: Math.ceil(alumnos.length / POR_PAGINA) }, (_, i) => alumnos.slice(i * POR_PAGINA, (i + 1) * POR_PAGINA));
    const totalPaginas = Math.max(grupos.length, 1);

    for (let pi = 0; pi < totalPaginas; pi++) {
      const page = pdf.addPage([ANCHO, ALTO]);
      let y = dibujarEncabezado(page, fonts, titulo, `${titulo} — ${estadoFiltro}`, adminNombre, pi + 1, totalPaginas);
      dibujarPiePagina(page, fonts);

      page.drawText(`Total: ${alumnos.length} alumno(s)`, { x: MARGEN, y, size: 9, font: regular, color: COLOR_MUTED });
      y -= 16;

      const cols = [
        { header: "Nombre", x: MARGEN, ancho: 160 },
        { header: "DNI", x: MARGEN + 160, ancho: 70 },
        { header: "Nivel", x: MARGEN + 230, ancho: 70 },
        { header: "Grado / Sección", x: MARGEN + 300, ancho: 120 },
        { header: "Estado", x: MARGEN + 420, ancho: 75 },
      ];

      y = dibujarFilaTabla(page, fonts, cols.map((c) => ({ texto: c.header, x: c.x, ancho: c.ancho })), y, true);
      dibujarLineaTabla(page, y + 14);

      for (const a of (grupos[pi] ?? [])) {
        y = dibujarFilaTabla(page, fonts, [
          { texto: a.usuario.nombre, x: cols[0].x, ancho: cols[0].ancho },
          { texto: a.dni, x: cols[1].x, ancho: cols[1].ancho },
          { texto: a.seccion?.grado.nivel.nombre ?? "—", x: cols[2].x, ancho: cols[2].ancho },
          { texto: a.seccion ? `${a.seccion.grado.nombre} "${a.seccion.nombre}"` : "—", x: cols[3].x, ancho: cols[3].ancho },
          { texto: a.estado, x: cols[4].x, ancho: cols[4].ancho },
        ], y);
        dibujarLineaTabla(page, y + 14);
      }
    }
  }

  // ── PROFESORES ────────────────────────────────────────────────────────────
  else if (tipo === "profesores") {
    titulo = "Profesores Registrados";
    const profesores = await prisma.profesor.findMany({
      select: {
        dni: true, telefono: true, especialidad: true,
        usuario: { select: { nombre: true, email: true } },
        clases: { select: { planEstudio: { select: { materia: { select: { nombre: true } } } } } },
      },
      orderBy: { usuario: { nombre: "asc" } },
    });

    const POR_PAGINA = 25;
    const grupos = Array.from({ length: Math.ceil(profesores.length / POR_PAGINA) }, (_, i) => profesores.slice(i * POR_PAGINA, (i + 1) * POR_PAGINA));
    const totalPaginas = Math.max(grupos.length, 1);

    for (let pi = 0; pi < totalPaginas; pi++) {
      const page = pdf.addPage([ANCHO, ALTO]);
      let y = dibujarEncabezado(page, fonts, titulo, "Cuerpo Docente", adminNombre, pi + 1, totalPaginas);
      dibujarPiePagina(page, fonts);

      page.drawText(`Total: ${profesores.length} profesor(es)`, { x: MARGEN, y, size: 9, font: regular, color: COLOR_MUTED });
      y -= 16;

      const cols = [
        { header: "Nombre", x: MARGEN, ancho: 150 },
        { header: "DNI", x: MARGEN + 150, ancho: 70 },
        { header: "Especialidad", x: MARGEN + 220, ancho: 110 },
        { header: "Teléfono", x: MARGEN + 330, ancho: 80 },
        { header: "Clases", x: MARGEN + 410, ancho: 85 },
      ];

      y = dibujarFilaTabla(page, fonts, cols.map((c) => ({ texto: c.header, x: c.x, ancho: c.ancho })), y, true);
      dibujarLineaTabla(page, y + 14);

      for (const p of (grupos[pi] ?? [])) {
        const materias = [...new Set(p.clases.map((c) => c.planEstudio.materia.nombre))].join(", ");
        y = dibujarFilaTabla(page, fonts, [
          { texto: p.usuario.nombre, x: cols[0].x, ancho: cols[0].ancho },
          { texto: p.dni, x: cols[1].x, ancho: cols[1].ancho },
          { texto: p.especialidad ?? "—", x: cols[2].x, ancho: cols[2].ancho },
          { texto: p.telefono ?? "—", x: cols[3].x, ancho: cols[3].ancho },
          { texto: `${p.clases.length} (${materias || "—"})`, x: cols[4].x, ancho: cols[4].ancho },
        ], y);
        dibujarLineaTabla(page, y + 14);
      }
    }
  }

  // ── CALIFICACIONES ────────────────────────────────────────────────────────
  else if (tipo === "calificaciones") {
    titulo = "Calificaciones por Curso";
    const where: any = {};
    if (seccionId) where.clase = { seccionId };
    else if (gradoId) where.clase = { seccion: { gradoId } };

    const tareas = await prisma.tarea.findMany({
      where,
      select: {
        titulo: true,
        clase: { select: { planEstudio: { select: { materia: { select: { nombre: true } } } }, seccion: { select: { nombre: true, grado: { select: { nombre: true } } } } } },
        entregas: { select: { nota: true, estado: true, alumno: { select: { usuario: { select: { nombre: true } } } } } },
      },
    });

    const page = pdf.addPage([ANCHO, ALTO]);
    let y = dibujarEncabezado(page, fonts, titulo, "Calificaciones — Tareas", adminNombre, 1, 1);
    dibujarPiePagina(page, fonts);

    const cols = [
      { header: "Alumno", x: MARGEN, ancho: 150 },
      { header: "Tarea", x: MARGEN + 150, ancho: 130 },
      { header: "Materia", x: MARGEN + 280, ancho: 100 },
      { header: "Nota", x: MARGEN + 380, ancho: 50 },
      { header: "Estado", x: MARGEN + 430, ancho: 65 },
    ];

    y = dibujarFilaTabla(page, fonts, cols.map((c) => ({ texto: c.header, x: c.x, ancho: c.ancho })), y, true);
    dibujarLineaTabla(page, y + 14);

    for (const t of tareas) {
      for (const e of t.entregas) {
        if (y < 60) break;
        y = dibujarFilaTabla(page, fonts, [
          { texto: e.alumno.usuario.nombre, x: cols[0].x, ancho: cols[0].ancho },
          { texto: t.titulo, x: cols[1].x, ancho: cols[1].ancho },
          { texto: t.clase.planEstudio.materia.nombre, x: cols[2].x, ancho: cols[2].ancho },
          { texto: e.nota != null ? String(e.nota) : "—", x: cols[3].x, ancho: cols[3].ancho },
          { texto: e.estado, x: cols[4].x, ancho: cols[4].ancho },
        ], y);
        dibujarLineaTabla(page, y + 14);
      }
    }
  }

  // ── TAREAS Y EXÁMENES ─────────────────────────────────────────────────────
  else if (tipo === "actividades") {
    titulo = "Tareas y Exámenes";
    const [tareas, examenes] = await Promise.all([
      prisma.tarea.findMany({
        select: { titulo: true, estado: true, fechaLimite: true, createdAt: true,
          clase: { select: { planEstudio: { select: { materia: { select: { nombre: true } } } }, seccion: { select: { nombre: true, grado: { select: { nombre: true } } } } } },
          _count: { select: { entregas: true } },
        },
        orderBy: { createdAt: "desc" }, take: 100,
      }),
      prisma.examen.findMany({
        select: { titulo: true, tipo: true, fechaLimite: true, createdAt: true,
          clase: { select: { planEstudio: { select: { materia: { select: { nombre: true } } } }, seccion: { select: { nombre: true, grado: { select: { nombre: true } } } } } },
          _count: { select: { respuestas: true } },
        },
        orderBy: { createdAt: "desc" }, take: 100,
      }),
    ]);

    const page = pdf.addPage([ANCHO, ALTO]);
    let y = dibujarEncabezado(page, fonts, titulo, "Actividades académicas registradas", adminNombre, 1, 1);
    dibujarPiePagina(page, fonts);

    page.drawText("TAREAS", { x: MARGEN, y, size: 9, font: bold, color: COLOR_PRIMARIO });
    y -= 16;

    const cols = [
      { header: "Título", x: MARGEN, ancho: 140 },
      { header: "Materia", x: MARGEN + 140, ancho: 100 },
      { header: "Sección", x: MARGEN + 240, ancho: 90 },
      { header: "Estado", x: MARGEN + 330, ancho: 70 },
      { header: "Entregas", x: MARGEN + 400, ancho: 60 },
      { header: "Fecha límite", x: MARGEN + 460, ancho: 85 },
    ];
    y = dibujarFilaTabla(page, fonts, cols.map((c) => ({ texto: c.header, x: c.x, ancho: c.ancho })), y, true);
    dibujarLineaTabla(page, y + 14);

    for (const t of tareas.slice(0, 15)) {
      if (y < 200) break;
      y = dibujarFilaTabla(page, fonts, [
        { texto: t.titulo, x: cols[0].x, ancho: cols[0].ancho },
        { texto: t.clase.planEstudio.materia.nombre, x: cols[1].x, ancho: cols[1].ancho },
        { texto: `${t.clase.seccion.grado.nombre} "${t.clase.seccion.nombre}"`, x: cols[2].x, ancho: cols[2].ancho },
        { texto: t.estado, x: cols[3].x, ancho: cols[3].ancho },
        { texto: String(t._count.entregas), x: cols[4].x, ancho: cols[4].ancho },
        { texto: new Date(t.fechaLimite).toLocaleDateString("es-PE"), x: cols[5].x, ancho: cols[5].ancho },
      ], y);
      dibujarLineaTabla(page, y + 14);
    }

    y -= 20;
    page.drawText("EXÁMENES", { x: MARGEN, y, size: 9, font: bold, color: COLOR_PRIMARIO });
    y -= 16;

    const colsE = [
      { header: "Título", x: MARGEN, ancho: 140 },
      { header: "Tipo", x: MARGEN + 140, ancho: 70 },
      { header: "Materia", x: MARGEN + 210, ancho: 100 },
      { header: "Sección", x: MARGEN + 310, ancho: 90 },
      { header: "Respuestas", x: MARGEN + 400, ancho: 70 },
      { header: "Fecha límite", x: MARGEN + 470, ancho: 75 },
    ];
    y = dibujarFilaTabla(page, fonts, colsE.map((c) => ({ texto: c.header, x: c.x, ancho: c.ancho })), y, true);
    dibujarLineaTabla(page, y + 14);

    for (const e of examenes.slice(0, 12)) {
      if (y < 60) break;
      y = dibujarFilaTabla(page, fonts, [
        { texto: e.titulo, x: colsE[0].x, ancho: colsE[0].ancho },
        { texto: e.tipo, x: colsE[1].x, ancho: colsE[1].ancho },
        { texto: e.clase.planEstudio.materia.nombre, x: colsE[2].x, ancho: colsE[2].ancho },
        { texto: `${e.clase.seccion.grado.nombre} "${e.clase.seccion.nombre}"`, x: colsE[3].x, ancho: colsE[3].ancho },
        { texto: String(e._count.respuestas), x: colsE[4].x, ancho: colsE[4].ancho },
        { texto: new Date(e.fechaLimite).toLocaleDateString("es-PE"), x: colsE[5].x, ancho: colsE[5].ancho },
      ], y);
      dibujarLineaTabla(page, y + 14);
    }
  }

  const bytes = await pdf.save();
  const nombre = `reporte-${tipo}-${Date.now()}.pdf`;

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  });
}
