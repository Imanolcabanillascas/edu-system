"use client";
import { useEffect, useState } from "react";
import { initials, avatarColor, nombreGrado } from "@/lib/utils";
import { IconClass, IconSearch, IconPlus, IconEdit, IconTrash, IconLoader, IconClock, IconLocation, IconStudent } from "@/components/icons";

export default function ClasesPage() {
  const [clases, setClases] = useState<any[]>([]);
  const [materiasAll, setMateriasAll] = useState<any[]>([]);
  const [profesores, setProfesores] = useState<any[]>([]);
  const [alumnosAll, setAlumnosAll] = useState<any[]>([]);
  const [rol, setRol] = useState<string>("ALUMNO");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "new" | any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const [resClases, resUsuario] = await Promise.all([fetch("/api/clases"), fetch("/api/usuarios/me")]);
    setClases(await resClases.json());
    const usuario = await resUsuario.json();
    setRol(usuario?.rol ?? "ALUMNO");

    if (usuario?.rol === "ADMIN") {
      const [resM, resP, resA] = await Promise.all([fetch("/api/materias"), fetch("/api/profesores"), fetch("/api/alumnos?all=true")]);
      setMateriasAll(await resM.json());
      setProfesores(await resP.json());
      setAlumnosAll(await resA.json());
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const nombreClase = (c: any) => `${c.materia.nombre} — ${c.seccion.grado.nombre} "${c.seccion.nombre}"`;

  const filtered = clases.filter((c) => nombreClase(c).toLowerCase().includes(search.toLowerCase()) || c.salon.toLowerCase().includes(search.toLowerCase()));
  const isAdmin = rol === "ADMIN";

  // Materia seleccionada determina qué sección/periodo y alumnos puede tomar (mismo grado de la materia)
  const materiaSel = materiasAll.find((m: any) => m.id === form.materiaId);
  const profesoresDeLaMateria = materiaSel ? profesores.filter((p: any) => p.materias.some((pm: any) => pm.materia.id === materiaSel.id)) : profesores;

  const openNew = () => { setForm({ materiaId: "", seccionId: "", profesorId: "", horario: "", salon: "", alumnoIds: [] }); setError(""); setModal("new"); };
  const openEdit = (c: any) => {
    setForm({
      id: c.id, materiaId: c.materiaId, seccionId: c.seccionId, profesorId: c.profesor.id,
      horario: c.horario, salon: c.salon, alumnoIds: c.alumnos.map((a: any) => a.alumno.id),
    });
    setError(""); setModal(c);
  };
  const close = () => setModal(null);

  const save = async () => {
    if (!form.materiaId || !form.seccionId || !form.profesorId) { setError("Completa materia, sección y profesor"); return; }
    setSaving(true); setError("");
    const method = modal === "new" ? "POST" : "PUT";
    const res = await fetch("/api/clases", { method, body: JSON.stringify(form) });
    if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    setSaving(false);
    close();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta clase?")) return;
    await fetch("/api/clases", { method: "DELETE", body: JSON.stringify({ id }) });
    load();
  };

  const toggleAlumno = (id: string) => {
    const ids = form.alumnoIds || [];
    setForm({ ...form, alumnoIds: ids.includes(id) ? ids.filter((x: string) => x !== id) : [...ids, id] });
  };

  // Alumnos que pertenecen a la sección de la materia elegida (mismo gradoId que la materia)
  const alumnosDeSeccion = (seccionId: string) => alumnosAll.filter((a: any) => a.seccion?.id === seccionId);

  return (
    <div>
      <div className="page-header">
        <h1>{isAdmin ? "Clases" : "Mis Clases"}</h1>
        <p>{isAdmin ? "Vincula una materia con una sección y un profesor" : "Consulta tus clases asignadas"}</p>
      </div>
      <div className="toolbar">
        <div className="search-wrap">
          <IconSearch size={16} className="search-icon" />
          <input className="search-input" placeholder="Buscar por materia o salón…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openNew}><IconPlus size={16} /> Nueva clase</button>}
      </div>

      {loading ? (
        <div className="empty"><IconLoader size={24} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty"><IconClass size={32} style={{ color: "var(--muted)" }} /><p>No se encontraron clases</p></div>
      ) : (
        <div className="card-grid">
          {filtered.map((c) => (
            <div className="info-card" key={c.id}>
              <div className="info-card-title">{nombreClase(c)}</div>
              <div className="info-card-meta">
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className="avatar" style={{ width: 20, height: 20, fontSize: ".6rem", background: avatarColor(c.profesor.usuario.nombre) + "33", color: avatarColor(c.profesor.usuario.nombre) }}>
                    {initials(c.profesor.usuario.nombre)}
                  </div>
                  {c.profesor.usuario.nombre}
                </span>
                <span><IconClock size={13} /> {c.horario}</span>
                <span><IconLocation size={13} /> {c.salon}</span>
                <span><IconStudent size={13} /> {c.alumnos.length} alumnos</span>
              </div>
              {isAdmin && (
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}><IconEdit size={14} /> Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(c.id)}><IconTrash size={14} /> Eliminar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && isAdmin && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal">
            <h2><IconClass size={20} /> {modal === "new" ? "Nueva clase" : "Editar clase"}</h2>
            {error && <div className="alert-error">{error}</div>}

            <div className="form-group"><label>Materia</label>
              <select value={form.materiaId || ""} disabled={modal !== "new"} onChange={(e) => setForm({ ...form, materiaId: e.target.value, seccionId: "", profesorId: "" })}>
                <option value="">Seleccionar…</option>
                {materiasAll.map((m: any) => <option key={m.id} value={m.id}>{m.nombre} — {nombreGrado(m.grado)}</option>)}
              </select>
              {modal !== "new" && <div className="form-hint">La materia no se puede cambiar después de crear la clase</div>}
            </div>

            {materiaSel && (
              <div className="form-group"><label>Sección</label>
                <select value={form.seccionId || ""} onChange={(e) => setForm({ ...form, seccionId: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {materiaSel.grado.secciones?.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>) ?? null}
                </select>
                {(!materiaSel.grado.secciones || materiaSel.grado.secciones.length === 0) && (
                  <div className="form-hint">
                    Este grado no tiene secciones — créalas en "Estructura Académica"
                  </div>
                )}
              </div>
            )}

            <div className="form-group"><label>Profesor</label>
              <select value={form.profesorId || ""} onChange={(e) => setForm({ ...form, profesorId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {profesoresDeLaMateria.map((p: any) => <option key={p.id} value={p.id}>{p.usuario.nombre}</option>)}
              </select>
              {materiaSel && profesoresDeLaMateria.length === 0 && (
                <div className="form-hint">Ningún profesor está asignado a esta materia todavía — edítalo en "Materias"</div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group"><label>Horario</label>
                <input value={form.horario || ""} onChange={(e) => setForm({ ...form, horario: e.target.value })} placeholder="Ej: Lun/Mié 08:00" /></div>
              <div className="form-group"><label>Salón</label>
                <input value={form.salon || ""} onChange={(e) => setForm({ ...form, salon: e.target.value })} placeholder="Ej: Aula 12" /></div>
            </div>

            {form.seccionId && (
              <div className="form-group"><label>Alumnos de esta sección</label>
                <div className="chip-selector">
                  {alumnosDeSeccion(form.seccionId).map((a: any) => {
                    const sel = (form.alumnoIds || []).includes(a.id);
                    return (
                      <button key={a.id} type="button" className={`chip-btn ${sel ? "chip-btn-active" : ""}`} onClick={() => toggleAlumno(a.id)}>
                        {a.usuario.nombre}
                      </button>
                    );
                  })}
                  {alumnosDeSeccion(form.seccionId).length === 0 && <span className="muted-label">No hay alumnos matriculados en esta sección todavía</span>}
                </div>
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
