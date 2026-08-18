"use client";
import { useEffect, useState } from "react";
import { NIVEL_LABEL } from "@/lib/utils";
import { IconLoader, IconCheck, IconAlert, IconArrowRight, IconStudent } from "@/components/icons";

export default function PromocionAutomaticaPage() {
  const [vistaPrevia, setVistaPrevia] = useState<any[]>([]);
  const [anoActivo, setAnoActivo] = useState<any>(null);
  const [anos, setAnos] = useState<any[]>([]);
  const [anoDestino, setAnoDestino] = useState("");
  const [decisiones, setDecisiones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/promocion-automatica").then((r) => r.json()),
      fetch("/api/anos-lectivos").then((r) => r.json()),
    ]).then(([data, anosData]) => {
      setVistaPrevia(data.vistaPrevia ?? []);
      setAnoActivo(data.anoActivo);
      setAnos(anosData);
      // Pre-seleccionar decisiones por defecto
      const dec: Record<string, string> = {};
      for (const sec of data.vistaPrevia ?? []) {
        for (const a of (sec.matriculas ?? sec.alumnos ?? [])) {
          dec[a.id] = sec.esUltimoGrado ? "EGRESAR" : (a.aprueba ? "PROMOVER" : "REPETIR");
        }
      }
      setDecisiones(dec);
      setLoading(false);
    });
  }, []);

  const totalAlumnos = vistaPrevia.reduce((s, sec) => s + (sec.matriculas ?? sec.alumnos ?? []).length, 0);

  const aplicar = async () => {
    if (!anoDestino) { setError("Selecciona el año lectivo de destino"); return; }
    if (!confirm(`¿Confirmas la promoción de ${totalAlumnos} alumno(s)?`)) return;
    setAplicando(true); setError("");

    const decisionesArray = vistaPrevia.flatMap((sec) =>
      (sec.matriculas ?? sec.alumnos ?? []).map((a: any) => ({
        alumnoId: a.id,
        seccionOrigenId: sec.seccionId,
        accion: decisiones[a.id] ?? "REPETIR",
      }))
    );

    const res = await fetch("/api/promocion-automatica", {
      method: "POST",
      body: JSON.stringify({ decisiones: decisionesArray, anoLectivoDestinoId: anoDestino }),
    });
    const data = await res.json();
    setAplicando(false);
    if (!res.ok) { setError(data.error); return; }
    setResultado(data);
  };

  if (loading) return <div className="empty"><IconLoader size={24} /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Promoción de fin de año</h1>
        <p>Mueve automáticamente a los alumnos al siguiente grado según sus promedios</p>
      </div>

      {resultado ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, textAlign: "center" }}>
          <IconCheck size={48} style={{ color: "var(--green)", marginBottom: 16 }} />
          <h2 style={{ marginBottom: 16 }}>Promoción aplicada</h2>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
            <div><div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--green)" }}>{resultado.promovidos}</div><div className="muted-label">Promovidos</div></div>
            <div><div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--accent)" }}>{resultado.repetidores}</div><div className="muted-label">Repiten</div></div>
            <div><div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--accent2)" }}>{resultado.egresados}</div><div className="muted-label">Egresados</div></div>
          </div>
        </div>
      ) : (
        <>
          {error && <div className="alert-error">{error}</div>}

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 240 }}>
              <label>Año lectivo de destino</label>
              <select value={anoDestino} onChange={(e) => setAnoDestino(e.target.value)}>
                <option value="">Seleccionar…</option>
                {anos.filter((a: any) => a.id !== anoActivo?.id).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.anio}{a.activo ? " (activo)" : ""}</option>
                ))}
              </select>
            </div>
            <div className="muted-label" style={{ marginBottom: 8 }}>{totalAlumnos} alumno(s) a procesar</div>
            <button className="btn btn-primary" onClick={aplicar} disabled={aplicando || !anoDestino}>
              {aplicando ? "Aplicando…" : "Aplicar promoción"}
            </button>
          </div>

          {vistaPrevia.length === 0 && (
            <div className="empty"><IconStudent size={32} style={{ color: "var(--muted)" }} /><p>No hay alumnos matriculados en el año activo</p></div>
          )}

          {vistaPrevia.map((seccion) => (
            <div key={seccion.seccionId} style={{ marginBottom: 28 }}>
              <h3 className="section-title">
                {seccion.grado.nombre} &ldquo;{seccion.seccionNombre}&rdquo; — {NIVEL_LABEL[seccion.grado.nivel.tipo]}
                {seccion.esUltimoGrado && <span className="badge" style={{ background: "var(--accent2)22", color: "var(--accent2)", marginLeft: 10 }}>Último grado — egresan</span>}
                {!seccion.esUltimoGrado && !seccion.grado.gradoSiguiente && (
                  <span className="badge" style={{ background: "var(--danger)22", color: "var(--danger)", marginLeft: 10 }}>Sin grado siguiente configurado</span>
                )}
              </h3>

              <div className="table-wrap">
                <table>
                  <thead><tr><th>Alumno</th><th>Promedio</th><th>Decisión</th></tr></thead>
                  <tbody>
                    {(seccion.matriculas ?? seccion.alumnos ?? []).map((a: any) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500 }}>{a.nombre}</td>
                        <td>
                          {a.promedioAnual != null ? (
                            <span style={{ fontWeight: 600, color: a.aprueba ? "var(--green)" : "var(--danger)" }}>
                              {a.promedioAnual.toFixed(2)}
                            </span>
                          ) : <span style={{ color: "var(--muted)" }}>Sin notas</span>}
                        </td>
                        <td>
                          <select
                            value={decisiones[a.id] ?? "REPETIR"}
                            onChange={(e) => setDecisiones({ ...decisiones, [a.id]: e.target.value })}
                            style={{ fontSize: ".82rem", padding: "4px 8px", borderRadius: 6, border: "1.5px solid var(--border)", background: "var(--surface2)" }}
                          >
                            {!seccion.esUltimoGrado && <option value="PROMOVER">Promover al siguiente grado</option>}
                            <option value="REPETIR">Repetir el mismo grado</option>
                            <option value="EGRESAR">Egresar</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
