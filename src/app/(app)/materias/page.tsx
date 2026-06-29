"use client";
import { useEffect, useState } from "react";
import { nombreGrado, NIVEL_LABEL } from "@/lib/utils";
import { IconBook, IconPlus, IconEdit, IconTrash, IconLoader } from "@/components/icons";

export default function MateriasPage() {
  const [materias, setMaterias] = useState<any[]>([]);
  const [grados, setGrados] = useState<any[]>([]);
  const [profesores, setProfesores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "new" | any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const [resM, resG, resP] = await Promise.all([fetch("/api/materias"), fetch("/api/grados"), fetch("/api/profesores")]);
    setMaterias(await resM.json());
    setGrados(await resG.json());
    setProfesores(await resP.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = materias.filter((m) =>
    m.nombre.toLowerCase().includes(search.toLowerCase()) ||
    nombreGrado(m.grado).toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setForm({ nombre: "", gradoId: "", profesorIds: [] }); setError(""); setModal("new"); };
  const openEdit = (m: any) => {
    setForm({ id: m.id, nombre: m.nombre, gradoId: m.gradoId, profesorIds: m.profesores.map((p: any) => p.profesor.id) });
    setError(""); setModal(m);
  };
  const close = () => setModal(null);

  const toggleProfesor = (id: string) => {
    const ids = form.profesorIds || [];
    setForm({ ...form, profesorIds: ids.includes(id) ? ids.filter((x: string) => x !== id) : [...ids, id] });
  };

  const save = async () => {
    if (!form.nombre?.trim() || !form.gradoId) { setError("Completa nombre y grado"); return; }
    setSaving(true); setError("");
    const method = modal === "new" ? "POST" : "PUT";
    const res = await fetch("/api/materias", { method, body: JSON.stringify(form) });
    if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    setSaving(false);
    close();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta materia? Debe no tener clases asociadas.")) return;
    const res = await fetch("/api/materias", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1><IconBook size={24} /> Materias</h1>
        <p>Crea materias por grado y asigna uno o varios profesores</p>
      </div>
      <div className="toolbar">
        <div className="search-wrap">
          <input className="search-input" placeholder="Buscar por nombre o grado…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={openNew}><IconPlus size={16} /> Nueva materia</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Materia</th><th>Grado / Nivel</th><th>Profesores</th><th>Clases</th><th>Acciones</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5}><div className="empty"><IconLoader size={24} /></div></td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5}><div className="empty"><IconBook size={32} style={{ color: "var(--muted)" }} /><p>No se encontraron materias</p></div></td></tr>
            )}
            {filtered.map((m) => (
              <tr key={m.id}>
                <td style={{ fontWeight: 500 }}>{m.nombre}</td>
                <td style={{ color: "var(--muted)" }}>
                  {nombreGrado(m.grado)} <span className="muted-label" style={{ marginLeft: 6 }}>{NIVEL_LABEL[m.grado.nivel.tipo]}</span>
                </td>
                <td>
                  <div className="chips">
                    {m.profesores.length === 0 && <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>Sin asignar</span>}
                    {m.profesores.map((p: any) => (
                      <span key={p.profesor.id} className="chip">{p.profesor.usuario.nombre}</span>
                    ))}
                  </div>
                </td>
                <td style={{ color: "var(--muted)" }}>{m.clases.length}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(m)}><IconEdit size={15} /></button>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => remove(m.id)}><IconTrash size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal">
            <h2><IconBook size={20} /> {modal === "new" ? "Nueva materia" : "Editar materia"}</h2>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-group"><label>Nombre de la materia</label>
              <input value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Matemáticas" /></div>
            <div className="form-group"><label>Grado</label>
              <select value={form.gradoId || ""} disabled={modal !== "new"} onChange={(e) => setForm({ ...form, gradoId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {grados.map((g: any) => (
                  <option key={g.id} value={g.id}>{nombreGrado(g)} — {NIVEL_LABEL[g.nivel.tipo]}</option>
                ))}
              </select>
              {modal !== "new" && <div className="form-hint">El grado no se puede cambiar después de crear la materia</div>}
            </div>
            <div className="form-group"><label>Profesores que dictan esta materia</label>
              <div className="chip-selector">
                {profesores.map((p: any) => {
                  const sel = (form.profesorIds || []).includes(p.id);
                  return (
                    <button key={p.id} type="button" className={`chip-btn ${sel ? "chip-btn-active" : ""}`} onClick={() => toggleProfesor(p.id)}>
                      {p.usuario.nombre}
                    </button>
                  );
                })}
                {profesores.length === 0 && <span className="muted-label">No hay profesores registrados todavía</span>}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}