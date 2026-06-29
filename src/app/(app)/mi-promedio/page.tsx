"use client";
import { useEffect, useState } from "react";
import { IconReport, IconLoader, IconAlert, IconCheck, IconX } from "@/components/icons";

export default function MiPromedioPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mi-promedio").then((r) => r.json()).then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="empty"><IconLoader size={24} /></div>;

  const aprobado = data?.promedioAnual !== null && data?.promedioAnual >= data?.criterio.notaAprobatoria;

  return (
    <div>
      <div className="page-header">
        <h1><IconReport size={24} /> Mi Promedio</h1>
        <p>Resumen de tus calificaciones del año en curso</p>
      </div>

      {!data || data.materias.length === 0 ? (
        <div className="empty"><IconAlert size={28} style={{ color: "var(--muted)" }} /><p>Todavía no tienes clases o calificaciones registradas</p></div>
      ) : (
        <>
          <div className="promedio-hero" style={{ borderColor: data.promedioAnual === null ? "var(--border)" : aprobado ? "var(--green)40" : "var(--danger)40" }}>
            <div className="promedio-numero" style={{ color: data.promedioAnual === null ? "var(--muted)" : aprobado ? "var(--green)" : "var(--danger)" }}>
              {data.promedioAnual !== null ? data.promedioAnual.toFixed(2) : "—"}
            </div>
            <div>
              <div className="muted-label" style={{ marginBottom: 4 }}>Promedio anual</div>
              {data.promedioAnual !== null && (
                <span className="badge" style={{ background: aprobado ? "var(--green)22" : "var(--danger)22", color: aprobado ? "var(--green)" : "var(--danger)" }}>
                  {aprobado ? <><IconCheck size={12} /> Vas aprobando</> : <><IconX size={12} /> Por debajo del mínimo</>}
                </span>
              )}
              <div className="form-hint" style={{ marginTop: 6 }}>
                Nota mínima para aprobar: {data.criterio.notaAprobatoria} · Ponderación: {data.criterio.pesoTareas}% tareas + {data.criterio.pesoExamenes}% exámenes
              </div>
            </div>
          </div>

          <h2 className="section-title" style={{ marginTop: 28 }}>Detalle por materia</h2>
          <div className="card-grid">
            {data.materias.map((m: any) => (
              <div className="info-card" key={m.claseId}>
                <div className="info-card-title">{m.materia}</div>
                <div className="info-card-meta">
                  <span>Nota final: <strong>{m.notaFinal ?? "Sin calificar aún"}</strong></span>
                  <span>Tareas: {m.promedioTareas ?? "—"} ({m.cantidadNotasTareas} calificadas)</span>
                  <span>Exámenes: {m.promedioExamenes ?? "—"} ({m.cantidadNotasExamenes} calificados)</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
