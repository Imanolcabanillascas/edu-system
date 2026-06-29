"use client";
import { useEffect, useState } from "react";
import { NIVEL_LABEL, nombreGrado, initials, avatarColor } from "@/lib/utils";
import { IconReport, IconSearch, IconLoader, IconDownload, IconAlert, IconCheck } from "@/components/icons";

export default function ReportesPage() {
  const [niveles, setNiveles] = useState<any[]>([]);
  const [secciones, setSecciones] = useState<any[]>([]);
  const [alumnosAll, setAlumnosAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modo, setModo] = useState<"seccion" | "alumno">("seccion");
  const [seccionSel, setSeccionSel] = useState("");
  const [busquedaAlumno, setBusquedaAlumno] = useState("");
  const [alumnoSel, setAlumnoSel] = useState<any>(null);

  const [reporte, setReporte] = useState<any | null>(null);
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const [modalCriterios, setModalCriterios] = useState(false);
  const [criteriosForm, setCriteriosForm] = useState<any>({});
  const [criteriosError, setCriteriosError] = useState("");
  const [savingCriterio, setSavingCriterio] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [resN, resS, resA] = await Promise.all([fetch("/api/niveles"), fetch("/api/secciones"), fetch("/api/alumnos?all=true")]);
    setNiveles(await resN.json());
    setSecciones(await resS.json());
    setAlumnosAll(await resA.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const abrirCriterios = async () => {
    setCriteriosError("");
    const res = await fetch("/api/criterios");
    const data = await res.json();
    const form: any = {};
    for (const n of data) {
      form[n.id] = {
        pesoTareas: n.criterio?.pesoTareas ?? 40,
        pesoExamenes: n.criterio?.pesoExamenes ?? 60,
        notaAprobatoria: n.criterio?.notaAprobatoria ?? 10.5,
        nombre: n.nombre,
      };
    }
    setCriteriosForm(form);
    setModalCriterios(true);
  };

  const guardarCriterio = async (nivelId: string) => {
    const c = criteriosForm[nivelId];
    if (Number(c.pesoTareas) + Number(c.pesoExamenes) !== 100) {
      setCriteriosError(`Para "${c.nombre}": los pesos deben sumar 100%`);
      return;
    }
    setSavingCriterio(nivelId);
    setCriteriosError("");
    const res = await fetch("/api/criterios", { method: "PUT", body: JSON.stringify({ nivelId, ...c }) });
    setSavingCriterio(null);
    if (!res.ok) { setCriteriosError((await res.json()).error); return; }
  };

  const cargarReporte = async (params: { seccionId?: string; alumnoId?: string }) => {
    setCargandoReporte(true);
    setReporte(null);
    const qs = params.seccionId ? `seccionId=${params.seccionId}` : `alumnoId=${params.alumnoId}`;
    const res = await fetch(`/api/reportes/notas?${qs}`);
    setReporte(await res.json());
    setCargandoReporte(false);
  };

  const elegirSeccion = (id: string) => {
    setSeccionSel(id);
    if (id) cargarReporte({ seccionId: id });
    else setReporte(null);
  };

  const elegirAlumno = (a: any) => {
    setAlumnoSel(a);
    setBusquedaAlumno("");
    cargarReporte({ alumnoId: a.id });
  };

  const alumnosFiltrados = busquedaAlumno
    ? alumnosAll.filter((a: any) =>
        a.usuario.nombre.toLowerCase().includes(busquedaAlumno.toLowerCase()) || a.dni.includes(busquedaAlumno)
      ).slice(0, 8)
    : [];

  const nombreSeccion = (s: any) => `${s.grado.nombre} "${s.nombre}"`;

  const generarPdf = async () => {
    if (!reporte) return;
    setGenerandoPdf(true);
    try {
      const params = modo === "seccion" ? { seccionId: seccionSel } : { alumnoId: alumnoSel.id };
      const qs = new URLSearchParams(params as any).toString();
      const res = await fetch(`/api/reportes/notas/pdf?${qs}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_notas.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Ocurrió un error al generar el PDF");
    } finally {
      setGenerandoPdf(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1><IconReport size={24} /> Reportes de notas</h1>
        <p>Consulta calificaciones de tareas y exámenes por aula o por alumno</p>
      </div>

      <div className="toolbar" style={{ marginBottom: 8 }}>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={abrirCriterios}>Configurar criterios de aprobación</button>
      </div>

      <div className="tabs">
        <button className={`tab ${modo === "seccion" ? "active" : ""}`} onClick={() => { setModo("seccion"); setReporte(null); setAlumnoSel(null); }}>Por aula</button>
        <button className={`tab ${modo === "alumno" ? "active" : ""}`} onClick={() => { setModo("alumno"); setReporte(null); setSeccionSel(""); }}>Por alumno</button>
      </div>

      {loading ? (
        <div className="empty"><IconLoader size={24} /></div>
      ) : (
        <>
          {modo === "seccion" ? (
            <div className="form-group" style={{ maxWidth: 420 }}>
              <label>Selecciona una sección o periodo</label>
              <select value={seccionSel} onChange={(e) => elegirSeccion(e.target.value)}>
                <option value="">Seleccionar…</option>
                {secciones.map((s: any) => (
                  <option key={s.id} value={s.id}>{nombreSeccion(s)} — {NIVEL_LABEL[s.grado.nivel.tipo]}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-group" style={{ maxWidth: 420, position: "relative" }}>
              <label>Buscar alumno por nombre o DNI</label>
              <div className="search-wrap">
                <IconSearch size={16} className="search-icon" />
                <input className="search-input" value={alumnoSel ? alumnoSel.usuario.nombre : busquedaAlumno}
                  onChange={(e) => { setBusquedaAlumno(e.target.value); setAlumnoSel(null); }} placeholder="Ej: Sofía López o 12345678" />
              </div>
              {alumnosFiltrados.length > 0 && !alumnoSel && (
                <div className="autocomplete-list">
                  {alumnosFiltrados.map((a: any) => (
                    <button key={a.id} className="autocomplete-item" onClick={() => elegirAlumno(a)}>
                      <div className="avatar" style={{ width: 26, height: 26, fontSize: ".7rem", background: avatarColor(a.usuario.nombre) + "33", color: avatarColor(a.usuario.nombre) }}>
                        {initials(a.usuario.nombre)}
                      </div>
                      <div>
                        <div style={{ fontSize: ".85rem" }}>{a.usuario.nombre}</div>
                        <div className="muted-label" style={{ marginBottom: 0 }}>DNI {a.dni}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {cargandoReporte && <div className="empty"><IconLoader size={24} /></div>}

          {reporte && !cargandoReporte && (
            <div style={{ marginTop: 24 }}>
              {reporte.alumnos.length === 0 ? (
                <div className="empty"><IconAlert size={28} style={{ color: "var(--muted)" }} /><p>No hay alumnos para mostrar</p></div>
              ) : (
                <>
                  <div className="toolbar">
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-primary" onClick={generarPdf} disabled={generandoPdf}>
                      {generandoPdf ? <IconLoader size={15} /> : <IconDownload size={15} />} Generar PDF
                    </button>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Alumno</th><th>DNI</th><th>Promedio</th><th>Resultado</th></tr></thead>
                      <tbody>
                        {reporte.alumnos.map((a: any) => (
                          <tr key={a.id}>
                            <td style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div className="avatar" style={{ background: avatarColor(a.nombre) + "33", color: avatarColor(a.nombre) }}>{initials(a.nombre)}</div>
                              {a.nombre}
                            </td>
                            <td style={{ color: "var(--muted)", fontFamily: "monospace" }}>{a.dni}</td>
                            <td>
                              {a.promedio !== null ? (
                                <span className="badge" style={{
                                  background: a.aprobado ? "var(--green)22" : "var(--danger)22",
                                  color: a.aprobado ? "var(--green)" : "var(--danger)",
                                }}>{a.promedio.toFixed(2)}</span>
                              ) : <span style={{ color: "var(--muted)" }}>Sin notas</span>}
                            </td>
                            <td>
                              {a.aprobado === null ? <span style={{ color: "var(--muted)" }}>—</span> :
                                a.aprobado ? <span className="badge" style={{ background: "var(--green)22", color: "var(--green)" }}>Aprobado</span> :
                                <span className="badge" style={{ background: "var(--danger)22", color: "var(--danger)" }}>No aprobado</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {modo === "alumno" && reporte.detalle?.[0]?.materias?.length > 0 && (
                    <>
                      <h2 className="section-title" style={{ marginTop: 28 }}>Detalle por materia</h2>
                      <div className="card-grid">
                        {reporte.detalle[0].materias.map((m: any, i: number) => (
                          <div className="info-card" key={i}>
                            <div className="info-card-title">{m.materia}</div>
                            <div className="info-card-meta">
                              <span>Nota final: <strong>{m.notaFinal ?? "—"}</strong></span>
                              <span>Promedio tareas: {m.promedioTareas ?? "—"} ({m.cantidadNotasTareas} calificadas)</span>
                              <span>Promedio exámenes: {m.promedioExamenes ?? "—"} ({m.cantidadNotasExamenes} calificados)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {modalCriterios && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalCriterios(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <h2><IconReport size={20} /> Criterios de aprobación por nivel</h2>
            <p className="form-hint" style={{ marginBottom: 16 }}>
              Define cómo se pondera la nota final de cada materia: % de las tareas + % de los exámenes (deben sumar 100).
            </p>
            {criteriosError && <div className="alert-error">{criteriosError}</div>}

            {Object.entries(criteriosForm).map(([nivelId, c]: any) => (
              <div key={nivelId} className="question-card" style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>{c.nombre}</div>
                <div className="form-row">
                  <div className="form-group"><label>% Tareas</label>
                    <input type="number" min={0} max={100} value={c.pesoTareas}
                      onChange={(e) => setCriteriosForm({ ...criteriosForm, [nivelId]: { ...c, pesoTareas: e.target.value } })} /></div>
                  <div className="form-group"><label>% Exámenes</label>
                    <input type="number" min={0} max={100} value={c.pesoExamenes}
                      onChange={(e) => setCriteriosForm({ ...criteriosForm, [nivelId]: { ...c, pesoExamenes: e.target.value } })} /></div>
                </div>
                <div className="form-group"><label>Nota mínima aprobatoria (0-20)</label>
                  <input type="number" min={0} max={20} step={0.1} value={c.notaAprobatoria}
                    onChange={(e) => setCriteriosForm({ ...criteriosForm, [nivelId]: { ...c, notaAprobatoria: e.target.value } })} /></div>
                <button className="btn btn-primary btn-sm" onClick={() => guardarCriterio(nivelId)} disabled={savingCriterio === nivelId}>
                  {savingCriterio === nivelId ? "Guardando…" : <><IconCheck size={13} /> Guardar este criterio</>}
                </button>
              </div>
            ))}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalCriterios(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
