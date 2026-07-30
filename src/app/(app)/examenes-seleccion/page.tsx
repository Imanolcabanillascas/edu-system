"use client";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/utils";
import { IconExam, IconPlus, IconTrash, IconLoader, IconClock, IconCheck, IconX, IconEdit } from "@/components/icons";

interface Opcion { texto: string; correcta: boolean; }
interface Pregunta { texto: string; puntaje: number; opciones: Opcion[]; }

const preguntaVacia = (): Pregunta => ({
  texto: "",
  puntaje: 1,
  opciones: [
    { texto: "", correcta: true },
    { texto: "", correcta: false },
    { texto: "", correcta: false },
    { texto: "", correcta: false },
  ],
});

export default function ExamenesSeleccionPage() {
  const [examenes, setExamenes] = useState<any[]>([]);
  const [clases, setClases] = useState<any[]>([]);
  const [rol, setRol] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "new" | string>(null);
  const [form, setForm] = useState<any>({});
  const [preguntas, setPreguntas] = useState<Pregunta[]>([preguntaVacia()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const [resE, resU, resC] = await Promise.all([fetch("/api/examenes"), fetch("/api/usuarios/me"), fetch("/api/clases")]);
    const examenesData = await resE.json();
    // Filtra solo los de tipo SELECCION
    setExamenes(examenesData.filter((e: any) => e.tipo === "SELECCION"));
    const u = await resU.json();
    setRol(u?.rol ?? null);
    setClases(await resC.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const isProfesor = rol === "PROFESOR";
  const nombreClase = (c: any) => c ? `${c.planEstudio?.materia?.nombre ?? c.materia?.nombre ?? "?"} — ${c.seccion?.grado?.nombre} "${c.seccion?.nombre}"` : "";

  const openNew = () => {
    setForm({ titulo: "", descripcion: "", claseId: "", fechaInicio: "", fechaLimite: "", duracion: 60, salon: "" });
    setPreguntas([preguntaVacia()]);
    setError(""); setModal("new");
  };
  const close = () => setModal(null);

  // ── Manejo de preguntas ──────────────────────────────────────────────
  const addPregunta = () => setPreguntas([...preguntas, preguntaVacia()]);
  const removePregunta = (pi: number) => setPreguntas(preguntas.filter((_, i) => i !== pi));

  const updatePregunta = (pi: number, field: keyof Pregunta, value: any) => {
    setPreguntas(preguntas.map((p, i) => i === pi ? { ...p, [field]: value } : p));
  };

  const updateOpcion = (pi: number, oi: number, field: keyof Opcion, value: any) => {
    setPreguntas(preguntas.map((p, i) => {
      if (i !== pi) return p;
      const opciones = p.opciones.map((o, j) => {
        if (field === "correcta") return { ...o, correcta: j === oi }; // solo una correcta
        return j === oi ? { ...o, [field]: value } : o;
      });
      return { ...p, opciones };
    }));
  };

  const addOpcion = (pi: number) => {
    setPreguntas(preguntas.map((p, i) =>
      i === pi ? { ...p, opciones: [...p.opciones, { texto: "", correcta: false }] } : p
    ));
  };

  const removeOpcion = (pi: number, oi: number) => {
    setPreguntas(preguntas.map((p, i) => {
      if (i !== pi) return p;
      const opciones = p.opciones.filter((_, j) => j !== oi);
      // Si la correcta fue eliminada, marca la primera como correcta
      const hayCorrecta = opciones.some((o) => o.correcta);
      if (!hayCorrecta && opciones.length > 0) opciones[0].correcta = true;
      return { ...p, opciones };
    }));
  };

  const save = async () => {
    if (!form.titulo?.trim() || !form.claseId || !form.fechaLimite) {
      setError("Completa título, clase y fecha límite"); return;
    }
    if (preguntas.length === 0) { setError("Agrega al menos una pregunta"); return; }
    for (const p of preguntas) {
      if (!p.texto.trim()) { setError("Todas las preguntas deben tener texto"); return; }
      if (p.opciones.length < 2) { setError("Cada pregunta necesita al menos 2 opciones"); return; }
      if (p.opciones.some((o) => !o.texto.trim())) { setError("Todas las opciones deben tener texto"); return; }
      if (!p.opciones.some((o) => o.correcta)) { setError("Marca una opción correcta por pregunta"); return; }
    }

    setSaving(true); setError("");
    const res = await fetch("/api/examenes-seleccion", {
      method: "POST",
      body: JSON.stringify({ ...form, preguntas }),
    });
    if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    setSaving(false); close(); load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este examen?")) return;
    await fetch("/api/examenes", { method: "DELETE", body: JSON.stringify({ id }) });
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1><IconExam size={24} /> Exámenes de Selección Múltiple</h1>
        <p>Crea exámenes con corrección automática — los alumnos ven las preguntas en orden aleatorio</p>
      </div>

      {isProfesor && (
        <div className="toolbar">
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={openNew}><IconPlus size={16} /> Nuevo examen</button>
        </div>
      )}

      {loading ? (
        <div className="empty"><IconLoader size={24} /></div>
      ) : examenes.length === 0 ? (
        <div className="empty"><IconExam size={32} style={{ color: "var(--muted)" }} />
          <p>{isProfesor ? "No hay exámenes de selección creados" : "No hay exámenes disponibles"}</p>
        </div>
      ) : (
        <div className="card-grid">
          {examenes.map((e) => (
            <div className="info-card" key={e.id}>
              <div className="info-card-title">
                {e.titulo}
                {isProfesor && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => remove(e.id)}><IconTrash size={14} /></button>
                  </div>
                )}
              </div>
              <div className="info-card-meta">
                <span>{nombreClase(e.clase)}</span>
                <span><IconClock size={13} /> Límite: {formatDateTime(e.fechaLimite)}</span>
                <span>{e.duracion} min · {e.preguntas?.length ?? 0} preguntas</span>
                <span className="badge" style={{ background: "var(--accent2)22", color: "var(--accent2)", width: "fit-content" }}>
                  Selección múltiple
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear examen */}
      {modal === "new" && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal" style={{ maxWidth: 700, maxHeight: "90vh", overflowY: "auto" }}>
            <h2><IconExam size={20} /> Nuevo examen de selección múltiple</h2>
            {error && <div className="alert-error">{error}</div>}

            <div className="form-group"><label>Título</label>
              <input value={form.titulo || ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Examen parcial — Matemáticas" /></div>
            <div className="form-group"><label>Descripción (opcional)</label>
              <textarea rows={2} value={form.descripcion || ""} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Instrucciones adicionales…" /></div>
            <div className="form-group"><label>Clase</label>
              <select value={form.claseId || ""} onChange={(e) => setForm({ ...form, claseId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {clases.map((c: any) => <option key={c.id} value={c.id}>{nombreClase(c)}</option>)}
              </select></div>
            <div className="form-row">
              <div className="form-group"><label>Fecha y hora de inicio</label>
                <input type="datetime-local" value={form.fechaInicio || ""} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} /></div>
              <div className="form-group"><label>Fecha y hora límite</label>
                <input type="datetime-local" value={form.fechaLimite || ""} onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Duración (min)</label>
                <input type="number" min={1} value={form.duracion || 60} onChange={(e) => setForm({ ...form, duracion: e.target.value })} /></div>
              <div className="form-group"><label>Salón (opcional)</label>
                <input value={form.salon || ""} onChange={(e) => setForm({ ...form, salon: e.target.value })} placeholder="Ej: Aula 3" /></div>
            </div>

            {/* Preguntas */}
            <div className="form-divider" style={{ marginTop: 20 }}>Preguntas ({preguntas.length})</div>

            {preguntas.map((p, pi) => (
              <div key={pi} style={{ background: "var(--surface2)", borderRadius: 10, padding: 16, marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, color: "var(--accent2)", minWidth: 24 }}>{pi + 1}.</div>
                  <input
                    style={{ flex: 1 }}
                    value={p.texto}
                    onChange={(e) => updatePregunta(pi, "texto", e.target.value)}
                    placeholder="Texto de la pregunta…"
                  />
                  <input
                    type="number" min={0.5} step={0.5}
                    value={p.puntaje}
                    onChange={(e) => updatePregunta(pi, "puntaje", Number(e.target.value))}
                    style={{ width: 70 }}
                    title="Puntaje de esta pregunta"
                  />
                  {preguntas.length > 1 && (
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => removePregunta(pi)} title="Eliminar pregunta">
                      <IconTrash size={13} />
                    </button>
                  )}
                </div>

                {/* Opciones */}
                {p.opciones.map((o, oi) => (
                  <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, paddingLeft: 28 }}>
                    <input
                      type="radio" name={`correcta-${pi}`} checked={o.correcta}
                      onChange={() => updateOpcion(pi, oi, "correcta", true)}
                      title="Marcar como correcta"
                    />
                    <input
                      style={{ flex: 1 }}
                      value={o.texto}
                      onChange={(e) => updateOpcion(pi, oi, "texto", e.target.value)}
                      placeholder={`Opción ${String.fromCharCode(65 + oi)}…`}
                    />
                    {p.opciones.length > 2 && (
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeOpcion(pi, oi)} title="Eliminar opción">
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

            <div className="form-hint" style={{ marginBottom: 16 }}>
              Total: {preguntas.length} pregunta(s) · {preguntas.reduce((s, p) => s + p.puntaje, 0)} punto(s) · Nota sobre 20
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Crear examen"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
