"use client";
import { useEffect, useState } from "react";
import { NIVEL_LABEL } from "@/lib/utils";
import { IconLayers, IconPlus, IconTrash, IconLoader, IconAlert, IconEdit, IconCheck, IconCard } from "@/components/icons";

export default function AcademicoPage() {
  const [niveles, setNiveles] = useState<any[]>([]);
  const [allGrados, setAllGrados] = useState<any[]>([]);
  const [anos, setAnos] = useState<any[]>([]);
  const [anoSel, setAnoSel] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"PRIMARIA" | "SECUNDARIA" | "SUPERIOR">("PRIMARIA");
  const [error, setError] = useState("");

  const [editandoNivel, setEditandoNivel] = useState(false);
  const [nombreNivelForm, setNombreNivelForm] = useState("");

  const [modalAno, setModalAno] = useState(false);
  const [nuevoAnoForm, setNuevoAnoForm] = useState(new Date().getFullYear() + 1);
  const [savingAno, setSavingAno] = useState(false);

  const [modalCarrera, setModalCarrera] = useState<null | "new" | any>(null);
  const [nombreCarrera, setNombreCarrera] = useState("");
  const [totalCiclosForm, setTotalCiclosForm] = useState(6);
  const [modalGrado, setModalGrado] = useState<null | { carreraId?: string; editar?: any }>(null);
  const [nombreGradoForm, setNombreGradoForm] = useState("");
  const [gradoSiguienteForm, setGradoSiguienteForm] = useState("");
  const [modalSeccion, setModalSeccion] = useState<null | { gradoId: string }>(null);
  const [nombreSeccionForm, setNombreSeccionForm] = useState("");
  const [periodoForm, setPeriodoForm] = useState("I"); // I o II, solo para Superior
  const [saving, setSaving] = useState(false);

  const loadAnos = async () => {
    const res = await fetch("/api/anos-lectivos");
    const data = await res.json();
    setAnos(data);
    const activo = data.find((a: any) => a.activo);
    setAnoSel((activo ?? data[0])?.id ?? "");
    return (activo ?? data[0])?.id ?? "";
  };

  const loadNiveles = async (anoId: string) => {
    setLoading(true);
    const qs = anoId ? `?anoLectivoId=${anoId}` : "";
    const res = await fetch(`/api/niveles${qs}`);
    setNiveles(await res.json());
    setLoading(false);
  };

  const init = async () => {
    const anoId = await loadAnos();
    await loadNiveles(anoId);
    const resG = await fetch("/api/grados");
    setAllGrados(await resG.json());
  };
  useEffect(() => { init(); }, []);

  const cambiarAno = async (id: string) => {
    setAnoSel(id);
    await loadNiveles(id);
  };

  const crearAno = async () => {
    setSavingAno(true); setError("");
    const res = await fetch("/api/anos-lectivos", { method: "POST", body: JSON.stringify({ anio: nuevoAnoForm, activo: true }) });
    setSavingAno(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    setModalAno(false);
    const anoId = await loadAnos();
    await loadNiveles(anoId);
  };

  const marcarAnoActivo = async (id: string) => {
    await fetch("/api/anos-lectivos", { method: "PUT", body: JSON.stringify({ id, activo: true }) });
    await loadAnos();
  };

  const nivelActual = niveles.find((n) => n.tipo === tab);
  const esSuperior = tab === "SUPERIOR";
  const anoActivo = anos.find((a: any) => a.id === anoSel);

  const guardarNombreNivel = async () => {
    if (!nombreNivelForm.trim() || !nivelActual) return;
    setSaving(true);
    await fetch("/api/niveles", { method: "PUT", body: JSON.stringify({ id: nivelActual.id, nombre: nombreNivelForm }) });
    setSaving(false);
    setEditandoNivel(false);
    loadNiveles(anoSel);
  };

  const abrirNuevaCarrera = () => { setNombreCarrera(""); setTotalCiclosForm(6); setError(""); setModalCarrera("new"); };
  const abrirEditarCarrera = (c: any) => { setNombreCarrera(c.nombre); setError(""); setModalCarrera(c); };
  const guardarCarrera = async () => {
    if (!nombreCarrera.trim() || !nivelActual) return;
    const esNueva = modalCarrera === "new";
    if (esNueva && (!totalCiclosForm || totalCiclosForm < 1)) {
      setError("Indica cuántos ciclos tiene la carrera (mínimo 1)");
      return;
    }
    setSaving(true); setError("");
    const res = await fetch("/api/carreras", {
      method: esNueva ? "POST" : "PUT",
      body: JSON.stringify(
        esNueva
          ? { nombre: nombreCarrera, nivelId: nivelActual.id, totalCiclos: totalCiclosForm }
          : { id: modalCarrera.id, nombre: nombreCarrera }
      ),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    setModalCarrera(null);
    loadNiveles(anoSel);
    const resG = await fetch("/api/grados");
    setAllGrados(await resG.json());
  };

  const eliminarCarrera = async (id: string) => {
    if (!confirm("¿Eliminar esta carrera? Debe no tener grados/ciclos asociados.")) return;
    const res = await fetch("/api/carreras", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    loadNiveles(anoSel);
  };

  const abrirNuevoGrado = (carreraId?: string) => { setNombreGradoForm(""); setGradoSiguienteForm(""); setError(""); setModalGrado({ carreraId }); };
  const abrirEditarGrado = (g: any) => { setNombreGradoForm(g.nombre); setGradoSiguienteForm(g.gradoSiguienteId ?? ""); setError(""); setModalGrado({ editar: g }); };
  const guardarGrado = async () => {
    if (!nombreGradoForm.trim() || !nivelActual) return;
    setSaving(true); setError("");
    const esEdicion = !!modalGrado?.editar;
    const res = await fetch("/api/grados", {
      method: esEdicion ? "PUT" : "POST",
      body: JSON.stringify(
        esEdicion
          ? { id: modalGrado.editar.id, nombre: nombreGradoForm, gradoSiguienteId: gradoSiguienteForm || null }
          : { nombre: nombreGradoForm, nivelId: nivelActual.id, carreraId: modalGrado?.carreraId }
      ),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    setModalGrado(null);
    loadNiveles(anoSel);
    const resG = await fetch("/api/grados");
    setAllGrados(await resG.json());
  };

  const eliminarGrado = async (id: string) => {
    if (!confirm(`¿Eliminar este ${esSuperior ? "ciclo" : "grado"}? Debe no tener ${esSuperior ? "periodos" : "secciones"} ni materias asociadas.`)) return;
    const res = await fetch("/api/grados", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    loadNiveles(anoSel);
  };

  const abrirNuevaSeccion = (gradoId: string) => {
    setNombreSeccionForm(""); setPeriodoForm("I"); setError("");
    setModalSeccion({ gradoId });
  };
  const crearSeccion = async () => {
    if (!modalSeccion || !anoSel) return;
    const nombre = esSuperior ? `${anoActivo.anio}-${periodoForm}` : nombreSeccionForm;
    if (!nombre.trim()) return;
    setSaving(true); setError("");
    const res = await fetch("/api/secciones", { method: "POST", body: JSON.stringify({ nombre, gradoId: modalSeccion.gradoId, anoLectivoId: anoSel }) });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    setModalSeccion(null);
    loadNiveles(anoSel);
  };

  const eliminarSeccion = async (id: string) => {
    if (!confirm(`¿Eliminar este ${esSuperior ? "periodo" : "sección"}? Debe no tener alumnos ni clases asociadas.`)) return;
    const res = await fetch("/api/secciones", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    loadNiveles(anoSel);
  };

  const gradosPorCarrera = () => {
    if (!nivelActual) return [];
    if (!esSuperior) {
      return [{ carrera: null, grados: nivelActual.grados.filter((g: any) => !g.carreraId) }];
    }
    return nivelActual.carreras.map((c: any) => ({
      carrera: c,
      grados: nivelActual.grados.filter((g: any) => g.carreraId === c.id),
    }));
  };

  const cambiarTab = (t: "PRIMARIA" | "SECUNDARIA" | "SUPERIOR") => {
    setTab(t);
    setEditandoNivel(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1><IconLayers size={26} /> Estructura Académica</h1>
        <p>Define años lectivos, carreras, grados/ciclos y secciones/periodos del colegio</p>
      </div>

      <div className="toolbar" style={{ marginBottom: 20 }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 220 }}>
          <label>Año lectivo</label>
          <select value={anoSel} onChange={(e) => cambiarAno(e.target.value)}>
            {anos.map((a: any) => <option key={a.id} value={a.id}>{a.anio}{a.activo ? " (activo)" : ""}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }} />
        {anoActivo && !anoActivo.activo && (
          <button className="btn btn-ghost btn-sm" onClick={() => marcarAnoActivo(anoActivo.id)}>
            <IconCheck size={14} /> Marcar {anoActivo.anio} como activo
          </button>
        )}
        <button className="btn btn-primary btn-sm" onClick={() => { setNuevoAnoForm((anos[0]?.anio ?? new Date().getFullYear()) + 1); setError(""); setModalAno(true); }}>
          <IconPlus size={14} /> Nuevo año lectivo
        </button>
      </div>

      <div className="tabs">
        {(["PRIMARIA", "SECUNDARIA", "SUPERIOR"] as const).map((t) => {
          const n = niveles.find((nv) => nv.tipo === t);
          return (
            <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => cambiarTab(t)}>
              {n?.nombre ?? t}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="empty"><IconLoader size={24} /></div>
      ) : !nivelActual ? (
        <div className="empty"><IconAlert size={28} style={{ color: "var(--muted)" }} /><p>No se pudo cargar este nivel</p></div>
      ) : (
        <>
          {esSuperior && (
            <div className="alert-banner" style={{ cursor: "default", background: "var(--accent2)15", borderColor: "var(--accent2)40", color: "var(--accent2)" }}>
              <IconAlert size={16} />
              En Superior cada ciclo se divide por periodos de ingreso (ej. {anoActivo?.anio ?? "2026"}-I, {anoActivo?.anio ?? "2026"}-II) en vez de secciones A/B/C.
            </div>
          )}

          <div className="toolbar">
            {editandoNivel ? (
              <div className="editable-title">
                <input value={nombreNivelForm} onChange={(e) => setNombreNivelForm(e.target.value)} autoFocus />
                <button className="btn btn-ghost btn-icon btn-sm" onClick={guardarNombreNivel} disabled={saving}><IconCheck size={14} /></button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => { setNombreNivelForm(nivelActual.nombre); setEditandoNivel(true); }}>
                <IconEdit size={14} /> Renombrar "{nivelActual.nombre}"
              </button>
            )}
            <div style={{ flex: 1 }} />
            {esSuperior ? (
              <button className="btn btn-primary" onClick={abrirNuevaCarrera}><IconPlus size={16} /> Nueva carrera</button>
            ) : (
              <button className="btn btn-primary" onClick={() => abrirNuevoGrado(undefined)}><IconPlus size={16} /> Nuevo grado</button>
            )}
          </div>

          {gradosPorCarrera().map((grupo: any) => (
            <div key={grupo.carrera?.id ?? "sin-carrera"} style={{ marginBottom: 28 }}>
              {esSuperior && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 className="section-title" style={{ marginBottom: 0 }}>{grupo.carrera.nombre}</h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirNuevoGrado(grupo.carrera.id)}><IconPlus size={13} /> Ciclo</button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => abrirEditarCarrera(grupo.carrera)}><IconEdit size={13} /></button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => eliminarCarrera(grupo.carrera.id)}><IconTrash size={13} /></button>
                  </div>
                </div>
              )}

              {grupo.grados.length === 0 ? (
                <div className="empty" style={{ padding: "30px 20px" }}>
                  <p>{esSuperior ? "Sin ciclos creados para esta carrera" : "Sin grados creados"}</p>
                </div>
              ) : (
                <div className="card-grid">
                  {grupo.grados.map((g: any) => (
                    <div className="info-card" key={g.id}>
                      <div className="info-card-title">
                        {g.nombre}
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => abrirEditarGrado(g)}><IconEdit size={13} /></button>
                          <button className="btn btn-danger btn-icon btn-sm" onClick={() => eliminarGrado(g.id)}><IconTrash size={13} /></button>
                        </div>
                      </div>
                      <div className="muted-label" style={{ marginBottom: 10 }}>
                        {esSuperior ? "Periodos de ingreso" : "Secciones"} — {anoActivo?.anio}
                      </div>
                      {g.gradoSiguiente ? (
                        <div className="form-hint" style={{ marginBottom: 8 }}>→ Siguiente: {g.gradoSiguiente.nombre}</div>
                      ) : (
                        <div className="form-hint" style={{ marginBottom: 8, color: "var(--accent)" }}>Sin grado siguiente — se egresa al aprobar</div>
                      )}
                      <div className="chips">
                        {g.secciones.length === 0 && <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>{esSuperior ? "Sin periodos" : "Sin secciones"} este año</span>}
                        {g.secciones.map((s: any) => (
                          <span key={s.id} className="chip" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {s.nombre}
                            <button onClick={() => eliminarSeccion(s.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0, display: "flex" }}>
                              <IconTrash size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => abrirNuevaSeccion(g.id)}>
                        <IconPlus size={13} /> {esSuperior ? "Agregar periodo" : "Agregar sección"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {modalAno && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalAno(false)}>
          <div className="modal">
            <h2><IconCard size={20} /> Nuevo año lectivo</h2>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-group"><label>Año</label>
              <input type="number" value={nuevoAnoForm} onChange={(e) => setNuevoAnoForm(Number(e.target.value))} /></div>
            <div className="form-hint" style={{ marginBottom: 14 }}>Se marcará como año activo automáticamente.</div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalAno(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={crearAno} disabled={savingAno}>{savingAno ? "Creando…" : "Crear año"}</button>
            </div>
          </div>
        </div>
      )}

      {modalCarrera && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalCarrera(null)}>
          <div className="modal">
            <h2><IconLayers size={20} /> {modalCarrera === "new" ? "Nueva carrera" : "Editar carrera"}</h2>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-group"><label>Nombre de la carrera</label>
              <input value={nombreCarrera} onChange={(e) => setNombreCarrera(e.target.value)} placeholder="Ej: Enfermería" /></div>
            {modalCarrera === "new" && (
              <div className="form-group"><label>¿Cuántos ciclos tiene esta carrera?</label>
                <input type="number" min={1} max={20} value={totalCiclosForm} onChange={(e) => setTotalCiclosForm(Number(e.target.value))} />
                <div className="form-hint">
                  Se crearán automáticamente "Ciclo 1" a "Ciclo {totalCiclosForm}", ya enlazados en secuencia. El Ciclo es fijo en la malla de la carrera; cada periodo de matrícula (ej. "{anoActivo?.anio ?? 2026}-I") se asigna después por separado en cada ciclo.
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalCarrera(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarCarrera} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {modalGrado && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalGrado(null)}>
          <div className="modal">
            <h2><IconLayers size={20} /> {modalGrado.editar ? "Editar" : "Nuevo"} {esSuperior ? "ciclo" : "grado"}</h2>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-group"><label>{esSuperior ? "Nombre del ciclo" : "Nombre del grado"}</label>
              <input value={nombreGradoForm} onChange={(e) => setNombreGradoForm(e.target.value)} placeholder={esSuperior ? "Ej: Ciclo 1" : "Ej: 1er Grado"} /></div>
            {modalGrado.editar && (
              <div className="form-group"><label>Grado siguiente (a dónde pasa un alumno que aprueba aquí)</label>
                <select value={gradoSiguienteForm} onChange={(e) => setGradoSiguienteForm(e.target.value)}>
                  <option value="">Ninguno — es el último (egresa al aprobar)</option>
                  {allGrados.filter((g: any) => g.id !== modalGrado.editar.id).map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre} — {NIVEL_LABEL[g.nivel.tipo]}{g.carrera ? ` (${g.carrera.nombre})` : ""}
                    </option>
                  ))}
                </select>
                <div className="form-hint">Usado por "Promoción de fin de año" para mover automáticamente a los alumnos aprobados. Puede apuntar a un grado de otro nivel (ej. 6to Primaria → 1ro Secundaria).</div>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalGrado(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarGrado} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {modalSeccion && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalSeccion(null)}>
          <div className="modal">
            <h2><IconLayers size={20} /> {esSuperior ? "Nuevo periodo de ingreso" : "Nueva sección"} — {anoActivo?.anio}</h2>
            {error && <div className="alert-error">{error}</div>}
            {esSuperior ? (
              <div className="form-group"><label>Periodo</label>
                <select value={periodoForm} onChange={(e) => setPeriodoForm(e.target.value)}>
                  <option value="I">I</option>
                  <option value="II">II</option>
                </select></div>
            ) : (
              <div className="form-group"><label>Nombre de la sección</label>
                <input value={nombreSeccionForm} onChange={(e) => setNombreSeccionForm(e.target.value.toUpperCase())} placeholder="Ej: A" maxLength={3} /></div>
            )}
            {esSuperior && <div className="form-hint" style={{ marginBottom: 14 }}>Se creará el código "{anoActivo?.anio}-{periodoForm}"</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalSeccion(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={crearSeccion} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
