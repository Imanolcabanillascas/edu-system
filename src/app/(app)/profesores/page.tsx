"use client";
import { useEffect, useState } from "react";
import { initials, avatarColor, nombreGrado } from "@/lib/utils";
import {
  IconTeacher, IconSearch, IconPlus, IconEdit, IconTrash, IconDownload, IconLoader,
} from "@/components/icons";

interface Profesor {
  id: string;
  dni: string;
  telefono: string | null;
  usuario: { id: string; nombre: string; email: string };
  clases: any[];
  materias: { materia: { id: string; nombre: string; grado: any } }[];
}

export default function ProfesoresPage() {
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [materiasAll, setMateriasAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "new" | Profesor>(null);
  const [form, setForm] = useState<any>({});
  const [cambiarPassword, setCambiarPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [generandoPdf, setGenerandoPdf] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [resP, resM] = await Promise.all([fetch("/api/profesores"), fetch("/api/materias")]);
    setProfesores(await resP.json());
    setMateriasAll(await resM.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = profesores.filter(
    (p) =>
      p.usuario.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.dni.includes(search) ||
      p.materias.some((m) => m.materia.nombre.toLowerCase().includes(search.toLowerCase()))
  );

  const openNew = () => {
    setForm({ nombre: "", email: "", dni: "", telefono: "", password: "", materiaIds: [] });
    setCambiarPassword(true);
    setError(""); setModal("new");
  };
  const openEdit = (p: Profesor) => {
    setForm({
      id: p.id, nombre: p.usuario.nombre, email: p.usuario.email, dni: p.dni, telefono: p.telefono ?? "",
      password: "", materiaIds: p.materias.map((m) => m.materia.id),
    });
    setCambiarPassword(false);
    setError(""); setModal(p);
  };
  const close = () => setModal(null);

  const toggleMateria = (id: string) => {
    const ids = form.materiaIds || [];
    setForm({ ...form, materiaIds: ids.includes(id) ? ids.filter((x: string) => x !== id) : [...ids, id] });
  };

  const save = async () => {
    if (!form.nombre || !form.email || !form.dni) return;
    if (form.dni.length !== 8) { setError("El DNI debe tener 8 dígitos"); return; }
    if (cambiarPassword && (!form.password || form.password.length < 6)) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setSaving(true); setError("");
    const method = modal === "new" ? "POST" : "PUT";
    const payload = { ...form, password: cambiarPassword ? form.password : undefined };
    const res = await fetch("/api/profesores", { method, body: JSON.stringify(payload) });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Ocurrió un error");
      setSaving(false);
      return;
    }
    setSaving(false);
    close();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este profesor?")) return;
    await fetch("/api/profesores", { method: "DELETE", body: JSON.stringify({ id }) });
    load();
  };

  const generarPdf = async (id: string, nombre: string) => {
    setGenerandoPdf(id);
    try {
      const res = await fetch(`/api/profesores/${id}/pdf`);
      if (!res.ok) throw new Error("No se pudo generar el PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `horario_${nombre.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Ocurrió un error al generar el PDF");
    } finally {
      setGenerandoPdf(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Profesores</h1>
        <p>Gestiona el cuerpo docente del colegio</p>
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
            <tr><th>Nombre</th><th>DNI</th><th>Materias</th><th>Email</th><th>Teléfono</th><th>Clases</th><th>Acciones</th></tr>
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
                    {p.materias.length === 0 && <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>Sin materias</span>}
                    {p.materias.map((m) => (
                      <span key={m.materia.id} className="badge" style={{ background: "var(--accent)22", color: "var(--accent)" }}>
                        {m.materia.nombre} · {nombreGrado(m.materia.grado)}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ color: "var(--muted)" }}>{p.usuario.email}</td>
                <td style={{ color: "var(--muted)" }}>{p.telefono || "—"}</td>
                <td style={{ color: "var(--muted)" }}>{p.clases.length}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-icon btn-sm" title="Generar PDF de horario" onClick={() => generarPdf(p.id, p.usuario.nombre)} disabled={generandoPdf === p.id}>
                    {generandoPdf === p.id ? <IconLoader size={15} /> : <IconDownload size={15} />}
                  </button>
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

            <div className="form-group"><label>Materias que dicta</label>
              <div className="chip-selector">
                {materiasAll.map((m: any) => {
                  const sel = (form.materiaIds || []).includes(m.id);
                  return (
                    <button key={m.id} type="button" className={`chip-btn ${sel ? "chip-btn-active" : ""}`} onClick={() => toggleMateria(m.id)}>
                      {m.nombre} · {nombreGrado(m.grado)}
                    </button>
                  );
                })}
                {materiasAll.length === 0 && <span className="muted-label">Crea materias primero en el apartado "Materias"</span>}
              </div>
            </div>

            <div className="form-divider">Acceso al sistema</div>
            {modal !== "new" && !cambiarPassword && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCambiarPassword(true)}>
                Cambiar contraseña
              </button>
            )}
            {(modal === "new" || cambiarPassword) && (
              <div className="form-group">
                <label>{modal === "new" ? "Contraseña" : "Nueva contraseña"}</label>
                <input
                  type="text"
                  value={form.password || ""}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
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
