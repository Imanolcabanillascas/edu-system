"use client";
import { useEffect, useState } from "react";
import { estadoColor, formatDate, NIVEL_LABEL } from "@/lib/utils";
import { IconCard, IconSearch, IconPlus, IconLoader, IconCheck, IconEdit, IconTrash, IconAlert } from "@/components/icons";
import { useToast } from "@/components/Toast";

const MEDIOS_PAGO = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "YAPE", "PLIN", "OTRO"];
const ESTADOS_MATRICULA = ["PENDIENTE", "PAGADO", "VENCIDO"];

export default function MatriculasPage() {
  const { toast } = useToast();
  const [matriculas, setMatriculas] = useState<any[]>([]);
  const [anos, setAnos] = useState<any[]>([]);
  const [niveles, setNiveles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroAno, setFiltroAno] = useState("");
  const [modal, setModal] = useState<null | "new" | "edit" | "arancel">(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [form, setForm] = useState<any>({});
  const [nivelSel, setNivelSel] = useState("");
  const [gradoSel, setGradoSel] = useState("");
  const [dniSearch, setDniSearch] = useState("");
  const [alumnoEncontrado, setAlumnoEncontrado] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rol, setRol] = useState<string | null>(null);

  // Arancel global
  const [arancelForm, setArancelForm] = useState({ monto: "", fechaVencimiento: "", soloSinPagar: true });

  const load = async () => {
    setLoading(true);
    const [resM, resU] = await Promise.all([fetch("/api/matriculas"), fetch("/api/usuarios/me")]);
    setMatriculas(await resM.json());
    setRol((await resU.json())?.rol ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    fetch("/api/anos-lectivos").then((r) => r.json()).then((data) => {
      setAnos(data);
      const activo = data.find((a: any) => a.activo);
      if (activo) setFiltroAno(activo.id);
    });
    fetch("/api/niveles").then((r) => r.json()).then(setNiveles);
  }, []);

  const isAdmin = rol === "ADMIN";

  const filtered = matriculas.filter((m) => {
    const matchSearch = !search || m.alumno.usuario.nombre.toLowerCase().includes(search.toLowerCase()) || m.alumno.dni.includes(search);
    const matchEstado = !filtroEstado || m.estado === filtroEstado;
    const matchAno = !filtroAno || m.anoLectivoId === filtroAno;
    return matchSearch && matchEstado && matchAno;
  });

  const nivelObj = niveles.find((n: any) => n.tipo === nivelSel);
  const gradosDisponibles = nivelObj?.grados ?? [];
  const gradoObj = gradosDisponibles.find((g: any) => g.id === gradoSel);
  const seccionesDisponibles = gradoObj?.secciones ?? [];

  const toggleSeleccion = (id: string) =>
    setSeleccionados((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleTodos = () =>
    setSeleccionados(seleccionados.length === filtered.length && filtered.length > 0 ? [] : filtered.map((m) => m.id));

  const buscarAlumno = async () => {
    if (!dniSearch || dniSearch.length !== 8) { setError("Ingresa un DNI válido de 8 dígitos"); return; }
    setError("");
    const res = await fetch(`/api/alumnos?search=${dniSearch}&all=true`);
    const data = await res.json();
    const alumno = Array.isArray(data) ? data[0] : null;
    if (!alumno) { setError("No se encontró ningún alumno con ese DNI"); return; }
    setAlumnoEncontrado(alumno);
    setForm((prev: any) => ({ ...prev, alumnoId: alumno.id }));
  };

  const openNew = () => {
    const anoActivo = anos.find((a: any) => a.activo);
    // Toma el monto del arancel del año activo si hay matriculas existentes
    const montoReferencia = matriculas.find((m) => m.anoLectivoId === anoActivo?.id)?.monto ?? "";
    setForm({ alumnoId: "", anoLectivoId: anoActivo?.id ?? "", seccionId: "", monto: montoReferencia, fechaVencimiento: "", observaciones: "", marcarPagada: false, medioPago: "EFECTIVO" });
    setNivelSel(""); setGradoSel(""); setDniSearch(""); setAlumnoEncontrado(null);
    setError(""); setModal("new");
  };

  const openEdit = (m: any) => {
    setForm({ id: m.id, estado: m.estado, medioPago: m.medioPago ?? "EFECTIVO", observaciones: m.observaciones ?? "" });
    setError(""); setModal("edit");
  };

  const openArancel = () => {
    // Sugiere el monto actual más común en las matrículas del año filtrado
    const montosMasUsados = filtered.map((m) => m.monto);
    const montoSugerido = montosMasUsados.length > 0 ? Math.max(...montosMasUsados) : "";
    setArancelForm({ monto: String(montoSugerido || ""), fechaVencimiento: "", soloSinPagar: true });
    setError(""); setModal("arancel");
  };

  const close = () => { setModal(null); setError(""); };

  const saveNew = async () => {
    if (!form.alumnoId || !form.anoLectivoId || !form.monto || !form.fechaVencimiento) {
      setError("Completa alumno, año lectivo, monto y fecha de vencimiento"); return;
    }
    setSaving(true); setError("");
    const res = await fetch("/api/matriculas", { method: "POST", body: JSON.stringify(form) });
    if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    setSaving(false); close(); toast("Matrícula registrada"); load();
  };

  const saveEdit = async () => {
    setSaving(true); setError("");
    const res = await fetch("/api/matriculas", { method: "PATCH", body: JSON.stringify(form) });
    if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    setSaving(false); close(); toast("Matrícula actualizada"); load();
  };

  // Aplicar arancel global a todas las matrículas del año filtrado
  const saveArancel = async () => {
    if (!arancelForm.monto || !arancelForm.fechaVencimiento) {
      setError("Completa el monto y la fecha de vencimiento"); return;
    }
    const objetivo = arancelForm.soloSinPagar
      ? filtered.filter((m) => m.estado !== "PAGADO")
      : filtered;
    if (objetivo.length === 0) { setError("No hay matrículas que actualizar con ese filtro"); return; }
    if (!confirm(`¿Aplicar S/. ${arancelForm.monto} a ${objetivo.length} matrícula(s)? Esta acción actualizará el monto de todas.`)) return;
    setSaving(true); setError("");
    await Promise.all(
      objetivo.map((m) =>
        fetch("/api/matriculas", {
          method: "PATCH",
          body: JSON.stringify({ id: m.id, monto: Number(arancelForm.monto), fechaVencimiento: arancelForm.fechaVencimiento }),
        })
      )
    );
    setSaving(false); close();
    toast(`Arancel aplicado a ${objetivo.length} matrícula(s)`); load();
  };

  const accionMasiva = async (estado: string) => {
    if (!seleccionados.length) return;
    if (!confirm(`¿Marcar ${seleccionados.length} matrícula(s) como ${estado}?`)) return;
    await Promise.all(seleccionados.map((id) =>
      fetch("/api/matriculas", { method: "PATCH", body: JSON.stringify({ id, estado }) })
    ));
    setSeleccionados([]); toast(`${seleccionados.length} matrícula(s) actualizadas`); load();
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta matrícula?")) return;
    await fetch("/api/matriculas", { method: "DELETE", body: JSON.stringify({ id }) });
    toast("Matrícula eliminada", "info"); load();
  };

  const totalPagadas = filtered.filter((m) => m.estado === "PAGADO").length;
  const totalPendientes = filtered.filter((m) => m.estado === "PENDIENTE").length;
  const totalVencidas = filtered.filter((m) => m.estado === "VENCIDO").length;

  return (
    <div>
      <div className="page-header">
        <h1><IconCard size={26} /> Matrículas</h1>
        <p>{isAdmin ? "Gestiona pagos y secciones de alumnos" : "Tu matrícula del año lectivo actual"}</p>
      </div>

      {isAdmin && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
          {[["Pagadas", totalPagadas, "var(--green)"], ["Pendientes", totalPendientes, "var(--accent)"], ["Vencidas", totalVencidas, "var(--danger)"]].map(([l, v, c]) => (
            <div key={String(l)} className="stat-card">
              <div className="stat-card-icon" style={{ background: `${c}18` }}><IconCard size={20} style={{ color: String(c) }} /></div>
              <div><div className="stat-card-value">{v}</div><div className="stat-card-label">{l}</div></div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
            <IconSearch size={16} className="search-icon" />
            <input className="search-input" placeholder="Buscar por nombre o DNI…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} style={{ minWidth: 130 }}>
            <option value="">Todos los años</option>
            {anos.map((a: any) => <option key={a.id} value={a.id}>{a.anio}{a.activo ? " ★" : ""}</option>)}
          </select>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ minWidth: 130 }}>
            <option value="">Todos los estados</option>
            {ESTADOS_MATRICULA.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          {/* Botón arancel global destacado */}
          <button className="btn btn-ghost" onClick={openArancel} style={{ borderColor: "var(--accent2)", color: "var(--accent2)" }}>
            <span style={{ fontWeight: 700 }}>S/</span> Arancel global
          </button>
          <button className="btn btn-primary" onClick={openNew}><IconPlus size={16} /> Nueva</button>
        </div>
      )}

      {isAdmin && seleccionados.length > 0 && (
        <div style={{ background: "var(--accent2)15", border: "1.5px solid var(--accent2)44", borderRadius: 10, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: ".875rem", color: "var(--accent2)" }}>{seleccionados.length} seleccionada(s)</span>
          <button className="btn btn-ghost btn-sm" onClick={() => accionMasiva("PAGADO")}>✓ Marcar pagadas</button>
          <button className="btn btn-ghost btn-sm" onClick={() => accionMasiva("PENDIENTE")}>Marcar pendientes</button>
          <button className="btn btn-danger btn-sm" onClick={() => accionMasiva("VENCIDO")}>Marcar vencidas</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSeleccionados([])}>Cancelar</button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {isAdmin && <th><input type="checkbox" checked={seleccionados.length === filtered.length && filtered.length > 0} onChange={toggleTodos} /></th>}
              <th>Alumno</th><th>Año</th><th>Sección</th><th>Monto</th><th>Vencimiento</th><th>Estado</th>
              {isAdmin && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: isAdmin ? 8 : 6 }).map((_, j) => <td key={j}><div className="skeleton skeleton-text" style={{ width: "80%" }} /></td>)}</tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={isAdmin ? 8 : 6}>
                <div className="empty">
                  <IconCard size={36} style={{ color: "var(--border)" }} />
                  <p>{search ? `Sin resultados para "${search}"` : "No hay matrículas registradas"}</p>
                  {isAdmin && !search && <button className="btn btn-primary btn-sm" onClick={openNew}><IconPlus size={14} /> Crear primera matrícula</button>}
                </div>
              </td></tr>
            )}
            {!loading && filtered.map((m) => (
              <tr key={m.id} style={{ background: seleccionados.includes(m.id) ? "var(--accent2)08" : undefined }}>
                {isAdmin && <td><input type="checkbox" checked={seleccionados.includes(m.id)} onChange={() => toggleSeleccion(m.id)} /></td>}
                <td>
                  <div style={{ fontWeight: 500 }}>{m.alumno.usuario.nombre}</div>
                  <div style={{ fontSize: ".75rem", color: "var(--muted)" }}>DNI: {m.alumno.dni}</div>
                </td>
                <td style={{ color: "var(--muted)" }}>{m.anoLectivo.anio}</td>
                <td style={{ color: "var(--muted)", fontSize: ".82rem" }}>{m.seccion ? `${m.seccion.grado.nombre} "${m.seccion.nombre}"` : "—"}</td>
                <td style={{ fontWeight: 600 }}>S/. {Number(m.monto).toFixed(2)}</td>
                <td style={{ color: m.estado === "VENCIDO" ? "var(--danger)" : "var(--muted)", fontSize: ".82rem" }}>
                  {m.fechaVencimiento ? formatDate(m.fechaVencimiento) : "—"}
                  {m.estado === "PAGADO" && m.fechaPago && <div style={{ color: "var(--green)", fontSize: ".7rem" }}>Pagado: {formatDate(m.fechaPago)}</div>}
                </td>
                <td>
                  <span className="badge" style={{ background: estadoColor(m.estado) + "22", color: estadoColor(m.estado) }}>{m.estado}</span>
                  {m.medioPago && <div style={{ fontSize: ".7rem", color: "var(--muted)", marginTop: 2 }}>{m.medioPago}</div>}
                </td>
                {isAdmin && (
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Editar estado" onClick={() => openEdit(m)}><IconEdit size={15} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Descargar recibo PDF" onClick={() => { const a = document.createElement("a"); a.href = `/api/matriculas/recibo?id=${m.id}`; a.click(); }}>
                        <span style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--accent2)" }}>PDF</span>
                      </button>
                      <button className="btn btn-danger btn-icon btn-sm" title="Eliminar" onClick={() => eliminar(m.id)}><IconTrash size={15} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal: Nueva matrícula ─────────────────────────────────────── */}
      {modal === "new" && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal" style={{ maxWidth: 560, maxHeight: "92vh", overflowY: "auto" }}>
            <h2><IconCard size={20} /> Nueva matrícula</h2>
            {error && <div className="alert-error">{error}</div>}

            <div className="form-section-title">Buscar alumno por DNI</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <input value={dniSearch} onChange={(e) => setDniSearch(e.target.value.replace(/\D/g, ""))} maxLength={8}
                  placeholder="DNI del alumno (8 dígitos)" onKeyDown={(e) => e.key === "Enter" && buscarAlumno()} />
              </div>
              <button className="btn btn-ghost" onClick={buscarAlumno}>Buscar</button>
            </div>
            {alumnoEncontrado && (
              <div className="alert-banner" style={{ marginBottom: 16 }}>
                <IconCheck size={16} />
                <div>
                  <div style={{ fontWeight: 600 }}>{alumnoEncontrado.usuario.nombre}</div>
                  <div style={{ fontSize: ".78rem" }}>DNI: {alumnoEncontrado.dni} · {alumnoEncontrado.estado}</div>
                </div>
              </div>
            )}

            <div className="form-section-title">Datos</div>
            <div className="form-group"><label>Año lectivo</label>
              <select value={form.anoLectivoId || ""} onChange={(e) => setForm({ ...form, anoLectivoId: e.target.value })}>
                <option value="">Seleccionar…</option>
                {anos.map((a: any) => <option key={a.id} value={a.id}>{a.anio}{a.activo ? " (activo)" : ""}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Monto (S/.) *</label>
                <input type="number" min={0} step={0.01} value={form.monto || ""} onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="Ej: 500.00" />
              </div>
              <div className="form-group"><label>Fecha de vencimiento *</label>
                <input type="date" value={form.fechaVencimiento || ""} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} />
              </div>
            </div>

            <div className="form-section-title">Sección (opcional)</div>
            <div className="form-row">
              <div className="form-group"><label>Nivel</label>
                <select value={nivelSel} onChange={(e) => { setNivelSel(e.target.value); setGradoSel(""); setForm({ ...form, seccionId: "" }); }}>
                  <option value="">Seleccionar…</option>
                  {niveles.map((n: any) => <option key={n.id} value={n.tipo}>{NIVEL_LABEL[n.tipo]}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Grado</label>
                <select value={gradoSel} disabled={!nivelSel} onChange={(e) => { setGradoSel(e.target.value); setForm({ ...form, seccionId: "" }); }}>
                  <option value="">Seleccionar…</option>
                  {gradosDisponibles.map((g: any) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label>Sección</label>
              <select value={form.seccionId || ""} disabled={!gradoSel} onChange={(e) => setForm({ ...form, seccionId: e.target.value })}>
                <option value="">Sin asignar</option>
                {seccionesDisponibles.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            <div className="form-section-title">Pago</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 14, fontSize: ".875rem" }}>
              <input type="checkbox" checked={form.marcarPagada || false} onChange={(e) => setForm({ ...form, marcarPagada: e.target.checked })} />
              Marcar como pagada ahora
            </label>
            {form.marcarPagada && (
              <div className="form-group"><label>Medio de pago</label>
                <select value={form.medioPago || "EFECTIVO"} onChange={(e) => setForm({ ...form, medioPago: e.target.value })}>
                  {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            <div className="form-group"><label>Observaciones</label>
              <textarea rows={2} value={form.observaciones || ""} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Descuentos, acuerdos especiales…" />
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveNew} disabled={saving || !form.alumnoId}>{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Editar estado ───────────────────────────────────────── */}
      {modal === "edit" && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <h2><IconEdit size={20} /> Editar matrícula</h2>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-group"><label>Estado</label>
              <select value={form.estado || ""} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS_MATRICULA.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            {form.estado === "PAGADO" && (
              <div className="form-group"><label>Medio de pago</label>
                <select value={form.medioPago || "EFECTIVO"} onChange={(e) => setForm({ ...form, medioPago: e.target.value })}>
                  {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            <div className="form-group"><label>Observaciones</label>
              <textarea rows={2} value={form.observaciones || ""} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Arancel global ──────────────────────────────────────── */}
      {modal === "arancel" && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <h2>Arancel de matrícula</h2>
            <p style={{ fontSize: ".85rem", color: "var(--muted)", marginBottom: 20, lineHeight: 1.6 }}>
              Define el monto y fecha de vencimiento que se aplicará a {arancelForm.soloSinPagar ? "todas las matrículas no pagadas" : "todas las matrículas"} del año seleccionado.
            </p>
            {error && <div className="alert-error">{error}</div>}

            <div className="form-group">
              <label>Monto de matrícula (S/.) *</label>
              <input type="number" min={0} step={0.01} value={arancelForm.monto}
                onChange={(e) => setArancelForm({ ...arancelForm, monto: e.target.value })}
                placeholder="Ej: 350.00"
                style={{ fontSize: "1.1rem", fontWeight: 600 }} />
            </div>
            <div className="form-group">
              <label>Fecha de vencimiento *</label>
              <input type="date" value={arancelForm.fechaVencimiento}
                onChange={(e) => setArancelForm({ ...arancelForm, fechaVencimiento: e.target.value })} />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 20, padding: "12px 14px", background: "var(--surface2)", borderRadius: 10, fontSize: ".875rem" }}>
              <input type="checkbox" checked={arancelForm.soloSinPagar}
                onChange={(e) => setArancelForm({ ...arancelForm, soloSinPagar: e.target.checked })} />
              <div>
                <div style={{ fontWeight: 500 }}>Solo matrículas no pagadas</div>
                <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>No modifica las que ya están marcadas como PAGADO</div>
              </div>
            </label>

            {/* Vista previa de afectados */}
            <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: ".82rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Matrículas que se actualizarán:</div>
              <div style={{ color: "var(--muted)" }}>
                {arancelForm.soloSinPagar
                  ? `${filtered.filter((m) => m.estado !== "PAGADO").length} matrícula(s) pendientes o vencidas`
                  : `${filtered.length} matrícula(s) en total`}
                {filtroAno && anos.find((a: any) => a.id === filtroAno) && (
                  <span> · Año {anos.find((a: any) => a.id === filtroAno)?.anio}</span>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveArancel} disabled={saving}>
                {saving ? "Aplicando…" : "Aplicar arancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
