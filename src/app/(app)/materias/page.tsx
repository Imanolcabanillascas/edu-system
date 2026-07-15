"use client";
import { useEffect, useState } from "react";
import { IconBook, IconPlus, IconEdit, IconTrash, IconLoader, IconSearch } from "@/components/icons";

export default function MateriasPage() {
  const [materias, setMaterias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "new" | any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/materias");
    setMaterias(await res.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = materias.filter((m) =>
    m.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (m.area || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.codigo || "").toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setForm({ nombre: "", area: "", codigo: "" }); setError(""); setModal("new"); };
  const openEdit = (m: any) => { setForm({ id: m.id, nombre: m.nombre, area: m.area || "", codigo: m.codigo || "" }); setError(""); setModal(m); };
  const close = () => setModal(null);

  const save = async () => {
    if (!form.nombre?.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true); setError("");
    const method = modal === "new" ? "POST" : "PUT";
    const res = await fetch("/api/materias", { method, body: JSON.stringify(form) });
    if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    setSaving(false); close(); load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta materia? Debe no tener planes de estudio asociados.")) return;
    const res = await fetch("/api/materias", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1><IconBook size={24} /> Materias</h1>
        <p>Catálogo global de materias. La asignación a cada Grado se hace en "Plan de Estudios"</p>
      </div>
      <div className="toolbar">
        <div className="search-wrap">
          <IconSearch size={16} className="search-icon" />
          <input className="search-input" placeholder="Buscar por nombre, área o código…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={openNew}><IconPlus size={16} /> Nueva materia</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Materia</th><th>Área</th><th>Código</th><th>En grados</th><th>Acciones</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5}><div className="empty"><IconLoader size={24} /></div></td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5}><div className="empty"><IconBook size={32} style={{ color: "var(--muted)" }} /><p>No se encontraron materias</p></div></td></tr>
            )}
            {filtered.map((m) => (
              <tr key={m.id}>
                <td style={{ fontWeight: 500 }}>{m.nombre}</td>
                <td style={{ color: "var(--muted)" }}>{m.area || "—"}</td>
                <td><code style={{ fontSize: ".8rem" }}>{m.codigo || "—"}</code></td>
                <td style={{ color: "var(--muted)" }}>
                  {m.planEstudios.length === 0 ? "Sin asignar" : m.planEstudios.map((p: any) => p.grado.nombre).join(", ")}
                </td>
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
            <div className="form-group"><label>Nombre</label>
              <input value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Matemáticas" /></div>
            <div className="form-row">
              <div className="form-group"><label>Área (opcional)</label>
                <input value={form.area || ""} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Ej: Ciencias" /></div>
              <div className="form-group"><label>Código (opcional)</label>
                <input value={form.codigo || ""} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} placeholder="Ej: MAT" maxLength={10} /></div>
            </div>
            <div className="form-hint">Para asignar esta materia a un Grado, ve a "Plan de Estudios".</div>
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
