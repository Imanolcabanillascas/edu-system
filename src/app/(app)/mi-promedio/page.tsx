"use client";
import { useEffect, useState } from "react";
import { IconReport, IconLoader, IconCheck, IconX } from "@/components/icons";

const ESCALA_COLOR: Record<string, string> = { AD: "var(--accent2)", A: "var(--green)", B: "var(--accent)", C: "var(--danger)" };

export default function MiPromedioPage() {
  const [data, setData] = useState<any>(null);
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [periodoId, setPeriodoId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch("/api/periodos").then((r) => r.json()).then(setPeriodos); }, []);
  useEffect(() => {
    setLoading(true);
    const qs = periodoId ? `?periodoId=${periodoId}` : "";
    fetch(`/api/mi-promedio${qs}`).then((r) => r.json()).then((d) => { setData(d); setLoading(false); });
  }, [periodoId]);

  if (loading) return <div className="empty"><IconLoader size={24} /></div>;

  const { promedioAnual, escala, materias, criterio, puedePromover, materiasDesaprobadas, esPrimaria } = data ?? {};
  const usaEscala = criterio?.usaEscalaLiteral ?? false;

  return (
    <div>
      <div className="page-header">
        <h1><IconReport size={24} /> Mi Promedio</h1>
        <p>{esPrimaria ? "Primaria — Escala vigesimal y literal" : "Secundaria — Promedio por materia"}</p>
      </div>

      {periodos.length > 0 && (
        <div className="form-group" style={{ maxWidth: 280, marginBottom: 24 }}>
          <label>Filtrar por período</label>
          <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)}>
            <option value="">Anual (todos los períodos)</option>
            {periodos.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      )}

      <div className="promedio-hero" style={{ marginBottom: 28 }}>
        <div style={{ textAlign: "center", minWidth: 100 }}>
          <div className="promedio-numero" style={{ color: promedioAnual != null && promedioAnual >= (criterio?.notaAprobatoria ?? 10.5) ? "var(--green)" : "var(--danger)" }}>
            {promedioAnual?.toFixed(2) ?? "—"}
          </div>
          {usaEscala && escala && (
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: ESCALA_COLOR[escala] ?? "var(--muted)", marginTop: 4 }}>{escala}</div>
          )}
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Promedio {periodoId ? "del período" : "anual"}</div>
          {puedePromover ? (
            <span className="badge" style={{ background: "var(--green)22", color: "var(--green)" }}><IconCheck size={12} /> {esPrimaria ? "Promovido" : "Puede promover"}</span>
          ) : (
            <span className="badge" style={{ background: "var(--danger)22", color: "var(--danger)" }}><IconX size={12} /> {esPrimaria ? "No promovido" : `${materiasDesaprobadas} materia(s) desaprobada(s)`}</span>
          )}
          <div className="form-hint" style={{ marginTop: 8, marginBottom: 0 }}>
            Nota aprobatoria: {criterio?.notaAprobatoria ?? 10.5}
            {!esPrimaria && (criterio?.maxMateriasDesaprob ?? 0) > 0 && ` · Máx. desaprobadas: ${criterio.maxMateriasDesaprob}`}
          </div>
        </div>
      </div>

      {!materias?.length ? (
        <div className="empty"><p>Aún no hay notas registradas</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Materia</th><th>Tareas</th><th>Exámenes</th><th>Nota final</th>{usaEscala && <th>Escala</th>}<th>Estado</th></tr>
            </thead>
            <tbody>
              {materias.map((m: any) => (
                <tr key={m.claseId}>
                  <td style={{ fontWeight: 500 }}>{m.materia}</td>
                  <td style={{ color: "var(--muted)" }}>{m.promedioTareas?.toFixed(2) ?? "—"}{m.cantidadNotasTareas > 0 && <span style={{ fontSize: ".7rem", marginLeft: 4 }}>({m.cantidadNotasTareas})</span>}</td>
                  <td style={{ color: "var(--muted)" }}>{m.promedioExamenes?.toFixed(2) ?? "—"}{m.cantidadNotasExamenes > 0 && <span style={{ fontSize: ".7rem", marginLeft: 4 }}>({m.cantidadNotasExamenes})</span>}</td>
                  <td style={{ fontWeight: 700, color: m.aprueba ? "var(--green)" : m.notaFinal != null ? "var(--danger)" : "var(--muted)" }}>{m.notaFinal?.toFixed(2) ?? "—"}</td>
                  {usaEscala && <td>{m.escala ? <span style={{ fontWeight: 700, color: ESCALA_COLOR[m.escala] }}>{m.escala}</span> : "—"}</td>}
                  <td>
                    {m.notaFinal == null ? <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>Sin notas</span>
                      : m.aprueba ? <span className="badge" style={{ background: "var(--green)22", color: "var(--green)" }}><IconCheck size={11} /> Aprobado</span>
                      : <span className="badge" style={{ background: "var(--danger)22", color: "var(--danger)" }}><IconX size={11} /> Desaprobado</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {usaEscala && (
        <div style={{ marginTop: 16, padding: 16, background: "var(--surface2)", borderRadius: 12, fontSize: ".8rem" }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Escala literal — Primaria</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[["AD","Logro destacado","18–20"],["A","Logro esperado","14–17"],["B","En proceso","11–13"],["C","En inicio","0–10"]].map(([e,d,r]) => (
              <div key={e} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 700, color: ESCALA_COLOR[e] }}>{e}</span>
                <span style={{ color: "var(--muted)" }}>{d} ({r})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
