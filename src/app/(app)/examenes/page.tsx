"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime, estadoColor } from "@/lib/utils";
import { IconExam, IconPlus, IconEdit, IconTrash, IconLoader, IconClock, IconLocation, IconCheck, IconFile, IconDownload } from "@/components/icons";
import FileUpload from "@/components/FileUpload";

export default function ExamenesPage() {
  const router = useRouter();
  const [examenes, setExamenes] = useState<any[]>([]);
  const [clases, setClases] = useState<any[]>([]);
  const [rol, setRol] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "new" | any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [entregaModal, setEntregaModal] = useState<any | null>(null);
  const [entregaArchivo, setEntregaArchivo] = useState<{ url: string; nombre: string } | null>(null);
  const [entregando, setEntregando] = useState(false);

  const [calificarModal, setCalificarModal] = useState<any | null>(null);
  const [notaForm, setNotaForm] = useState("");
  const [comentarioForm, setComentarioForm] = useState("");

  const load = async () => {
    setLoading(true);
    const resU = await fetch("/api/usuarios/me");
    const usuario = await resU.json();

    // Exclusivo de Profesores y Alumnos; el Admin se redirige a Reportes.
    if (usuario?.rol === "ADMIN") {
      router.replace("/reportes");
      return;
    }

    const [resE, resC] = await Promise.all([fetch("/api/examenes"), fetch("/api/clases")]);
    setExamenes(await resE.json());
    setRol(usuario?.rol ?? "ALUMNO");
    setClases(await resC.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const isProfesor = rol === "PROFESOR";
  const nombreClase = (c: any) => c ? `${c.materia.nombre} — ${c.seccion.grado.nombre} "${c.seccion.nombre}"` : "";

  const openNew = () => {
    setError("");
    setForm({ titulo: "", descripcion: "", archivoUrl: null, archivoNombre: null, fechaInicio: "", fechaLimite: "", duracion: 60, salon: "", claseId: "" });
    setModal("new");
  };
  const openEdit = (e: any) => {
    setError("");
    setForm({
      id: e.id, titulo: e.titulo, descripcion: e.descripcion ?? "",
      archivoUrl: e.archivoUrl, archivoNombre: e.archivoNombre,
      fechaInicio: e.fechaInicio?.slice(0, 16), fechaLimite: e.fechaLimite?.slice(0, 16),
      duracion: e.duracion, salon: e.salon ?? "", claseId: e.claseId,
    });
    setModal(e);
  };
  const close = () => setModal(null);

  const save = async () => {
    if (!form.titulo?.trim() || !form.claseId || !form.fechaLimite) { setError("Completa título, clase y fecha límite"); return; }
    setSaving(true); setError("");
    const method = modal === "new" ? "POST" : "PUT";
    const res = await fetch("/api/examenes", { method, body: JSON.stringify(form) });
    if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    setSaving(false);
    close();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este examen?")) return;
    const res = await fetch("/api/examenes", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    load();
  };

  const abrirEntrega = (ex: any) => { setEntregaArchivo(null); setEntregaModal(ex); };
  const enviarEntrega = async () => {
    if (!entregaArchivo) return;
    setEntregando(true);
    await fetch("/api/respuestas-examen", { method: "PUT", body: JSON.stringify({ examenId: entregaModal.id, archivoUrl: entregaArchivo.url, archivoNombre: entregaArchivo.nombre }) });
    setEntregando(false);
    setEntregaModal(null);
    load();
  };

  const abrirCalificar = (examen: any, respuesta: any) => {
    setNotaForm(respuesta.nota?.toString() ?? "");
    setComentarioForm(respuesta.comentario ?? "");
    setCalificarModal({ examen, respuesta });
  };
  const guardarCalificacion = async () => {
    await fetch("/api/respuestas-examen", {
      method: "PUT",
      body: JSON.stringify({ examenId: calificarModal.examen.id, alumnoId: calificarModal.respuesta.alumnoId, nota: Number(notaForm), comentario: comentarioForm }),
    });
    setCalificarModal(null);
    load();
  };

  if (rol === null && loading) {
    return <div className="empty"><IconLoader size={24} /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>{isProfesor ? "Exámenes" : "Mis Exámenes"}</h1>
        <p>{isProfesor ? "Sube el examen en PDF/texto con fecha límite" : "Consulta y entrega tus respuestas en PDF"}</p>
      </div>
      {isProfesor && (
        <div className="toolbar"><div style={{ flex: 1 }} /><button className="btn btn-primary" onClick={openNew}><IconPlus size={16} /> Nuevo examen</button></div>
      )}

      {loading ? (
        <div className="empty"><IconLoader size={24} /></div>
      ) : examenes.length === 0 ? (
        <div className="empty"><IconExam size={32} style={{ color: "var(--muted)" }} /><p>No hay exámenes {isProfesor ? "programados" : "asignados"}</p></div>
      ) : (
        <div className="card-grid">
          {examenes.map((ex) => {
            const miRespuesta = ex.respuestas?.[0];
            return (
              <div className="info-card" key={ex.id}>
                <div className="info-card-title">{ex.titulo}</div>
                <div className="info-card-meta">
                  <span>{nombreClase(ex.clase)}</span>
                  <span><IconClock size={13} /> Inicio: {formatDateTime(ex.fechaInicio)}</span>
                  <span><IconClock size={13} /> Límite: {formatDateTime(ex.fechaLimite)}</span>
                  <span>{ex.duracion} min</span>
                  {ex.salon && <span><IconLocation size={13} /> {ex.salon}</span>}
                  {ex.descripcion && <span style={{ marginTop: 4 }}>{ex.descripcion}</span>}
                  {ex.archivoUrl && (
                    <a href={ex.archivoUrl} target="_blank" rel="noopener noreferrer" className="file-chip" style={{ marginTop: 6, textDecoration: "none" }}>
                      <IconFile size={14} /><span className="file-chip-name">{ex.archivoNombre}</span><IconDownload size={13} />
                    </a>
                  )}
                </div>

                {isProfesor && (
                  <div style={{ marginTop: 14 }}>
                    <div className="muted-label">Respuestas ({ex.respuestas?.length ?? 0})</div>
                    {ex.respuestas && ex.respuestas.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                        {ex.respuestas.map((r: any) => (
                          <div key={r.id} className="entrega-row">
                            <span style={{ flex: 1, fontSize: ".8rem" }}>{r.alumno.usuario.nombre}</span>
                            <span className="badge" style={{ background: estadoColor(r.estado) + "22", color: estadoColor(r.estado), fontSize: ".7rem" }}>{r.estado}</span>
                            {r.archivoUrl && <a href={r.archivoUrl} target="_blank" rel="noopener noreferrer" title="Ver respuesta"><IconDownload size={13} /></a>}
                            <button className="btn-link" style={{ fontSize: ".75rem" }} onClick={() => abrirCalificar(ex, r)}>{r.nota != null ? `Nota: ${r.nota}` : "Calificar"}</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(ex)}><IconEdit size={14} /> Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(ex.id)}><IconTrash size={14} /> Eliminar</button>
                    </div>
                  </div>
                )}

                {!isProfesor && (
                  <div style={{ marginTop: 14 }}>
                    {miRespuesta?.estado === "CALIFICADO" ? (
                      <span className="badge" style={{ background: "var(--accent2)22", color: "var(--accent2)" }}>Calificado · Nota: {miRespuesta.nota}</span>
                    ) : miRespuesta?.estado === "FUERA_DE_PLAZO" ? (
                      <span className="badge" style={{ background: "var(--danger)22", color: "var(--danger)" }}>Entregado fuera de plazo</span>
                    ) : miRespuesta?.estado === "ENTREGADO" ? (
                      <span className="badge" style={{ background: "var(--green)22", color: "var(--green)" }}><IconCheck size={12} /> Entregado</span>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => abrirEntrega(ex)}>Entregar respuesta</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && isProfesor && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal">
            <h2><IconExam size={20} /> {modal === "new" ? "Nuevo examen" : "Editar examen"}</h2>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-group"><label>Título</label>
              <input value={form.titulo || ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Examen parcial de álgebra" /></div>
            <div className="form-group"><label>Descripción / instrucciones (texto)</label>
              <textarea rows={2} value={form.descripcion || ""} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Temas a evaluar…" /></div>
            <FileUpload
              label="Archivo del examen (PDF)"
              archivoUrl={form.archivoUrl}
              archivoNombre={form.archivoNombre}
              onChange={(url, nombre) => setForm({ ...form, archivoUrl: url, archivoNombre: nombre })}
            />
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
              <div className="form-group"><label>Duración (minutos)</label>
                <input type="number" min={1} value={form.duracion || 60} onChange={(e) => setForm({ ...form, duracion: e.target.value })} /></div>
              <div className="form-group"><label>Salón</label>
                <input value={form.salon || ""} onChange={(e) => setForm({ ...form, salon: e.target.value })} placeholder="Ej: Aula 12" /></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {entregaModal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setEntregaModal(null)}>
          <div className="modal">
            <h2><IconExam size={20} /> Entregar: {entregaModal.titulo}</h2>
            <FileUpload
              label="Tus respuestas (PDF o imagen)"
              archivoUrl={entregaArchivo?.url}
              archivoNombre={entregaArchivo?.nombre}
              onChange={(url, nombre) => setEntregaArchivo(url ? { url, nombre: nombre! } : null)}
            />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEntregaModal(null)} disabled={entregando}>Cancelar</button>
              <button className="btn btn-primary" onClick={enviarEntrega} disabled={!entregaArchivo || entregando}>{entregando ? "Enviando…" : "Entregar"}</button>
            </div>
          </div>
        </div>
      )}

      {calificarModal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setCalificarModal(null)}>
          <div className="modal">
            <h2><IconCheck size={20} /> Calificar a {calificarModal.respuesta.alumno.usuario.nombre}</h2>
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
