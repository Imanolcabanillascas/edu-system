"use client";
import { useEffect, useState } from "react";
import { formatDate, initials, avatarColor, estadoColor, MEDIOS_PAGO } from "@/lib/utils";
import { IconCard, IconSearch, IconPlus, IconTrash, IconLoader, IconAlert, IconIdCard } from "@/components/icons";

export default function MatriculasPage() {
  const [matriculas, setMatriculas] = useState<any[]>([]);
  const [rol, setRol] = useState("ALUMNO");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [soloVencidas, setSoloVencidas] = useState(false);

  const [modal, setModal] = useState<null | "new">(null);
  const [dniBuscado, setDniBuscado] = useState("");
  const [alumnoEncontrado, setAlumnoEncontrado] = useState<any | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [busquedaError, setBusquedaError] = useState("");
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const [payModal, setPayModal] = useState<any>(null);
  const [medioPago, setMedioPago] = useState("EFECTIVO");

  const load = async () => {
    setLoading(true);
    const [resM, resU] = await Promise.all([fetch("/api/matriculas"), fetch("/api/usuarios/me")]);
    setMatriculas(await resM.json());
    const usuario = await resU.json();
    setRol(usuario?.rol ?? "ALUMNO");
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const isAdmin = rol === "ADMIN";

  const filtered = matriculas
    .filter((m) => m.alumno?.usuario?.nombre?.toLowerCase().includes(search.toLowerCase()) || m.alumno?.dni?.includes(search))
    .filter((m) => !soloVencidas || m.estado === "VENCIDO");

  const vencidasCount = matriculas.filter((m) => m.estado === "VENCIDO").length;

  const openNew = () => {
    setDniBuscado(""); setAlumnoEncontrado(null); setBusquedaError("");
    setForm({ anoLectivo: "2025-2026", monto: "", fechaVencimiento: "", observaciones: "", marcarPagada: false, medioPago: "EFECTIVO" });
    setModal("new");
  };
  const close = () => setModal(null);

  const buscarPorDni = async () => {
    if (dniBuscado.length !== 8) { setBusquedaError("Ingresa un DNI de 8 dígitos"); return; }
    setBuscando(true); setBusquedaError("");
    const res = await fetch(`/api/alumnos/buscar?dni=${dniBuscado}`);
    const data = await res.json();
    setBuscando(false);
    if (!data) { setBusquedaError("No se encontró ningún alumno con ese DNI"); setAlumnoEncontrado(null); return; }
    setAlumnoEncontrado(data);
  };

  const save = async () => {
    if (!alumnoEncontrado || !form.monto || !form.fechaVencimiento) return;
    setSaving(true);
    await fetch("/api/matriculas", { method: "POST", body: JSON.stringify({ ...form, alumnoId: alumnoEncontrado.id }) });
    setSaving(false);
    close();
    load();
  };

  const openPago = (m: any) => { setMedioPago("EFECTIVO"); setPayModal(m); };
  const confirmarPago = async (estado: string) => {
    await fetch("/api/matriculas", { method: "PATCH", body: JSON.stringify({ id: payModal.id, estado, medioPago: estado === "PAGADO" ? medioPago : null }) });
    setPayModal(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este registro de matrícula?")) return;
    await fetch("/api/matriculas", { method: "DELETE", body: JSON.stringify({ id }) });
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1>{isAdmin ? "Matrículas" : "Mi Matrícula"}</h1>
        <p>{isAdmin ? "Registra el estado de pago de cada alumno (hora de Perú)" : "Consulta el estado de tu matrícula"}</p>
      </div>

      {isAdmin && vencidasCount > 0 && (
        <button className={`alert-banner ${soloVencidas ? "alert-banner-active" : ""}`} onClick={() => setSoloVencidas(!soloVencidas)}>
          <IconAlert size={16} />
          {vencidasCount} {vencidasCount === 1 ? "matrícula vencida" : "matrículas vencidas"} — clic para {soloVencidas ? "ver todas" : "filtrar"}
        </button>
      )}

      {isAdmin && (
        <div className="toolbar">
          <div className="search-wrap">
            <IconSearch size={16} className="search-icon" />
            <input className="search-input" placeholder="Buscar por nombre o DNI…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={openNew}><IconPlus size={16} /> Registrar matrícula</button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Alumno</th><th>DNI</th><th>Año lectivo</th><th>Monto</th><th>Vencimiento</th><th>Medio de pago</th><th>Estado</th>{isAdmin && <th>Acciones</th>}</tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8}><div className="empty"><IconLoader size={24} /></div></td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8}><div className="empty"><IconCard size={32} style={{ color: "var(--muted)" }} /><p>No hay registros de matrícula</p></div></td></tr>
            )}
            {filtered.map((m) => (
              <tr key={m.id}>
                <td style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="avatar" style={{ background: avatarColor(m.alumno.usuario.nombre) + "33", color: avatarColor(m.alumno.usuario.nombre) }}>
                    {initials(m.alumno.usuario.nombre)}
                  </div>
                  {m.alumno.usuario.nombre}
                </td>
                <td style={{ color: "var(--muted)", fontFamily: "monospace" }}>{m.alumno.dni}</td>
                <td style={{ color: "var(--muted)" }}>{m.anoLectivo}</td>
                <td style={{ color: "var(--muted)" }}>S/ {m.monto.toFixed(2)}</td>
                <td style={{ color: "var(--muted)" }}>{formatDate(m.fechaVencimiento)}</td>
                <td style={{ color: "var(--muted)" }}>{m.medioPago ? MEDIOS_PAGO.find((mp) => mp.value === m.medioPago)?.label : "—"}</td>
                <td><span className="badge" style={{ background: estadoColor(m.estado) + "22", color: estadoColor(m.estado) }}>{m.estado}</span></td>
                {isAdmin && (
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openPago(m)}>Actualizar</button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => remove(m.id)}><IconTrash size={14} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: registrar matrícula con búsqueda por DNI */}
      {modal && isAdmin && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal">
            <h2><IconCard size={20} /> Registrar matrícula</h2>

            <div className="form-group">
              <label>Buscar alumno por DNI</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={dniBuscado} maxLength={8} onChange={(e) => setDniBuscado(e.target.value.replace(/\D/g, ""))} placeholder="8 dígitos" style={{ flex: 1 }} />
                <button className="btn btn-ghost" onClick={buscarPorDni} disabled={buscando}>
                  {buscando ? <IconLoader size={15} /> : <IconSearch size={15} />}
                </button>
              </div>
              {busquedaError && <div className="alert-error" style={{ marginTop: 8 }}>{busquedaError}</div>}
            </div>

            {alumnoEncontrado && (
              <div className="found-card">
                <div className="avatar" style={{ background: avatarColor(alumnoEncontrado.usuario.nombre) + "33", color: avatarColor(alumnoEncontrado.usuario.nombre) }}>
                  {initials(alumnoEncontrado.usuario.nombre)}
                </div>
                <div>
                  <div style={{ fontWeight: 500 }}>{alumnoEncontrado.usuario.nombre}</div>
                  <div className="muted-label">
                    DNI {alumnoEncontrado.dni}
                    {alumnoEncontrado.seccion && <> · {alumnoEncontrado.seccion.grado.nombre} "{alumnoEncontrado.seccion.nombre}"</>}
                  </div>
                </div>
              </div>
            )}

            {alumnoEncontrado && (
              <>
                <div className="form-row">
                  <div className="form-group"><label>Año lectivo</label>
                    <input value={form.anoLectivo || ""} onChange={(e) => setForm({ ...form, anoLectivo: e.target.value })} placeholder="2025-2026" /></div>
                  <div className="form-group"><label>Monto (S/)</label>
                    <input type="number" value={form.monto || ""} onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="350.00" /></div>
                </div>
                <div className="form-group"><label>Fecha de vencimiento</label>
                  <input type="date" value={form.fechaVencimiento || ""} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} /></div>

                <div className="form-group">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textTransform: "none" }}>
                    <input type="checkbox" checked={form.marcarPagada || false} onChange={(e) => setForm({ ...form, marcarPagada: e.target.checked })} />
                    Ya fue pagada
                  </label>
                </div>

                {form.marcarPagada && (
                  <div className="form-group"><label>Medio de pago</label>
                    <select value={form.medioPago || "EFECTIVO"} onChange={(e) => setForm({ ...form, medioPago: e.target.value })}>
                      {MEDIOS_PAGO.map((mp) => <option key={mp.value} value={mp.value}>{mp.label}</option>)}
                    </select></div>
                )}

                <div className="form-group"><label>Observaciones</label>
                  <textarea rows={2} value={form.observaciones || ""} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Notas adicionales…" /></div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !alumnoEncontrado}>{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: actualizar estado de pago */}
      {payModal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setPayModal(null)}>
          <div className="modal">
            <h2><IconIdCard size={20} /> {payModal.alumno.usuario.nombre}</h2>
            <p style={{ color: "var(--muted)", marginBottom: 20, fontSize: ".9rem" }}>
              Monto: S/ {payModal.monto.toFixed(2)} · Vence: {formatDate(payModal.fechaVencimiento)}
            </p>

            <div className="form-group"><label>Medio de pago (si se marca como Pagado)</label>
              <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
                {MEDIOS_PAGO.map((mp) => <option key={mp.value} value={mp.value}>{mp.label}</option>)}
              </select></div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              <button className="btn" style={{ background: "var(--green)22", color: "var(--green)" }} onClick={() => confirmarPago("PAGADO")}>Marcar como Pagado</button>
              <button className="btn" style={{ background: "var(--accent)22", color: "var(--accent)" }} onClick={() => confirmarPago("PENDIENTE")}>Marcar como Pendiente</button>
              <button className="btn" style={{ background: "var(--danger)22", color: "var(--danger)" }} onClick={() => confirmarPago("VENCIDO")}>Marcar como Vencido</button>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setPayModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
