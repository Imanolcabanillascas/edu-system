"use client";
import { useEffect, useState } from "react";
import { NIVEL_LABEL } from "@/lib/utils";
import { IconReport, IconDownload, IconLoader, IconStudent, IconTeacher, IconBook, IconExam, IconTask, IconCheck, IconLogout, IconLayers } from "@/components/icons";

interface Reporte {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: string;
  icon: any;
  color: string;
  filtros: ("grado" | "seccion" | "estado" | "fechas")[];
}

const REPORTES: Reporte[] = [
  { id: "alumnos", titulo: "Alumnos Registrados", descripcion: "Lista completa de alumnos con datos académicos", tipo: "alumnos", icon: IconStudent, color: "var(--accent2)", filtros: ["grado", "seccion", "estado"] },
  { id: "retirados", titulo: "Alumnos Retirados", descripcion: "Alumnos que se retiraron del colegio", tipo: "retirados", icon: IconLogout, color: "var(--danger)", filtros: ["grado", "seccion"] },
  { id: "egresados", titulo: "Alumnos Egresados", descripcion: "Alumnos que completaron sus estudios", tipo: "egresados", icon: IconCheck, color: "var(--green)", filtros: ["grado"] },
  { id: "profesores", titulo: "Profesores Registrados", descripcion: "Cuerpo docente con especialidades y clases", tipo: "profesores", icon: IconTeacher, color: "var(--accent)", filtros: [] },
  { id: "calificaciones", titulo: "Calificaciones por Curso", descripcion: "Notas de tareas y exámenes por materia", tipo: "calificaciones", icon: IconBook, color: "var(--accent3)", filtros: ["grado", "seccion"] },
  { id: "actividades", titulo: "Tareas y Exámenes", descripcion: "Actividades académicas creadas por profesores", tipo: "actividades", icon: IconTask, color: "var(--accent2)", filtros: ["fechas"] },
];

export default function ReportesPage() {
  const [grados, setGrados] = useState<any[]>([]);
  const [secciones, setSecciones] = useState<any[]>([]);
  const [generando, setGenerando] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Record<string, any>>({});

  useEffect(() => {
    fetch("/api/grados").then((r) => r.json()).then(setGrados);
    fetch("/api/secciones").then((r) => r.json()).then(setSecciones);
  }, []);

  const seccionesFiltradas = filtros.gradoId
    ? secciones.filter((s: any) => s.gradoId === filtros.gradoId)
    : secciones;

  const generarPDF = async (reporte: Reporte) => {
    setGenerando(reporte.id);
    const qs = new URLSearchParams({ tipo: reporte.tipo });
    if (filtros.gradoId) qs.set("gradoId", filtros.gradoId);
    if (filtros.seccionId) qs.set("seccionId", filtros.seccionId);
    if (filtros.estado) qs.set("estado", filtros.estado);
    if (filtros.desde) qs.set("desde", filtros.desde);
    if (filtros.hasta) qs.set("hasta", filtros.hasta);

    try {
      const res = await fetch(`/api/reportes/pdf?${qs}`);
      if (!res.ok) { alert("Error al generar el reporte"); setGenerando(null); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `reporte-${reporte.tipo}-${Date.now()}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { alert("Error de conexión"); }
    setGenerando(null);
  };

  return (
    <div>
      <div className="page-header">
        <h1><IconReport size={26} /> Reportes</h1>
        <p>Genera y descarga reportes en PDF con información actualizada del sistema</p>
      </div>

      {/* Filtros globales */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 28,
        boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        <div className="muted-label" style={{ marginBottom: 14 }}>Filtros opcionales</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Grado</label>
            <select value={filtros.gradoId || ""} onChange={(e) => setFiltros({ ...filtros, gradoId: e.target.value, seccionId: "" })}>
              <option value="">Todos los grados</option>
              {grados.map((g: any) => <option key={g.id} value={g.id}>{g.nombre} — {NIVEL_LABEL[g.nivel.tipo]}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Sección</label>
            <select value={filtros.seccionId || ""} onChange={(e) => setFiltros({ ...filtros, seccionId: e.target.value })} disabled={!filtros.gradoId}>
              <option value="">Todas las secciones</option>
              {seccionesFiltradas.map((s: any) => <option key={s.id} value={s.id}>{s.grado.nombre} "{s.nombre}"</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Estado alumno</label>
            <select value={filtros.estado || ""} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
              <option value="">Todos</option>
              <option value="ACTIVO">Activo</option>
              <option value="RETIRADO">Retirado</option>
              <option value="EGRESADO">Egresado</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Desde</label>
            <input type="date" value={filtros.desde || ""} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Hasta</label>
            <input type="date" value={filtros.hasta || ""} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Grid de reportes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {REPORTES.map((r) => {
          const Icon = r.icon;
          const cargando = generando === r.id;
          return (
            <div key={r.id} className="info-card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: r.color + "18",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={20} style={{ color: r.color }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: ".95rem", color: "var(--text)", marginBottom: 3 }}>{r.titulo}</div>
                  <div style={{ fontSize: ".78rem", color: "var(--muted)", lineHeight: 1.4 }}>{r.descripcion}</div>
                </div>
              </div>
              <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => generarPDF(r)} disabled={!!generando}>
                  {cargando ? <><IconLoader size={15} /> Generando…</> : <><IconDownload size={15} /> Descargar PDF</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
