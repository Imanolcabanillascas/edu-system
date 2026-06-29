"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime, estadoColor } from "@/lib/utils";
import { IconTask, IconPlus, IconEdit, IconTrash, IconLoader, IconClock, IconCheck, IconFile, IconDownload } from "@/components/icons";
import FileUpload from "@/components/FileUpload";

export default function TareasPage() {
  const router = useRouter();
  const [tareas, setTareas] = useState<any[]>([]);
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

    // Este apartado es exclusivo de Profesores y Alumnos; el Admin se redirige a Reportes.
    if (usuario?.rol === "ADMIN") {
      router.replace("/reportes");
      return;
    }

    const [resT, resC] = await Promise.all([fetch("/api/tareas"), fetch("/api/clases")]);
    setTareas(await resT.json());
    setRol(usuario?.rol ?? "ALUMNO");
    setClases(await resC.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const isProfesor = rol === "PROFESOR";
  const nombreClase = (c: any) => c ? `${c.materia.nombre} — ${c.seccion.grado.nombre} "${c.seccion.nombre}"` : "";

  const openNew = () => {
    setError("");
    setForm({ titulo: "", descripcion: "", archivoUrl: null, archivoNombre: null, fechaInicio: "", fechaLimite: "", estado: "PUBLICADA", claseId: "" });
    setModal("new");
  };
  const openEdit = (t: any) => {
    setError("");
    setForm({
      id: t.id, titulo: t.titulo, descripcion: t.descripcion ?? "",
      archivoUrl: t.archivoUrl, archivoNombre: t.archivoNombre,
      fechaInicio: t.fechaInicio?.slice(0, 16), fechaLimite: t.fechaLimite?.slice(0, 16),
      estado: t.estado, claseId: t.claseId,
    });
    setModal(t);
  };
  const close = () => setModal(null);

  const save = async () => {
    if (!form.titulo?.trim() || !form.claseId || !form.fechaLimite) { setError("Completa título, clase y fecha límite"); return; }
    setSaving(true); setError("");
    const method = modal === "new" ? "POST" : "PUT";
    const res = await fetch("/api/tareas", { method, body: JSON.stringify(form) });
    if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    setSaving(false);
    close();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    const res = await fetch("/api/tareas", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    load();
  };

  const abrirEntrega = (t: any) => { setEntregaArchivo(null); setEntregaModal(t); };
  const enviarEntrega = async () => {
    if (!entregaArchivo) return;
    setEntregando(true);
    await fetch("/api/entregas", { method: "PUT", body: JSON.stringify({ tareaId: entregaModal.id, archivoUrl: entregaArchivo.url, archivoNombre: entregaArchivo.nombre }) });
    setEntregando(false);
    setEntregaModal(null);
    load();
  };

  const abrirCalificar = (tarea: any, entrega: any) => {
    setNotaForm(entrega.nota?.toString() ?? "");
    setComentarioForm(entrega.comentario ?? "");
    setCalificarModal({ tarea, entrega });
  };
  const guardarCalificacion = async () => {
    await fetch("/api/entregas", {
      method: "PUT",
      body: JSON.stringify({ tareaId: calificarModal.tarea.id, alumnoId: calificarModal.entrega.alumnoId, nota: Number(notaForm), comentario: comentarioForm }),
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
        <h1>{isProfesor ? "Tareas" : "Mis Tareas"}</h1>
        <p>{isProfesor ? "Sube la tarea en PDF/texto con fecha límite" : "Revisa y entrega tus tareas en PDF antes del plazo"}</p>
      </div>
      {isProfesor && (
        <div className="toolbar"><div style={{ flex: 1 }} /><button className="btn btn-primary" onClick={openNew}><IconPlus size={16} /> Nueva tarea</button></div>
      )}

      {loading ? (
        <div className="empty"><IconLoader size={24} /></div>
      ) : tareas.length === 0 ? (
        <div className="empty"><IconTask size={32} style={{ color: "var(--muted)" }} /><p>No hay tareas{isProfesor ? " creadas todavía" : " asignadas"}</p></div>
      ) : (
        <div className="card-grid">
          {tareas.map((t) => {
            const miEntrega = t.entregas?.[0];
            return (
              <div className="info-card" key={t.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div className="info-card-title">{t.titulo}</div>
                  <span className="badge" style={{ background: estadoColor(t.estado) + "22", color: estadoColor(t.estado), flexShrink: 0 }}>{t.estado}</span>
                </div>
                <div className="info-card-meta">
                  <span>{nombreClase(t.clase)}</span>
                  <span><IconClock size={13} /> Inicio: {formatDateTime(t.fechaInicio)}</span>
                  <span><IconClock size={13} /> Límite: {formatDateTime(t.fechaLimite)}</span>
                  {t.descripcion && <span style={{ marginTop: 4 }}>{t.descripcion}</span>}
                  {t.archivoUrl && (
                    <a href={t.archivoUrl} target="_blank" rel="noopener noreferrer" className="file-chip" style={{ marginTop: 6, textDecoration: "none" }}>
                      <IconFile size={14} /><span className="file-chip-name">{t.archivoNombre}</span><IconDownload size={13} />
                    </a>
                  )}
                </div>

                {isProfesor && (
                  <div style={{ marginTop: 14 }}>
                    <div className="muted-label">Entregas ({t.entregas?.length ?? 0}/{t.clase?.alumnos?.length ?? "—"})</div>
                    {t.entregas && t.entregas.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                        {t.entregas.map((e: any) => (
                          <div key={e.id} className="entrega-row">
                            <span style={{ flex: 1, fontSize: ".8rem" }}>{e.alumno.usuario.nombre}</span>
                            <span className="badge" style={{ background: estadoColor(e.estado) + "22", color: estadoColor(e.estado), fontSize: ".7rem" }}>{e.estado}</span>
                            {e.archivoUrl && <a href={e.archivoUrl} target="_blank" rel="noopener noreferrer" title="Ver entrega"><IconDownload size={13} /></a>}
                            <button className="btn-link" style={{ fontSize: ".75rem" }} onClick={() => abrirCalificar(t, e)}>{e.nota != null ? `Nota: ${e.nota}` : "Calificar"}</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}><IconEdit size={14} /> Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(t.id)}><IconTrash size={14} /> Eliminar</button>
                    </div>
                  </div>
                )}

                {!isProfesor && (
                  <div style={{ marginTop: 14 }}>
                    {miEntrega?.estado === "CALIFICADA" ? (
                      <span className="badge" style={{ background: "var(--accent2)22", color: "var(--accent2)" }}>Calificada · Nota: {miEntrega.nota}</span>
                    ) : miEntrega?.estado === "FUERA_DE_PLAZO" ? (
                      <span className="badge" style={{ background: "var(--danger)22", color: "var(--danger)" }}>Entregada fuera de plazo</span>
                    ) : miEntrega?.estado === "ENTREGADA" ? (
                      <span className="badge" style={{ background: "var(--green)22", color: "var(--green)" }}><IconCheck size={12} /> Entregada</span>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => abrirEntrega(t)}>Entregar tarea</button>
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
            <h2><IconTask size={20} /> {modal === "new" ? "Nueva tarea" : "Editar tarea"}</h2>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-group"><label>Título</label>
              <input value={form.titulo || ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Ejercicios de álgebra" /></div>
            <div className="form-group"><label>Descripción / instrucciones (texto)</label>
              <textarea rows={3} value={form.descripcion || ""} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Instrucciones para la tarea…" /></div>
            <FileUpload
              label="Archivo de la tarea (PDF)"
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
            <div className="form-group"><label>Estado</label>
              <select value={form.estado || "BORRADOR"} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                <option value="BORRADOR">Borrador</option>
                <option value="PUBLICADA">Publicada</option>
                <option value="CERRADA">Cerrada</option>
              </select></div>
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
            <h2><IconTask size={20} /> Entregar: {entregaModal.titulo}</h2>
            <FileUpload
              label="Tu respuesta (PDF o imagen)"
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
            <h2><IconCheck size={20} /> Calificar a {calificarModal.entrega.alumno.usuario.nombre}</h2>
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
