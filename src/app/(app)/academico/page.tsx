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
  const [tab, setTab] = useState<"PRIMARIA" | "SECUNDARIA">("PRIMARIA");
  const [error, setError] = useState("");

  const [editandoNivel, setEditandoNivel] = useState(false);
  const [nombreNivelForm, setNombreNivelForm] = useState("");

  const [modalAno, setModalAno] = useState(false);
  const [nuevoAnoForm, setNuevoAnoForm] = useState(new Date().getFullYear() + 1);
  const [savingAno, setSavingAno] = useState(false);

  const [modalGrado, setModalGrado] = useState<null | { editar?: any }>(null);
  const [nombreGradoForm, setNombreGradoForm] = useState("");
  const [gradoSiguienteForm, setGradoSiguienteForm] = useState("");
  const [modalSeccion, setModalSeccion] = useState<null | { gradoId: string }>(null);
  const [nombreSeccionForm, setNombreSeccionForm] = useState("");
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
  const anoActivo = anos.find((a: any) => a.id === anoSel);

  const guardarNombreNivel = async () => {
    if (!nombreNivelForm.trim() || !nivelActual) return;
    setSaving(true);
    await fetch("/api/niveles", { method: "PUT", body: JSON.stringify({ id: nivelActual.id, nombre: nombreNivelForm }) });
    setSaving(false);
    setEditandoNivel(false);
    loadNiveles(anoSel);
  };

  const abrirNuevoGrado = () => { setNombreGradoForm(""); setGradoSiguienteForm(""); setError(""); setModalGrado({}); };
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
          : { nombre: nombreGradoForm, nivelId: nivelActual.id }
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
    if (!confirm("¿Eliminar este grado? Debe no tener secciones ni materias asociadas.")) return;
    const res = await fetch("/api/grados", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    loadNiveles(anoSel);
  };

  const abrirNuevaSeccion = (gradoId: string) => {
    setNombreSeccionForm(""); setError("");
    setModalSeccion({ gradoId });
  };
  const crearSeccion = async () => {
    if (!modalSeccion || !anoSel || !nombreSeccionForm.trim()) return;
    setSaving(true); setError("");
    const res = await fetch("/api/secciones", { method: "POST", body: JSON.stringify({ nombre: nombreSeccionForm, gradoId: modalSeccion.gradoId, anoLectivoId: anoSel }) });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    setModalSeccion(null);
    loadNiveles(anoSel);
  };

  const eliminarSeccion = async (id: string) => {
    if (!confirm("¿Eliminar esta sección? Debe no tener alumnos ni clases asociadas.")) return;
    const res = await fetch("/api/secciones", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    loadNiveles(anoSel);
  };

  const cambiarTab = (t: "PRIMARIA" | "SECUNDARIA") => {
    setTab(t);
    setEditandoNivel(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1><IconLayers size={26} /> Estructura Académica</h1>
        <p>Define años lectivos, grados y secciones del colegio</p>
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
        {(["PRIMARIA", "SECUNDARIA"] as const).map((t) => {
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
            <button className="btn btn-primary" onClick={abrirNuevoGrado}><IconPlus size={16} /> Nuevo grado</button>
          </div>

          {nivelActual.grados.length === 0 ? (
            <div className="empty" style={{ padding: "30px 20px" }}>
              <p>Sin grados creados</p>
            </div>
          ) : (
            <div className="card-grid">
              {nivelActual.grados.map((g: any) => (
                <div className="info-card" key={g.id}>
                  <div className="info-card-title">
                    {g.nombre}
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => abrirEditarGrado(g)}><IconEdit size={13} /></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => eliminarGrado(g.id)}><IconTrash size={13} /></button>
                    </div>
                  </div>
                  <div className="muted-label" style={{ marginBottom: 10 }}>
                    Secciones — {anoActivo?.anio}
                  </div>
                  {g.gradoSiguiente ? (
                    <div className="form-hint" style={{ marginBottom: 8 }}>→ Siguiente: {g.gradoSiguiente.nombre}</div>
                  ) : (
                    <div className="form-hint" style={{ marginBottom: 8, color: "var(--accent)" }}>Sin grado siguiente — se egresa al aprobar</div>
                  )}
                  <div className="chips">
                    {g.secciones.length === 0 && <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>Sin secciones este año</span>}
                    {g.secciones.map((s: any) => (
                      <span key={s.id} className="chip" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {s.nombre}
                        <button onClick={() => eliminarSeccion(s.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0, display: "flex" }}>
                          <IconTrash size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                  {g.secciones.some((s: any) => s.profesorTutor) && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                      {g.secciones.filter((s: any) => s.profesorTutor).map((s: any) => (
                        <div key={s.id} className="form-hint" style={{ marginBottom: 0 }}>
                          Tutor "{s.nombre}": {s.profesorTutor.usuario.nombre}
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => abrirNuevaSeccion(g.id)}>
                    <IconPlus size={13} /> Agregar sección
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {modalAno && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalAno(false)}>
          <div className="modal">
            <h2><IconCard size={20} /> Nuevo año lectivo</h2>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-group"><label>Año</label>
              <input type="number" value={nuevoAnoForm} onChange={(e) => setNuevoAnoForm(Number(e.target.value))} /></div>
            <div className="form-hint" style={{ marginBottom: 14 }}>
              Se marcará como año activo automáticamente. Si es el primer año lectivo del sistema, también se crearán automáticamente los grados de 1ro a 6to de Primaria y de 1ro a 5to de Secundaria, ya enlazados en secuencia.
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalAno(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={crearAno} disabled={savingAno}>{savingAno ? "Creando…" : "Crear año"}</button>
            </div>
          </div>
        </div>
      )}

      {modalGrado && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalGrado(null)}>
          <div className="modal">
            <h2><IconLayers size={20} /> {modalGrado.editar ? "Editar" : "Nuevo"} grado</h2>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-group"><label>Nombre del grado</label>
              <input value={nombreGradoForm} onChange={(e) => setNombreGradoForm(e.target.value)} placeholder="Ej: 1er Grado" /></div>
            {modalGrado.editar && (
              <div className="form-group"><label>Grado siguiente (a dónde pasa un alumno que aprueba aquí)</label>
                <select value={gradoSiguienteForm} onChange={(e) => setGradoSiguienteForm(e.target.value)}>
                  <option value="">Ninguno — es el último (egresa al aprobar)</option>
                  {allGrados.filter((g: any) => g.id !== modalGrado.editar.id).map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre} — {NIVEL_LABEL[g.nivel.tipo]}
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
            <h2><IconLayers size={20} /> Nueva sección — {anoActivo?.anio}</h2>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-group"><label>Nombre de la sección</label>
              <input value={nombreSeccionForm} onChange={(e) => setNombreSeccionForm(e.target.value.toUpperCase())} placeholder="Ej: A" maxLength={3} /></div>
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
