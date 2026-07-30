"use client";
import { useEffect, useState, useCallback } from "react";
import { initials, avatarColor, NIVEL_LABEL, estadoColor, formatDate } from "@/lib/utils";
import {
  IconStudent, IconSearch, IconPlus, IconEdit, IconTrash, IconLoader,
  IconPhone, IconIdCard, IconLogout, IconCheck, IconAlert,
} from "@/components/icons";
import ImageUpload from "@/components/ImageUpload";

const ANO_ACTUAL = new Date().getFullYear();

interface AlumnoRow {
  id: string; dni: string; foto: string | null;
  fechaNac: string | null; anoIngreso: number;
  estado: "ACTIVO" | "EGRESADO" | "RETIRADO";
  tutorDni: string | null; tutorNombre: string | null; tutorTelefono: string | null;
  usuario: { id: string; nombre: string; email: string };
  matricula: { estado: string } | null;
  seccion: { id: string; nombre: string; gradoId: string; grado: { nombre: string; nivel: any } } | null;
}

const ESTADOS = ["ACTIVO", "EGRESADO", "RETIRADO"] as const;

export default function AlumnosPage() {
  const [alumnos, setAlumnos] = useState<AlumnoRow[]>([]);
  const [niveles, setNiveles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("ACTIVO");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [modal, setModal] = useState<null | "new" | AlumnoRow>(null);
  const [form, setForm] = useState<any>({});
  const [nivelSel, setNivelSel] = useState("");
  const [gradoSel, setGradoSel] = useState("");
  const [cambiarPassword, setCambiarPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadAlumnos = useCallback(async (p = 1) => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(p), estado: filtroEstado });
    if (search.trim()) qs.set("search", search.trim());
    const res = await fetch(`/api/alumnos?${qs}`);
    const data = await res.json();
    setAlumnos(data.alumnos ?? []);
    setTotalPages(data.totalPages ?? 1);
    setTotal(data.total ?? 0);
    setPage(data.page ?? 1);
    setLoading(false);
  }, [filtroEstado, search]);

  const loadNiveles = async () => {
    const res = await fetch("/api/niveles");
    setNiveles(await res.json());
  };

  useEffect(() => { loadAlumnos(1); loadNiveles(); }, [filtroEstado]);

  // Cascada nivel → grado → secciones
  const nivelObj = niveles.find((n: any) => n.tipo === nivelSel);
  const gradosDisponibles = nivelObj?.grados ?? [];
  const gradoObj = gradosDisponibles.find((g: any) => g.id === gradoSel);
  const seccionesDisponibles = gradoObj?.secciones ?? [];

  const openNew = () => {
    setForm({ nombre: "", email: "", dni: "", fechaNac: "", anoIngreso: ANO_ACTUAL, estado: "ACTIVO",
      tutorNombre: "", tutorDni: "", tutorTelefono: "", password: "", seccionId: "", foto: null });
    setNivelSel(""); setGradoSel(""); setCambiarPassword(true); setError(""); setModal("new");
  };

  const openEdit = (a: AlumnoRow) => {
    setForm({
      id: a.id, nombre: a.usuario.nombre, email: a.usuario.email, dni: a.dni,
      fechaNac: a.fechaNac ? a.fechaNac.slice(0, 10) : "",
      anoIngreso: a.anoIngreso, estado: a.estado,
      tutorNombre: a.tutorNombre ?? "", tutorDni: a.tutorDni ?? "",
      tutorTelefono: a.tutorTelefono ?? "",
      seccionId: a.seccion?.id ?? "", password: "", foto: a.foto ?? null,
    });
    if (a.seccion) {
      setNivelSel(a.seccion.grado.nivel.tipo);
      setGradoSel(a.seccion.gradoId ?? "");
    } else {
      setNivelSel(""); setGradoSel("");
    }
    setCambiarPassword(false); setError(""); setModal(a);
  };

  const close = () => setModal(null);

  const save = async () => {
    if (!form.nombre?.trim() || !form.dni || !form.email) { setError("Nombre, DNI y email son obligatorios"); return; }
    if (form.dni.length !== 8) { setError("El DNI debe tener 8 dígitos"); return; }
    if (cambiarPassword && modal === "new" && (!form.password || form.password.length < 6)) {
      setError("La contraseña debe tener al menos 6 caracteres"); return;
    }
    setSaving(true); setError("");
    const method = modal === "new" ? "POST" : "PUT";
    const payload = { ...form, password: cambiarPassword ? form.password : undefined };
    const res = await fetch("/api/alumnos", { method, body: JSON.stringify(payload) });
    if (!res.ok) { setError((await res.json()).error ?? "Error al guardar"); setSaving(false); return; }
    setSaving(false); close(); loadAlumnos(page);
  };

  const retirar = async (id: string) => {
    if (!confirm("¿Marcar este alumno como Retirado?")) return;
    await fetch("/api/alumnos", { method: "PUT", body: JSON.stringify({ id, estado: "RETIRADO" }) });
    loadAlumnos(page);
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este alumno permanentemente? Esta acción no se puede deshacer.")) return;
    await fetch("/api/alumnos", { method: "DELETE", body: JSON.stringify({ id }) });
    loadAlumnos(page);
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); loadAlumnos(1); };

  return (
    <div>
      <div className="page-header">
        <h1><IconStudent size={26} /> Alumnos</h1>
        <p>Gestiona el padrón de alumnos del colegio</p>
      </div>

      {/* Toolbar */}
      <form className="toolbar" onSubmit={handleSearch}>
        <div className="search-wrap">
          <IconSearch size={16} className="search-icon" />
          <input className="search-input" placeholder="Buscar por nombre, DNI o sección…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ minWidth: 130 }}>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <button type="submit" className="btn btn-ghost btn-sm">Buscar</button>
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <IconPlus size={16} /> Nuevo alumno
        </button>
      </form>

      <div className="muted-label" style={{ marginBottom: 12 }}>
        {total} alumno(s) encontrado(s)
      </div>

      {/* Tabla */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Alumno</th><th>DNI</th><th>Sección</th>
              <th>Matrícula</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6}><div className="empty"><IconLoader size={24} /></div></td></tr>}
            {!loading && alumnos.length === 0 && (
              <tr><td colSpan={6}><div className="empty"><IconStudent size={32} style={{ color: "var(--muted)" }} />
                <p>No se encontraron alumnos</p></div></td></tr>
            )}
            {alumnos.map((a) => (
              <tr key={a.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {a.foto ? (
                      <img src={a.foto} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div className="avatar" style={{ width: 36, height: 36, fontSize: ".75rem", background: avatarColor(a.usuario.nombre) + "33", color: avatarColor(a.usuario.nombre) }}>
                        {initials(a.usuario.nombre)}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 500 }}>{a.usuario.nombre}</div>
                      <div style={{ fontSize: ".75rem", color: "var(--muted)" }}>{a.usuario.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontFamily: "monospace", color: "var(--muted)" }}>{a.dni}</td>
                <td style={{ color: "var(--muted)" }}>
                  {a.seccion ? `${a.seccion.grado.nombre} "${a.seccion.nombre}"` : "—"}
                </td>
                <td>
                  {a.matricula ? (
                    <span className="badge" style={{ background: estadoColor(a.matricula.estado) + "22", color: estadoColor(a.matricula.estado) }}>
                      {a.matricula.estado}
                    </span>
                  ) : <span style={{ color: "var(--muted)" }}>—</span>}
                </td>
                <td>
                  <span className="badge" style={{ background: estadoColor(a.estado) + "22", color: estadoColor(a.estado) }}>
                    {a.estado}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEdit(a)}><IconEdit size={15} /></button>
                    {a.estado === "ACTIVO" && (
                      <button className="btn btn-ghost btn-icon btn-sm" title="Retirar" onClick={() => retirar(a.id)}><IconLogout size={15} /></button>
                    )}
                    <button className="btn btn-danger btn-icon btn-sm" title="Eliminar" onClick={() => remove(a.id)}><IconTrash size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => loadAlumnos(page - 1)}>Anterior</button>
          <span style={{ padding: "6px 12px", color: "var(--muted)", fontSize: ".85rem" }}>Pág. {page} de {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => loadAlumnos(page + 1)}>Siguiente</button>
        </div>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal" style={{ maxWidth: 600, maxHeight: "92vh", overflowY: "auto" }}>
            <h2><IconStudent size={20} /> {modal === "new" ? "Nuevo alumno" : "Editar alumno"}</h2>
            {error && <div className="alert-error">{error}</div>}

            {/* Foto */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <ImageUpload fotoUrl={form.foto} nombre={form.nombre}
                onChange={(url) => setForm({ ...form, foto: url })} size={100} />
            </div>

            {/* Sección: Datos personales */}
            <div className="form-section-title">Datos personales</div>
            <div className="form-group"><label>Nombre completo <span style={{ color: "var(--danger)" }}>*</span></label>
              <input value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Juan Pérez López" /></div>
            <div className="form-row">
              <div className="form-group"><label>DNI <span style={{ color: "var(--danger)" }}>*</span></label>
                <input value={form.dni || ""} maxLength={8}
                  onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, "") })} placeholder="8 dígitos" /></div>
              <div className="form-group"><label>Fecha de nacimiento</label>
                <input type="date" value={form.fechaNac || ""} onChange={(e) => setForm({ ...form, fechaNac: e.target.value })} /></div>
            </div>
            <div className="form-group"><label>Email (acceso al sistema) <span style={{ color: "var(--danger)" }}>*</span></label>
              <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="alumno@colegio.edu" /></div>

            {/* Sección: Información académica */}
            <div className="form-section-title" style={{ marginTop: 20 }}>Información académica</div>
            <div className="form-row">
              <div className="form-group"><label>Año de ingreso</label>
                <input type="number" min={2000} max={ANO_ACTUAL + 1} value={form.anoIngreso || ANO_ACTUAL}
                  onChange={(e) => setForm({ ...form, anoIngreso: Number(e.target.value) })} /></div>
              <div className="form-group"><label>Estado</label>
                <select value={form.estado || "ACTIVO"} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                  {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Nivel</label>
                <select value={nivelSel} onChange={(e) => { setNivelSel(e.target.value); setGradoSel(""); setForm({ ...form, seccionId: "" }); }}>
                  <option value="">Seleccionar…</option>
                  {niveles.map((n: any) => <option key={n.id} value={n.tipo}>{NIVEL_LABEL[n.tipo]}</option>)}
                </select></div>
              <div className="form-group"><label>Grado</label>
                <select value={gradoSel} disabled={!nivelSel}
                  onChange={(e) => { setGradoSel(e.target.value); setForm({ ...form, seccionId: "" }); }}>
                  <option value="">Seleccionar…</option>
                  {gradosDisponibles.map((g: any) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select></div>
            </div>
            <div className="form-group"><label>Sección</label>
              <select value={form.seccionId || ""} disabled={!gradoSel}
                onChange={(e) => setForm({ ...form, seccionId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {seccionesDisponibles.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              {gradoSel && seccionesDisponibles.length === 0 && (
                <div className="form-hint">No hay secciones en el año activo — créalas en "Estructura Académica"</div>
              )}</div>

            {/* Sección: Apoderado */}
            <div className="form-section-title" style={{ marginTop: 20 }}>Información del apoderado</div>
            <div className="form-group"><label>Nombre del apoderado</label>
              <input value={form.tutorNombre || ""} onChange={(e) => setForm({ ...form, tutorNombre: e.target.value })} placeholder="Ej: María López" /></div>
            <div className="form-row">
              <div className="form-group"><label>DNI del apoderado</label>
                <input value={form.tutorDni || ""} maxLength={8}
                  onChange={(e) => setForm({ ...form, tutorDni: e.target.value.replace(/\D/g, "") })} placeholder="8 dígitos" /></div>
              <div className="form-group"><label>Teléfono</label>
                <input value={form.tutorTelefono || ""} maxLength={9}
                  onChange={(e) => setForm({ ...form, tutorTelefono: e.target.value.replace(/\D/g, "") })} placeholder="9 dígitos" /></div>
            </div>

            {/* Sección: Acceso */}
            <div className="form-section-title" style={{ marginTop: 20 }}>Acceso al sistema</div>
            {modal !== "new" && !cambiarPassword && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCambiarPassword(true)}>
                Cambiar contraseña
              </button>
            )}
            {(modal === "new" || cambiarPassword) && (
              <div className="form-group">
                <label>{modal === "new" ? "Contraseña" : "Nueva contraseña"} <span style={{ color: "var(--danger)" }}>*</span></label>
                <input type="text" value={form.password || ""} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
                <div className="form-hint">El alumno usará el email y esta contraseña para iniciar sesión.</div>
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
