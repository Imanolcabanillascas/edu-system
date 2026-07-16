"use client";
import { useEffect, useState } from "react";
import { initials, avatarColor } from "@/lib/utils";
import { IconTeacher, IconSearch, IconPlus, IconEdit, IconTrash, IconLoader } from "@/components/icons";

interface Profesor {
  id: string;
  dni: string;
  telefono: string | null;
  usuario: { id: string; nombre: string; email: string };
  clases: { id: string; planEstudio: { materia: { nombre: string } }; seccion: { nombre: string; grado: { nombre: string } } }[];
}

export default function ProfesoresPage() {
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "new" | Profesor>(null);
  const [form, setForm] = useState<any>({});
  const [cambiarPassword, setCambiarPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/profesores");
    setProfesores(await res.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = profesores.filter((p) =>
    p.usuario.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.dni.includes(search) ||
    p.clases.some((c) => c.planEstudio.materia.nombre.toLowerCase().includes(search.toLowerCase()))
  );

  const openNew = () => {
    setForm({ nombre: "", email: "", dni: "", telefono: "", password: "" });
    setCambiarPassword(true); setError(""); setModal("new");
  };
  const openEdit = (p: Profesor) => {
    setForm({ id: p.id, nombre: p.usuario.nombre, email: p.usuario.email, dni: p.dni, telefono: p.telefono ?? "", password: "" });
    setCambiarPassword(false); setError(""); setModal(p);
  };
  const close = () => setModal(null);

  const save = async () => {
    if (!form.nombre || !form.email || !form.dni) return;
    if (form.dni.length !== 8) { setError("El DNI debe tener 8 dígitos"); return; }
    if (cambiarPassword && (!form.password || form.password.length < 6)) {
      setError("La contraseña debe tener al menos 6 caracteres"); return;
    }
    setSaving(true); setError("");
    const method = modal === "new" ? "POST" : "PUT";
    const payload = { ...form, password: cambiarPassword ? form.password : undefined };
    const res = await fetch("/api/profesores", { method, body: JSON.stringify(payload) });
    if (!res.ok) { setError((await res.json()).error ?? "Ocurrió un error"); setSaving(false); return; }
    setSaving(false); close(); load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este profesor? Se eliminarán sus clases, tareas y exámenes.")) return;
    const res = await fetch("/api/profesores", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    load();
  };

  const materiasUnicas = (p: Profesor) => {
    const nombres = new Set(p.clases.map((c) => c.planEstudio.materia.nombre));
    return [...nombres];
  };

  return (
    <div>
      <div className="page-header">
        <h1>Profesores</h1>
        <p>Gestiona el cuerpo docente. Las materias se asignan desde "Clases"</p>
      </div>
      <div className="toolbar">
        <div className="search-wrap">
          <IconSearch size={16} className="search-icon" />
          <input className="search-input" placeholder="Buscar por nombre, DNI o materia…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={openNew}><IconPlus size={16} /> Nuevo profesor</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Nombre</th><th>DNI</th><th>Materias que dicta</th><th>Email</th><th>Teléfono</th><th>Clases</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7}><div className="empty"><IconLoader size={24} /></div></td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7}><div className="empty"><IconTeacher size={32} style={{ color: "var(--muted)" }} /><p>No se encontraron profesores</p></div></td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id}>
                <td style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="avatar" style={{ background: avatarColor(p.usuario.nombre) + "33", color: avatarColor(p.usuario.nombre) }}>
                    {initials(p.usuario.nombre)}
                  </div>
                  {p.usuario.nombre}
                </td>
                <td style={{ color: "var(--muted)", fontFamily: "monospace" }}>{p.dni}</td>
                <td>
                  <div className="chips">
                    {p.clases.length === 0
                      ? <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>Sin clases asignadas</span>
                      : materiasUnicas(p).map((nombre) => (
                          <span key={nombre} className="badge" style={{ background: "var(--accent)22", color: "var(--accent)" }}>{nombre}</span>
                        ))
                    }
                  </div>
                </td>
                <td style={{ color: "var(--muted)" }}>{p.usuario.email}</td>
                <td style={{ color: "var(--muted)" }}>{p.telefono || "—"}</td>
                <td style={{ color: "var(--muted)" }}>{p.clases.length}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEdit(p)}><IconEdit size={15} /></button>
                  <button className="btn btn-danger btn-icon btn-sm" title="Eliminar" onClick={() => remove(p.id)}><IconTrash size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal">
            <h2><IconTeacher size={20} /> {modal === "new" ? "Nuevo profesor" : "Editar profesor"}</h2>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-group"><label>Nombre completo</label>
              <input value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Ana Martínez" /></div>
            <div className="form-row">
              <div className="form-group"><label>DNI</label>
                <input value={form.dni || ""} maxLength={8} onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, "") })} placeholder="8 dígitos" /></div>
              <div className="form-group"><label>Teléfono</label>
                <input value={form.telefono || ""} maxLength={9} onChange={(e) => setForm({ ...form, telefono: e.target.value.replace(/\D/g, "") })} placeholder="9 dígitos" /></div>
            </div>
            <div className="form-group"><label>Email (usuario de acceso)</label>
              <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="profesor@colegio.edu" /></div>
            <div className="form-hint" style={{ marginBottom: 16 }}>
              Las materias se asignan desde "Clases" usando "Asignar materias" o "Asignar profesor tutor".
            </div>
            <div className="form-divider">Acceso al sistema</div>
            {modal !== "new" && !cambiarPassword && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCambiarPassword(true)}>Cambiar contraseña</button>
            )}
            {(modal === "new" || cambiarPassword) && (
              <div className="form-group">
                <label>{modal === "new" ? "Contraseña" : "Nueva contraseña"}</label>
                <input type="text" value={form.password || ""} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
                <div className="form-hint">El profesor usará el email y esta contraseña para iniciar sesión.</div>
              </div>
            )}
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