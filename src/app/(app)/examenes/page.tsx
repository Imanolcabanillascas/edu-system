"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime, estadoColor } from "@/lib/utils";
import {
  IconExam, IconPlus, IconEdit, IconTrash, IconLoader, IconClock,
  IconLocation, IconCheck, IconX, IconFile, IconDownload, IconAlert,
} from "@/components/icons";
import FileUpload from "@/components/FileUpload";

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Opcion { texto: string; correcta: boolean; }
interface Pregunta { texto: string; puntaje: number; opciones: Opcion[]; }

const preguntaVacia = (): Pregunta => ({
  texto: "", puntaje: 1,
  opciones: [
    { texto: "", correcta: true }, { texto: "", correcta: false },
    { texto: "", correcta: false }, { texto: "", correcta: false },
  ],
});

export default function ExamenesPage() {
  const router = useRouter();
  const [examenes, setExamenes] = useState<any[]>([]);
  const [clases, setClases] = useState<any[]>([]);
  const [rol, setRol] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal tipo PDF
  const [modalPdf, setModalPdf] = useState<null | "new" | any>(null);
  const [formPdf, setFormPdf] = useState<any>({});
  const [savingPdf, setSavingPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState("");

  // Modal tipo Selección
  const [modalSel, setModalSel] = useState<null | "new">(null);
  const [formSel, setFormSel] = useState<any>({});
  const [preguntas, setPreguntas] = useState<Pregunta[]>([preguntaVacia()]);
  const [savingSel, setSavingSel] = useState(false);
  const [errorSel, setErrorSel] = useState("");

  // Modal entrega alumno (PDF)
  const [entregaModal, setEntregaModal] = useState<any | null>(null);
  const [entregaArchivo, setEntregaArchivo] = useState<{ url: string; nombre: string } | null>(null);
  const [entregando, setEntregando] = useState(false);

  // Modal calificar (profesor)
  const [calificarModal, setCalificarModal] = useState<any | null>(null);
  const [notaForm, setNotaForm] = useState("");
  const [comentarioForm, setComentarioForm] = useState("");

  const load = async () => {
    setLoading(true);
    const resU = await fetch("/api/usuarios/me");
    const usuario = await resU.json();
    if (usuario?.rol === "ADMIN") { router.replace("/reportes"); return; }
    setRol(usuario?.rol ?? "ALUMNO");

    const [resE, resC] = await Promise.all([fetch("/api/examenes"), fetch("/api/clases")]);
    setExamenes(await resE.json());
    setClases(await resC.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const isProfesor = rol === "PROFESOR";
  const nombreClase = (c: any) => c
    ? `${c.planEstudio?.materia?.nombre ?? c.materia?.nombre ?? "?"} — ${c.seccion?.grado?.nombre} "${c.seccion?.nombre}"`
    : "";

  // ── PDF: crear / editar ───────────────────────────────────────────────────
  const openNewPdf = () => {
    setFormPdf({ titulo: "", descripcion: "", archivoUrl: null, archivoNombre: null, claseId: "", fechaInicio: "", fechaLimite: "", duracion: 60, salon: "" });
    setErrorPdf(""); setModalPdf("new");
  };
  const openEditPdf = (e: any) => {
    setFormPdf({
      id: e.id, titulo: e.titulo, descripcion: e.descripcion ?? "",
      archivoUrl: e.archivoUrl, archivoNombre: e.archivoNombre,
      fechaInicio: e.fechaInicio?.slice(0, 16), fechaLimite: e.fechaLimite?.slice(0, 16),
      duracion: e.duracion, salon: e.salon ?? "", claseId: e.claseId,
    });
    setErrorPdf(""); setModalPdf(e);
  };
  const savePdf = async () => {
    if (!formPdf.titulo?.trim() || !formPdf.claseId || !formPdf.fechaLimite) {
      setErrorPdf("Completa título, clase y fecha límite"); return;
    }
    setSavingPdf(true); setErrorPdf("");
    const method = modalPdf === "new" ? "POST" : "PUT";
    const res = await fetch("/api/examenes", { method, body: JSON.stringify(formPdf) });
    if (!res.ok) { setErrorPdf((await res.json()).error); setSavingPdf(false); return; }
    setSavingPdf(false); setModalPdf(null); load();
  };

  // ── Selección: crear ──────────────────────────────────────────────────────
  const openNewSel = () => {
    setFormSel({ titulo: "", descripcion: "", claseId: "", fechaInicio: "", fechaLimite: "", duracion: 60, salon: "" });
    setPreguntas([preguntaVacia()]); setErrorSel(""); setModalSel("new");
  };

  const addPregunta = () => setPreguntas([...preguntas, preguntaVacia()]);
  const removePregunta = (pi: number) => setPreguntas(preguntas.filter((_, i) => i !== pi));
  const updatePregunta = (pi: number, field: keyof Pregunta, value: any) =>
    setPreguntas(preguntas.map((p, i) => i === pi ? { ...p, [field]: value } : p));
  const updateOpcion = (pi: number, oi: number, field: keyof Opcion, value: any) =>
    setPreguntas(preguntas.map((p, i) => {
      if (i !== pi) return p;
      const opciones = p.opciones.map((o, j) => {
        if (field === "correcta") return { ...o, correcta: j === oi };
        return j === oi ? { ...o, [field]: value } : o;
      });
      return { ...p, opciones };
    }));
  const addOpcion = (pi: number) =>
    setPreguntas(preguntas.map((p, i) => i === pi ? { ...p, opciones: [...p.opciones, { texto: "", correcta: false }] } : p));
  const removeOpcion = (pi: number, oi: number) =>
    setPreguntas(preguntas.map((p, i) => {
      if (i !== pi) return p;
      const opciones = p.opciones.filter((_, j) => j !== oi);
      if (!opciones.some((o) => o.correcta) && opciones.length > 0) opciones[0].correcta = true;
      return { ...p, opciones };
    }));

  const saveSel = async () => {
    if (!formSel.titulo?.trim() || !formSel.claseId || !formSel.fechaLimite) {
      setErrorSel("Completa título, clase y fecha límite"); return;
    }
    if (preguntas.length === 0) { setErrorSel("Agrega al menos una pregunta"); return; }
    for (const p of preguntas) {
      if (!p.texto.trim()) { setErrorSel("Todas las preguntas deben tener texto"); return; }
      if (p.opciones.length < 2) { setErrorSel("Cada pregunta necesita al menos 2 opciones"); return; }
      if (p.opciones.some((o) => !o.texto.trim())) { setErrorSel("Todas las opciones deben tener texto"); return; }
      if (!p.opciones.some((o) => o.correcta)) { setErrorSel("Marca una opción correcta por pregunta"); return; }
    }
    setSavingSel(true); setErrorSel("");
    const res = await fetch("/api/examenes-seleccion", { method: "POST", body: JSON.stringify({ ...formSel, preguntas }) });
    if (!res.ok) { setErrorSel((await res.json()).error); setSavingSel(false); return; }
    setSavingSel(false); setModalSel(null); load();
  };

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este examen?")) return;
    await fetch("/api/examenes", { method: "DELETE", body: JSON.stringify({ id }) });
    load();
  };

  // ── Entrega alumno (PDF) ──────────────────────────────────────────────────
  const enviarEntrega = async () => {
    if (!entregaArchivo) return;
    setEntregando(true);
    await fetch("/api/respuestas-examen", {
      method: "PUT",
      body: JSON.stringify({ examenId: entregaModal.id, archivoUrl: entregaArchivo.url, archivoNombre: entregaArchivo.nombre }),
    });
    setEntregando(false); setEntregaModal(null); load();
  };

  // ── Calificar (profesor) ──────────────────────────────────────────────────
  const guardarCalificacion = async () => {
    await fetch("/api/respuestas-examen", {
      method: "PUT",
      body: JSON.stringify({ examenId: calificarModal.examen.id, alumnoId: calificarModal.respuesta.alumnoId, nota: Number(notaForm), comentario: comentarioForm }),
    });
    setCalificarModal(null); load();
  };

  if (rol === null && loading) return <div className="empty"><IconLoader size={24} /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>{isProfesor ? "Exámenes" : "Mis Exámenes"}</h1>
        <p>{isProfesor ? "Gestiona exámenes PDF y de selección múltiple" : "Tus exámenes pendientes y realizados"}</p>
      </div>

      {isProfesor && (
        <div className="toolbar">
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={openNewSel}>
            <IconCheck size={16} /> Nuevo examen de selección
          </button>
          <button className="btn btn-primary" onClick={openNewPdf}>
            <IconPlus size={16} /> Nuevo examen PDF
          </button>
        </div>
      )}

      {loading ? (
        <div className="empty"><IconLoader size={24} /></div>
      ) : examenes.length === 0 ? (
        <div className="empty">
          <IconExam size={32} style={{ color: "var(--muted)" }} />
          <p>{isProfesor ? "No hay exámenes creados todavía" : "No hay exámenes asignados"}</p>
        </div>
      ) : (
        <div className="card-grid">
          {examenes.map((ex) => {
            const miRespuesta = ex.respuestas?.[0];
            const esSeleccion = ex.tipo === "SELECCION";

            return (
              <div className="info-card" key={ex.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div className="info-card-title">{ex.titulo}</div>
                  <span className="badge" style={{
                    background: esSeleccion ? "var(--accent2)22" : "var(--accent)22",
                    color: esSeleccion ? "var(--accent2)" : "var(--accent)",
                    flexShrink: 0, fontSize: ".7rem",
                  }}>
                    {esSeleccion ? "Selección múltiple" : "PDF"}
                  </span>
                </div>

                <div className="info-card-meta">
                  <span>{nombreClase(ex.clase)}</span>
                  <span><IconClock size={13} /> Límite: {formatDateTime(ex.fechaLimite)}</span>
                  <span>{ex.duracion} min{ex.salon ? ` · ${ex.salon}` : ""}</span>
                  {esSeleccion && ex.preguntas && (
                    <span>{ex.preguntas.length} pregunta(s)</span>
                  )}
                  {!esSeleccion && ex.archivoUrl && (
                    <a href={ex.archivoUrl} target="_blank" rel="noopener noreferrer"
                      className="file-chip" style={{ marginTop: 6, textDecoration: "none" }}>
                      <IconFile size={14} />
                      <span className="file-chip-name">{ex.archivoNombre}</span>
                      <IconDownload size={13} />
                    </a>
                  )}
                </div>

                {/* Vista Profesor */}
                {isProfesor && (
                  <div style={{ marginTop: 14 }}>
                    <div className="muted-label">
                      Respuestas ({ex.respuestas?.length ?? 0})
                    </div>
                    {ex.respuestas && ex.respuestas.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                        {ex.respuestas.map((r: any) => (
                          <div key={r.id} className="entrega-row">
                            <span style={{ flex: 1, fontSize: ".8rem" }}>{r.alumno.usuario.nombre}</span>
                            <span className="badge" style={{
                              background: estadoColor(r.estado) + "22",
                              color: estadoColor(r.estado), fontSize: ".7rem",
                            }}>{r.estado}</span>
                            {r.nota != null && (
                              <span style={{ fontSize: ".75rem", fontWeight: 600, color: "var(--accent2)" }}>
                                {r.nota}
                              </span>
                            )}
                            {!esSeleccion && r.archivoUrl && (
                              <a href={r.archivoUrl} target="_blank" rel="noopener noreferrer" title="Ver respuesta">
                                <IconDownload size={13} />
                              </a>
                            )}
                            {!esSeleccion && (
                              <button className="btn-link" style={{ fontSize: ".75rem" }}
                                onClick={() => { setNotaForm(r.nota?.toString() ?? ""); setComentarioForm(r.comentario ?? ""); setCalificarModal({ examen: ex, respuesta: r }); }}>
                                {r.nota != null ? "Editar nota" : "Calificar"}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      {!esSeleccion && (
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditPdf(ex)}>
                          <IconEdit size={14} /> Editar
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => remove(ex.id)}>
                        <IconTrash size={14} /> Eliminar
                      </button>
                    </div>
                  </div>
                )}

                {/* Vista Alumno */}
                {!isProfesor && (
                  <div style={{ marginTop: 14 }}>
                    {esSeleccion ? (
                      miRespuesta?.estado === "CALIFICADO" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span className="badge" style={{ background: "var(--accent2)22", color: "var(--accent2)", width: "fit-content" }}>
                            Nota: {miRespuesta.nota}
                          </span>
                          <button className="btn btn-ghost btn-sm" style={{ width: "fit-content" }}
                            onClick={() => router.push(`/rendir-examen?id=${ex.id}`)}>
                            Ver corrección
                          </button>
                        </div>
                      ) : miRespuesta ? (
                        <span className="badge" style={{ background: "var(--green)22", color: "var(--green)" }}>
                          <IconCheck size={12} /> Enviado
                        </span>
                      ) : (
                        <button className="btn btn-primary btn-sm"
                          onClick={() => router.push(`/rendir-examen?id=${ex.id}`)}>
                          Rendir examen
                        </button>
                      )
                    ) : (
                      miRespuesta?.estado === "CALIFICADO" ? (
                        <span className="badge" style={{ background: "var(--accent2)22", color: "var(--accent2)" }}>
                          Calificado · Nota: {miRespuesta.nota}
                        </span>
                      ) : miRespuesta?.estado === "FUERA_DE_PLAZO" ? (
                        <span className="badge" style={{ background: "var(--danger)22", color: "var(--danger)" }}>
                          Entregado fuera de plazo
                        </span>
                      ) : miRespuesta?.estado === "ENTREGADO" ? (
                        <span className="badge" style={{ background: "var(--green)22", color: "var(--green)" }}>
                          <IconCheck size={12} /> Entregado
                        </span>
                      ) : (
                        <button className="btn btn-primary btn-sm"
                          onClick={() => { setEntregaArchivo(null); setEntregaModal(ex); }}>
                          Subir respuesta
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nuevo examen PDF */}
      {modalPdf && isProfesor && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalPdf(null)}>
          <div className="modal">
            <h2><IconExam size={20} /> {modalPdf === "new" ? "Nuevo examen PDF" : "Editar examen"}</h2>
            {errorPdf && <div className="alert-error">{errorPdf}</div>}
            <div className="form-group"><label>Título</label>
              <input value={formPdf.titulo || ""} onChange={(e) => setFormPdf({ ...formPdf, titulo: e.target.value })} placeholder="Ej: Examen parcial" /></div>
            <div className="form-group"><label>Descripción</label>
              <textarea rows={2} value={formPdf.descripcion || ""} onChange={(e) => setFormPdf({ ...formPdf, descripcion: e.target.value })} /></div>
            <FileUpload label="Archivo del examen (PDF)" archivoUrl={formPdf.archivoUrl} archivoNombre={formPdf.archivoNombre}
              onChange={(url, nombre) => setFormPdf({ ...formPdf, archivoUrl: url, archivoNombre: nombre })} />
            <div className="form-group"><label>Clase</label>
              <select value={formPdf.claseId || ""} onChange={(e) => setFormPdf({ ...formPdf, claseId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {clases.map((c: any) => <option key={c.id} value={c.id}>{nombreClase(c)}</option>)}
              </select></div>
            <div className="form-row">
              <div className="form-group"><label>Fecha inicio</label>
                <input type="datetime-local" value={formPdf.fechaInicio || ""} onChange={(e) => setFormPdf({ ...formPdf, fechaInicio: e.target.value })} /></div>
              <div className="form-group"><label>Fecha límite</label>
                <input type="datetime-local" value={formPdf.fechaLimite || ""} onChange={(e) => setFormPdf({ ...formPdf, fechaLimite: e.target.value })} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Duración (min)</label>
                <input type="number" min={1} value={formPdf.duracion || 60} onChange={(e) => setFormPdf({ ...formPdf, duracion: e.target.value })} /></div>
              <div className="form-group"><label>Salón</label>
                <input value={formPdf.salon || ""} onChange={(e) => setFormPdf({ ...formPdf, salon: e.target.value })} placeholder="Ej: Aula 3" /></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalPdf(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={savePdf} disabled={savingPdf}>{savingPdf ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo examen de selección */}
      {modalSel && isProfesor && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalSel(null)}>
          <div className="modal" style={{ maxWidth: 700, maxHeight: "90vh", overflowY: "auto" }}>
            <h2><IconCheck size={20} /> Nuevo examen de selección múltiple</h2>
            {errorSel && <div className="alert-error">{errorSel}</div>}
            <div className="form-group"><label>Título</label>
              <input value={formSel.titulo || ""} onChange={(e) => setFormSel({ ...formSel, titulo: e.target.value })} placeholder="Ej: Examen parcial — Matemáticas" /></div>
            <div className="form-group"><label>Descripción (opcional)</label>
              <textarea rows={2} value={formSel.descripcion || ""} onChange={(e) => setFormSel({ ...formSel, descripcion: e.target.value })} /></div>
            <div className="form-group"><label>Clase</label>
              <select value={formSel.claseId || ""} onChange={(e) => setFormSel({ ...formSel, claseId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {clases.map((c: any) => <option key={c.id} value={c.id}>{nombreClase(c)}</option>)}
              </select></div>
            <div className="form-row">
              <div className="form-group"><label>Fecha inicio</label>
                <input type="datetime-local" value={formSel.fechaInicio || ""} onChange={(e) => setFormSel({ ...formSel, fechaInicio: e.target.value })} /></div>
              <div className="form-group"><label>Fecha límite</label>
                <input type="datetime-local" value={formSel.fechaLimite || ""} onChange={(e) => setFormSel({ ...formSel, fechaLimite: e.target.value })} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Duración (min)</label>
                <input type="number" min={1} value={formSel.duracion || 60} onChange={(e) => setFormSel({ ...formSel, duracion: e.target.value })} /></div>
              <div className="form-group"><label>Salón</label>
                <input value={formSel.salon || ""} onChange={(e) => setFormSel({ ...formSel, salon: e.target.value })} placeholder="Ej: Aula 3" /></div>
            </div>

            <div className="form-divider" style={{ marginTop: 20 }}>
              Preguntas ({preguntas.length}) — Total: {preguntas.reduce((s, p) => s + p.puntaje, 0)} pt
            </div>

            {preguntas.map((p, pi) => (
              <div key={pi} style={{ background: "var(--surface2)", borderRadius: 10, padding: 16, marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, color: "var(--accent2)", minWidth: 24 }}>{pi + 1}.</div>
                  <input style={{ flex: 1 }} value={p.texto}
                    onChange={(e) => updatePregunta(pi, "texto", e.target.value)}
                    placeholder="Texto de la pregunta…" />
                  <input type="number" min={0.5} step={0.5} value={p.puntaje}
                    onChange={(e) => updatePregunta(pi, "puntaje", Number(e.target.value))}
                    style={{ width: 70 }} title="Puntaje" />
                  {preguntas.length > 1 && (
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => removePregunta(pi)}>
                      <IconTrash size={13} />
                    </button>
                  )}
                </div>
                {p.opciones.map((o, oi) => (
                  <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, paddingLeft: 28 }}>
                    <input type="radio" name={`correcta-${pi}`} checked={o.correcta}
                      onChange={() => updateOpcion(pi, oi, "correcta", true)} title="Correcta" />
                    <input style={{ flex: 1 }} value={o.texto}
                      onChange={(e) => updateOpcion(pi, oi, "texto", e.target.value)}
                      placeholder={`Opción ${String.fromCharCode(65 + oi)}…`} />
                    {p.opciones.length > 2 && (
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeOpcion(pi, oi)}>
                        <IconX size={12} />
                      </button>
                    )}
                    {o.correcta && <IconCheck size={14} style={{ color: "var(--green)", flexShrink: 0 }} />}
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 28, marginTop: 4 }} onClick={() => addOpcion(pi)}>
                  <IconPlus size={13} /> Agregar opción
                </button>
              </div>
            ))}

            <button className="btn btn-ghost" onClick={addPregunta} style={{ marginBottom: 20 }}>
              <IconPlus size={16} /> Agregar pregunta
            </button>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalSel(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveSel} disabled={savingSel}>
                {savingSel ? "Guardando…" : "Crear examen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal entrega alumno (PDF) */}
      {entregaModal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setEntregaModal(null)}>
          <div className="modal">
            <h2><IconExam size={20} /> Subir respuesta: {entregaModal.titulo}</h2>
            <FileUpload label="Tu respuesta (PDF o imagen)" archivoUrl={entregaArchivo?.url} archivoNombre={entregaArchivo?.nombre}
              onChange={(url, nombre) => setEntregaArchivo(url ? { url, nombre: nombre! } : null)} />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEntregaModal(null)} disabled={entregando}>Cancelar</button>
              <button className="btn btn-primary" onClick={enviarEntrega} disabled={!entregaArchivo || entregando}>
                {entregando ? "Enviando…" : "Entregar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal calificar (profesor) */}
      {calificarModal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setCalificarModal(null)}>
          <div className="modal">
            <h2><IconCheck size={20} /> Calificar a {calificarModal.respuesta.alumno?.usuario?.nombre}</h2>
            <div className="form-group"><label>Nota (0-20)</label>
              <input type="number" min={0} max={20} step={0.1} value={notaForm} onChange={(e) => setNotaForm(e.target.value)} /></div>
            <div className="form-group"><label>Comentario (opcional)</label>
              <textarea rows={3} value={comentarioForm} onChange={(e) => setComentarioForm(e.target.value)} /></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setCalificarModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarCalificacion}>Guardar nota</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}