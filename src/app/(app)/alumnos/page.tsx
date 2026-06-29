"use client";
import { useEffect, useState, useCallback } from "react";
import { initials, avatarColor, NIVEL_LABEL } from "@/lib/utils";
import {
  IconStudent, IconSearch, IconPlus, IconEdit, IconTrash, IconLoader, IconPhone, IconIdCard, IconLogout,
} from "@/components/icons";

const ANO_ACTUAL = new Date().getFullYear();

interface AlumnoRow {
  id: string;
  dni: string;
  fechaNac: string | null;
  anoIngreso: number;
  estado: "ACTIVO" | "EGRESADO" | "RETIRADO";
  tutorDni: string | null;
  tutorNombre: string | null;
  tutorTelefono: string | null;
  usuario: { id: string; nombre: string; email: string };
  matricula: { estado: string } | null;
  clases: any[];
  seccion: { id: string; nombre: string; gradoId: string; grado: { nombre: string; nivel: any } } | null;
}

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
  const [verTutor, setVerTutor] = useState<AlumnoRow | null>(null);

  const loadAlumnos = useCallback(async (p = page) => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(p), estado: filtroEstado });
    if (search.trim()) qs.set("search", search.trim());
    const res = await fetch(`/api/alumnos?${qs}`);
    const data = await res.json();
    setAlumnos(data.alumnos);
    setTotalPages(data.totalPages);
    setTotal(data.total);
    setPage(data.page);
    setLoading(false);
  }, [page, filtroEstado, search]);

  const loadNiveles = async () => {
    const resN = await fetch("/api/niveles");
    setNiveles(await resN.json());
  };

  useEffect(() => { loadNiveles(); }, []);
  // Búsqueda y cambio de filtro reinician a la página 1; se debounce levemente la búsqueda
  useEffect(() => {
    const t = setTimeout(() => loadAlumnos(1), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, filtroEstado]);

  const cambiarPagina = (p: number) => { if (p >= 1 && p <= totalPages) loadAlumnos(p); };

  const resetCascada = () => { setNivelSel(""); setGradoSel(""); };

  const openNew = () => {
    setForm({ nombre: "", email: "", dni: "", seccionId: "", fechaNac: "", anoIngreso: ANO_ACTUAL, tutorDni: "", tutorNombre: "", tutorTelefono: "", password: "" });
    resetCascada();
    setCambiarPassword(true);
    setError(""); setModal("new");
  };
  const openEdit = (a: AlumnoRow) => {
    setForm({
      id: a.id, nombre: a.usuario.nombre, email: a.usuario.email, dni: a.dni, seccionId: a.seccion?.id ?? "",
      fechaNac: a.fechaNac?.slice(0, 10) ?? "", anoIngreso: a.anoIngreso, estado: a.estado,
      tutorDni: a.tutorDni ?? "", tutorNombre: a.tutorNombre ?? "", tutorTelefono: a.tutorTelefono ?? "",
      password: "",
    });
    if (a.seccion) {
      setNivelSel(a.seccion.grado.nivel.tipo);
      setGradoSel(a.seccion.gradoId ?? "");
    } else {
      resetCascada();
    }
    setCambiarPassword(false);
    setError(""); setModal(a);
  };
  const close = () => setModal(null);

  const nivelObj = niveles.find((n: any) => n.tipo === nivelSel);
  const gradosDisponibles = nivelObj?.grados ?? [];
  const gradoObj = gradosDisponibles.find((g: any) => g.id === gradoSel);
  // Las secciones que llegan en `niveles` ya están filtradas al año lectivo activo
  // (lo hace /api/niveles por defecto), así que aquí solo tomamos las del grado elegido.
  const seccionesDisponibles = gradoObj?.secciones ?? [];

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
    const res = await fetch("/api/alumnos", { method, body: JSON.stringify(payload) });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Ocurrió un error");
      setSaving(false);
      return;
    }
    setSaving(false);
    close();
    loadAlumnos();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este alumno? Esta acción borra permanentemente su cuenta y datos.")) return;
    await fetch("/api/alumnos", { method: "DELETE", body: JSON.stringify({ id }) });
    loadAlumnos();
  };

  const retirar = async (a: AlumnoRow) => {
    if (!confirm(`¿Marcar a ${a.usuario.nombre} como retirado? Sus datos se conservan, pero dejará de aparecer en los listados activos.`)) return;
    await fetch("/api/alumnos", {
      method: "PUT",
      body: JSON.stringify({
        id: a.id, nombre: a.usuario.nombre, email: a.usuario.email, dni: a.dni,
        seccionId: a.seccion?.id ?? "", fechaNac: a.fechaNac?.slice(0, 10) ?? "",
        anoIngreso: a.anoIngreso, tutorDni: a.tutorDni, tutorNombre: a.tutorNombre, tutorTelefono: a.tutorTelefono,
        estado: "RETIRADO",
      }),
    });
    loadAlumnos();
  };

  const estadoBadge = (estado?: string) => {
    if (!estado) return <span className="badge" style={{ background: "var(--surface2)", color: "var(--muted)" }}>Sin matrícula</span>;
    const colors: any = { PAGADO: "var(--green)", PENDIENTE: "var(--accent)", VENCIDO: "var(--danger)" };
    return <span className="badge" style={{ background: colors[estado] + "22", color: colors[estado] }}>{estado}</span>;
  };

  const estadoAlumnoBadge = (estado: string) => {
    const colors: any = { ACTIVO: "var(--green)", EGRESADO: "var(--accent2)", RETIRADO: "var(--muted)" };
    return <span className="badge" style={{ background: colors[estado] + "22", color: colors[estado] }}>{estado}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <h1>Alumnos</h1>
        <p>Gestiona la matrícula estudiantil{total > 0 ? ` · ${total} en total` : ""}</p>
      </div>
      <div className="toolbar">
        <div className="search-wrap">
          <IconSearch size={16} className="search-icon" />
          <input className="search-input" placeholder="Buscar por nombre o DNI…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="year-filter" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="ACTIVO">Activos</option>
          <option value="EGRESADO">Egresados</option>
          <option value="RETIRADO">Retirados</option>
          <option value="">Todos los estados</option>
        </select>
        <button className="btn btn-primary" onClick={openNew}><IconPlus size={16} /> Nuevo alumno</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>DNI</th><th>Grado / Sección</th><th>Estado</th><th>Tutor</th><th>Matrícula</th><th>Acciones</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7}><div className="empty"><IconLoader size={24} /></div></td></tr>}
            {!loading && alumnos.length === 0 && (
              <tr><td colSpan={7}><div className="empty"><IconStudent size={32} style={{ color: "var(--muted)" }} /><p>No se encontraron alumnos</p></div></td></tr>
            )}
            {alumnos.map((a) => (
              <tr key={a.id}>
                <td style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="avatar" style={{ background: avatarColor(a.usuario.nombre) + "33", color: avatarColor(a.usuario.nombre) }}>
                    {initials(a.usuario.nombre)}
                  </div>
                  {a.usuario.nombre}
                </td>
                <td style={{ color: "var(--muted)", fontFamily: "monospace" }}>{a.dni}</td>
                <td>
                  {a.seccion ? (
                    <span className="badge" style={{ background: "var(--accent2)22", color: "var(--accent2)" }}>
                      {a.seccion.grado.nombre} "{a.seccion.nombre}"
                    </span>
                  ) : <span style={{ color: "var(--muted)" }}>Sin asignar</span>}
                </td>
                <td>{estadoAlumnoBadge(a.estado)}</td>
                <td>
                  {a.tutorNombre ? (
                    <button className="btn-link" onClick={() => setVerTutor(a)}>{a.tutorNombre.split(" ")[0]}</button>
                  ) : <span style={{ color: "var(--muted)" }}>—</span>}
                </td>
                <td>{estadoBadge(a.matricula?.estado)}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEdit(a)}><IconEdit size={15} /></button>
                  {a.estado === "ACTIVO" && (
                    <button className="btn btn-ghost btn-icon btn-sm" title="Marcar como retirado" onClick={() => retirar(a)}><IconLogout size={15} /></button>
                  )}
                  <button className="btn btn-danger btn-icon btn-sm" title="Eliminar" onClick={() => remove(a.id)}><IconTrash size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-ghost btn-sm" onClick={() => cambiarPagina(page - 1)} disabled={page <= 1}>Anterior</button>
          <span className="muted-label" style={{ marginBottom: 0 }}>Página {page} de {totalPages}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => cambiarPagina(page + 1)} disabled={page >= totalPages}>Siguiente</button>
        </div>
      )}

      {modal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal">
            <h2><IconStudent size={20} /> {modal === "new" ? "Nuevo alumno" : "Editar alumno"}</h2>
            {error && <div className="alert-error">{error}</div>}

            <div className="form-group"><label>Nombre completo</label>
              <input value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Sofía López" /></div>
            <div className="form-row">
              <div className="form-group"><label>DNI</label>
                <input value={form.dni || ""} maxLength={8} onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, "") })} placeholder="8 dígitos" /></div>
              <div className="form-group"><label>Fecha de nacimiento</label>
                <input type="date" value={form.fechaNac || ""} onChange={(e) => setForm({ ...form, fechaNac: e.target.value })} /></div>
            </div>
            <div className="form-group"><label>Email (usuario de acceso)</label>
              <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="alumno@colegio.edu" /></div>

            {modal !== "new" && (
              <div className="form-group"><label>Estado</label>
                <select value={form.estado || "ACTIVO"} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                  <option value="ACTIVO">Activo</option>
                  <option value="EGRESADO">Egresado</option>
                  <option value="RETIRADO">Retirado</option>
                </select>
                <div className="form-hint">Para promociones masivas de fin de año usa "Promoción de alumnos" en el menú.</div>
              </div>
            )}

            <div className="form-divider">Ubicación académica</div>
            <div className="form-group"><label>Año de ingreso</label>
              <input type="number" value={form.anoIngreso || ANO_ACTUAL} onChange={(e) => setForm({ ...form, anoIngreso: Number(e.target.value) })} />
              <div className="form-hint">Año en que el alumno ingresó por primera vez. La sección/periodo se elige siempre dentro del año lectivo activo configurado en "Estructura Académica".</div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Nivel</label>
                <select value={nivelSel} onChange={(e) => { setNivelSel(e.target.value); setGradoSel(""); setForm({ ...form, seccionId: "" }); }}>
                  <option value="">Seleccionar…</option>
                  {niveles.map((n: any) => <option key={n.id} value={n.tipo}>{NIVEL_LABEL[n.tipo]}</option>)}
                </select></div>
              <div className="form-group"><label>Grado</label>
                <select value={gradoSel} disabled={!nivelSel} onChange={(e) => { setGradoSel(e.target.value); setForm({ ...form, seccionId: "" }); }}>
                  <option value="">Seleccionar…</option>
                  {gradosDisponibles.map((g: any) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select></div>
            </div>
            <div className="form-group"><label>Sección</label>
              <select value={form.seccionId || ""} disabled={!gradoSel} onChange={(e) => setForm({ ...form, seccionId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {seccionesDisponibles.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select></div>
            {gradoSel && seccionesDisponibles.length === 0 && (
              <div className="form-hint" style={{ marginBottom: 14 }}>
                Este grado no tiene secciones todavía en el año lectivo activo. Créalas en "Estructura Académica".
              </div>
            )}

            <div className="form-divider">Datos del tutor / apoderado</div>
            <div className="form-row">
              <div className="form-group"><label>Nombre del tutor</label>
                <input value={form.tutorNombre || ""} onChange={(e) => setForm({ ...form, tutorNombre: e.target.value })} placeholder="Nombre completo" /></div>
              <div className="form-group"><label>DNI del tutor</label>
                <input value={form.tutorDni || ""} maxLength={8} onChange={(e) => setForm({ ...form, tutorDni: e.target.value.replace(/\D/g, "") })} placeholder="8 dígitos" /></div>
            </div>
            <div className="form-group"><label>Teléfono del tutor</label>
              <input value={form.tutorTelefono || ""} maxLength={9} onChange={(e) => setForm({ ...form, tutorTelefono: e.target.value.replace(/\D/g, "") })} placeholder="9 dígitos" /></div>

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

      {verTutor && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setVerTutor(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <h2><IconIdCard size={20} /> Datos del tutor</h2>
            <div className="info-line"><span>Alumno</span><strong>{verTutor.usuario.nombre}</strong></div>
            <div className="info-line"><span>Nombre del tutor</span><strong>{verTutor.tutorNombre}</strong></div>
            <div className="info-line"><span>DNI del tutor</span><strong>{verTutor.tutorDni || "—"}</strong></div>
            <div className="info-line"><span><IconPhone size={14} /> Teléfono</span><strong>{verTutor.tutorTelefono || "—"}</strong></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setVerTutor(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
