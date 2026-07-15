"use client";
import { useEffect, useState } from "react";
import { initials, avatarColor, NIVEL_LABEL } from "@/lib/utils";
import { IconClass, IconSearch, IconPlus, IconEdit, IconTrash, IconLoader, IconClock, IconLocation, IconStudent, IconTeacher, IconCheck, IconBook } from "@/components/icons";

export default function ClasesPage() {
  const [clases, setClases] = useState<any[]>([]);
  const [planes, setPlanes] = useState<any[]>([]);
  const [secciones, setSecciones] = useState<any[]>([]);
  const [profesores, setProfesores] = useState<any[]>([]);
  const [niveles, setNiveles] = useState<any[]>([]);
  const [rol, setRol] = useState<string>("ALUMNO");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "new" | any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [modalTutor, setModalTutor] = useState(false);
  const [tutorForm, setTutorForm] = useState<any>({});
  const [savingTutor, setSavingTutor] = useState(false);
  const [errorTutor, setErrorTutor] = useState("");
  const [resultadoTutor, setResultadoTutor] = useState<string | null>(null);

  const [modalMaterias, setModalMaterias] = useState(false);
  const [materiasForm, setMateriasForm] = useState<any>({});
  const [savingMaterias, setSavingMaterias] = useState(false);
  const [errorMaterias, setErrorMaterias] = useState("");
  const [resultadoMaterias, setResultadoMaterias] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [resClases, resUsuario] = await Promise.all([fetch("/api/clases"), fetch("/api/usuarios/me")]);
    setClases(await resClases.json());
    const usuario = await resUsuario.json();
    setRol(usuario?.rol ?? "ALUMNO");

    if (usuario?.rol === "ADMIN") {
      const [resP, resP2, resN, resS] = await Promise.all([
        fetch("/api/plan-estudio"),
        fetch("/api/profesores"),
        fetch("/api/niveles"),
        fetch("/api/secciones"),
      ]);
      setPlanes(await resP.json());
      setProfesores(await resP2.json());
      setNiveles(await resN.json());
      setSecciones(await resS.json());
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const nombreClase = (c: any) =>
    `${c.planEstudio.materia.nombre} — ${c.seccion.grado.nombre} "${c.seccion.nombre}"`;

  const filtered = clases.filter((c) =>
    nombreClase(c).toLowerCase().includes(search.toLowerCase()) ||
    (c.salon || "").toLowerCase().includes(search.toLowerCase())
  );
  const isAdmin = rol === "ADMIN";

  // Para el modal de nueva clase: el plan seleccionado determina el grado,
  // y las secciones disponibles son las de ese grado.
  const planSel = planes.find((p: any) => p.id === form.planEstudioId);
  const seccionesDelGrado = planSel
    ? secciones.filter((s: any) => s.gradoId === planSel.grado.id)
    : [];

  const openNew = () => { setForm({ planEstudioId: "", seccionId: "", profesorId: "", horario: "", salon: "" }); setError(""); setModal("new"); };
  const openEdit = (c: any) => {
    setForm({
      id: c.id, planEstudioId: c.planEstudioId, seccionId: c.seccionId,
      profesorId: c.profesor.id, horario: c.horario || "", salon: c.salon || "",
    });
    setError(""); setModal(c);
  };
  const close = () => setModal(null);

  const save = async () => {
    if (!form.planEstudioId || !form.seccionId || !form.profesorId) { setError("Completa todos los campos obligatorios"); return; }
    setSaving(true); setError("");
    const method = modal === "new" ? "POST" : "PUT";
    const res = await fetch("/api/clases", { method, body: JSON.stringify(form) });
    if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    setSaving(false); close(); load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta clase? Se borrarán sus tareas y exámenes.")) return;
    const res = await fetch("/api/clases", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    load();
  };

  // ── Asignar profesor tutor (Primaria) ────────────────────────────────────
  const nivelPrimaria = niveles.find((n: any) => n.tipo === "PRIMARIA");
  const seccionesPrimaria = nivelPrimaria
    ? nivelPrimaria.grados.flatMap((g: any) =>
        g.secciones.map((s: any) => ({ ...s, gradoNombre: g.nombre, gradoId: g.id, profesorTutor: s.profesorTutor }))
      )
    : [];

  const abrirAsignarTutor = () => {
    setTutorForm({ profesorId: "", seccionId: "", horario: "", salon: "", planEstudioIds: [] });
    setErrorTutor(""); setResultadoTutor(null); setModalTutor(true);
  };

  const planesDelGradoTutor = tutorForm.seccionId
    ? planes.filter((p: any) => p.grado.id === seccionesPrimaria.find((s: any) => s.id === tutorForm.seccionId)?.gradoId)
    : [];

  const togglePlanTutor = (id: string) => {
    const ids = tutorForm.planEstudioIds || [];
    setTutorForm({ ...tutorForm, planEstudioIds: ids.includes(id) ? ids.filter((x: string) => x !== id) : [...ids, id] });
  };

  const guardarTutor = async () => {
    if (!tutorForm.profesorId || !tutorForm.seccionId) { setErrorTutor("Selecciona profesor y sección"); return; }
    setSavingTutor(true); setErrorTutor(""); setResultadoTutor(null);
    const res = await fetch("/api/asignar-tutor", { method: "POST", body: JSON.stringify(tutorForm) });
    const data = await res.json();
    setSavingTutor(false);
    if (!res.ok) { setErrorTutor(data.error); return; }
    setResultadoTutor(`Se asignaron ${data.total} clase(s) al profesor tutor.`);
    load();
  };

  // ── Asignar materias sin ser tutor ────────────────────────────────────────
  const todasLasSecciones = niveles.flatMap((n: any) =>
    n.grados.flatMap((g: any) =>
      g.secciones.map((s: any) => ({ ...s, gradoNombre: g.nombre, gradoId: g.id, nivelNombre: n.nombre }))
    )
  );

  const abrirAsignarMaterias = () => {
    setMateriasForm({ profesorId: "", seccionId: "", horario: "", salon: "", planEstudioIds: [] });
    setErrorMaterias(""); setResultadoMaterias(null); setModalMaterias(true);
  };

  const planesDelGradoForm = materiasForm.seccionId
    ? planes.filter((p: any) => p.grado.id === todasLasSecciones.find((s: any) => s.id === materiasForm.seccionId)?.gradoId)
    : [];

  const togglePlanForm = (id: string) => {
    const ids = materiasForm.planEstudioIds || [];
    setMateriasForm({ ...materiasForm, planEstudioIds: ids.includes(id) ? ids.filter((x: string) => x !== id) : [...ids, id] });
  };

  const guardarMaterias = async () => {
    if (!materiasForm.profesorId || !materiasForm.seccionId) { setErrorMaterias("Selecciona profesor y sección"); return; }
    if (!materiasForm.planEstudioIds?.length) { setErrorMaterias("Selecciona al menos una materia"); return; }
    setSavingMaterias(true); setErrorMaterias(""); setResultadoMaterias(null);
    const res = await fetch("/api/asignar-materias", { method: "POST", body: JSON.stringify(materiasForm) });
    const data = await res.json();
    setSavingMaterias(false);
    if (!res.ok) { setErrorMaterias(data.error); return; }
    setResultadoMaterias(`Se asignaron ${data.total} materia(s) correctamente.`);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1><IconClass size={24} /> Clases</h1>
        <p>Cada clase vincula una materia del plan de estudios con una sección y un profesor</p>
      </div>
      <div className="toolbar">
        <div className="search-wrap">
          <IconSearch size={16} className="search-icon" />
          <input className="search-input" placeholder="Buscar por materia, grado o salón…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isAdmin && (
          <>
            <button className="btn btn-ghost" onClick={abrirAsignarTutor}><IconTeacher size={16} /> Asignar profesor tutor</button>
            <button className="btn btn-ghost" onClick={abrirAsignarMaterias}><IconBook size={16} /> Asignar materias</button>
            <button className="btn btn-primary" onClick={openNew}><IconPlus size={16} /> Nueva clase</button>
          </>
        )}
      </div>

      {loading ? (
        <div className="empty"><IconLoader size={24} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty"><IconClass size={32} style={{ color: "var(--muted)" }} /><p>No hay clases creadas todavía</p></div>
      ) : (
        <div className="card-grid">
          {filtered.map((c) => (
            <div className="info-card" key={c.id}>
              <div className="info-card-title">
                {c.planEstudio.materia.nombre}
                {isAdmin && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(c)}><IconEdit size={14} /></button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => remove(c.id)}><IconTrash size={14} /></button>
                  </div>
                )}
              </div>
              <div className="info-card-meta">
                <span>{c.seccion.grado.nombre} "{c.seccion.nombre}"</span>
                <span><IconTeacher size={13} /> {c.profesor.usuario.nombre}</span>
                {c.horario && <span><IconClock size={13} /> {c.horario}</span>}
                {c.salon && <span><IconLocation size={13} /> {c.salon}</span>}
                <span><IconStudent size={13} /> {c.seccion.alumnos?.length ?? 0} alumnos</span>
                {c.planEstudio.materia.area && (
                  <span className="badge" style={{ background: "var(--surface2)", color: "var(--muted)" }}>{c.planEstudio.materia.area}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nueva/editar clase */}
      {modal && isAdmin && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal">
            <h2><IconClass size={20} /> {modal === "new" ? "Nueva clase" : "Editar clase"}</h2>
            {error && <div className="alert-error">{error}</div>}

            <div className="form-group"><label>Materia (Plan de Estudios)</label>
              <select value={form.planEstudioId || ""} onChange={(e) => setForm({ ...form, planEstudioId: e.target.value, seccionId: "" })}>
                <option value="">Seleccionar…</option>
                {planes.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.materia.nombre} — {p.grado.nombre} ({p.grado.nivel.nombre})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group"><label>Sección</label>
              <select value={form.seccionId || ""} disabled={!form.planEstudioId} onChange={(e) => setForm({ ...form, seccionId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {seccionesDelGrado.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              {form.planEstudioId && seccionesDelGrado.length === 0 && (
                <div className="form-hint">Este grado no tiene secciones en el año activo — créalas en "Estructura Académica"</div>
              )}
            </div>

            <div className="form-group"><label>Profesor</label>
              <select value={form.profesorId || ""} onChange={(e) => setForm({ ...form, profesorId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {profesores.map((p: any) => <option key={p.id} value={p.id}>{p.usuario.nombre}</option>)}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group"><label>Horario</label>
                <input value={form.horario || ""} onChange={(e) => setForm({ ...form, horario: e.target.value })} placeholder="Ej: Lun/Mié 08:00" /></div>
              <div className="form-group"><label>Salón</label>
                <input value={form.salon || ""} onChange={(e) => setForm({ ...form, salon: e.target.value })} placeholder="Ej: Aula 3" /></div>
            </div>

            {form.seccionId && (
              <div className="form-hint" style={{ marginBottom: 14 }}>
                Todos los alumnos matriculados en esa sección tendrán acceso automático a esta clase.
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignar tutor */}
      {modalTutor && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalTutor(false)}>
          <div className="modal">
            <h2><IconTeacher size={20} /> Asignar profesor tutor</h2>
            <p className="form-hint" style={{ marginBottom: 16 }}>Solo Primaria. Crea una clase por cada materia del Plan de Estudios del grado con el mismo profesor.</p>
            {errorTutor && <div className="alert-error">{errorTutor}</div>}
            {resultadoTutor && <div className="alert-banner" style={{ cursor: "default", background: "var(--green)15", borderColor: "var(--green)40", color: "var(--green)", marginBottom: 16 }}><IconCheck size={16} /> {resultadoTutor}</div>}

            <div className="form-group"><label>Sección de Primaria</label>
              <select value={tutorForm.seccionId || ""} onChange={(e) => setTutorForm({ ...tutorForm, seccionId: e.target.value, planEstudioIds: [] })}>
                <option value="">Seleccionar…</option>
                {seccionesPrimaria.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.gradoNombre} "{s.nombre}"{s.profesorTutor ? ` — tutor actual: ${s.profesorTutor.usuario.nombre}` : ""}
                  </option>
                ))}
              </select>
              {tutorForm.seccionId && seccionesPrimaria.find((s: any) => s.id === tutorForm.seccionId)?.profesorTutor && (
                <div className="form-hint" style={{ color: "var(--accent)" }}>Esta sección ya tiene tutor. Continuar lo reemplazará.</div>
              )}
            </div>

            <div className="form-group"><label>Profesor tutor</label>
              <select value={tutorForm.profesorId || ""} onChange={(e) => setTutorForm({ ...tutorForm, profesorId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {profesores.map((p: any) => <option key={p.id} value={p.id}>{p.usuario.nombre}</option>)}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group"><label>Horario</label><input value={tutorForm.horario || ""} onChange={(e) => setTutorForm({ ...tutorForm, horario: e.target.value })} placeholder="Lun-Vie 08:00" /></div>
              <div className="form-group"><label>Salón</label><input value={tutorForm.salon || ""} onChange={(e) => setTutorForm({ ...tutorForm, salon: e.target.value })} placeholder="Aula 3" /></div>
            </div>

            {tutorForm.seccionId && (
              <div className="form-group"><label>Materias del Plan de Estudios</label>
                {planesDelGradoTutor.length === 0 ? (
                  <div className="form-hint">Este grado no tiene Plan de Estudios — créalo primero en "Plan de Estudios"</div>
                ) : (
                  <>
                    <div className="chip-selector">
                      {planesDelGradoTutor.map((p: any) => {
                        const sel = (tutorForm.planEstudioIds || []).includes(p.id);
                        return <button key={p.id} type="button" className={`chip-btn ${sel ? "chip-btn-active" : ""}`} onClick={() => togglePlanTutor(p.id)}>{p.materia.nombre}</button>;
                      })}
                    </div>
                    <div className="form-hint">Si no seleccionas ninguna, se asignan todas las del plan.</div>
                  </>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalTutor(false)}>Cerrar</button>
              <button className="btn btn-primary" onClick={guardarTutor} disabled={savingTutor}>{savingTutor ? "Asignando…" : "Asignar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignar materias sin ser tutor */}
      {modalMaterias && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalMaterias(false)}>
          <div className="modal">
            <h2><IconBook size={20} /> Asignar materias a profesor</h2>
            <p className="form-hint" style={{ marginBottom: 16 }}>Asigna varias materias a un profesor en cualquier nivel, sin marcarlo como tutor.</p>
            {errorMaterias && <div className="alert-error">{errorMaterias}</div>}
            {resultadoMaterias && <div className="alert-banner" style={{ cursor: "default", background: "var(--green)15", borderColor: "var(--green)40", color: "var(--green)", marginBottom: 16 }}><IconCheck size={16} /> {resultadoMaterias}</div>}

            <div className="form-group"><label>Sección</label>
              <select value={materiasForm.seccionId || ""} onChange={(e) => setMateriasForm({ ...materiasForm, seccionId: e.target.value, planEstudioIds: [] })}>
                <option value="">Seleccionar…</option>
                {todasLasSecciones.map((s: any) => <option key={s.id} value={s.id}>{s.gradoNombre} "{s.nombre}" — {s.nivelNombre}</option>)}
              </select>
            </div>

            <div className="form-group"><label>Profesor</label>
              <select value={materiasForm.profesorId || ""} onChange={(e) => setMateriasForm({ ...materiasForm, profesorId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {profesores.map((p: any) => <option key={p.id} value={p.id}>{p.usuario.nombre}</option>)}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group"><label>Horario</label><input value={materiasForm.horario || ""} onChange={(e) => setMateriasForm({ ...materiasForm, horario: e.target.value })} placeholder="Mar/Jue 10:00" /></div>
              <div className="form-group"><label>Salón</label><input value={materiasForm.salon || ""} onChange={(e) => setMateriasForm({ ...materiasForm, salon: e.target.value })} placeholder="Aula 5" /></div>
            </div>

            {materiasForm.seccionId && (
              <div className="form-group"><label>Materias</label>
                {planesDelGradoForm.length === 0 ? (
                  <div className="form-hint">Este grado no tiene Plan de Estudios creado todavía</div>
                ) : (
                  <div className="chip-selector">
                    {planesDelGradoForm.map((p: any) => {
                      const sel = (materiasForm.planEstudioIds || []).includes(p.id);
                      return <button key={p.id} type="button" className={`chip-btn ${sel ? "chip-btn-active" : ""}`} onClick={() => togglePlanForm(p.id)}>{p.materia.nombre}</button>;
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalMaterias(false)}>Cerrar</button>
              <button className="btn btn-primary" onClick={guardarMaterias} disabled={savingMaterias}>{savingMaterias ? "Asignando…" : "Asignar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
