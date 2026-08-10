"use client";
import { useEffect, useState } from "react";
import { IconClock, IconPlus, IconEdit, IconTrash, IconLoader, IconCheck } from "@/components/icons";
import { useToast } from "@/components/Toast";

function fmt(d: string) { return d ? new Date(d).toLocaleDateString("es-PE") : "—"; }

export default function PeriodosPage() {
  const { toast } = useToast();
  const [anos, setAnos] = useState<any[]>([]);
  const [anoSel, setAnoSel] = useState("");
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<null | "new" | any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadPeriodos = (id: string) => { setLoading(true); fetch(`/api/periodos?anoLectivoId=${id}`).then((r) => r.json()).then((d) => { setPeriodos(d); setLoading(false); }); };

  useEffect(() => {
    fetch("/api/anos-lectivos").then((r) => r.json()).then((data) => {
      setAnos(data);
      const activo = data.find((a: any) => a.activo);
      if (activo) { setAnoSel(activo.id); loadPeriodos(activo.id); }
    });
  }, []);

  const openNew = () => { setForm({ nombre: "", tipo: "BIMESTRE", orden: periodos.length + 1, fechaInicio: "", fechaFin: "", activo: false }); setError(""); setModal("new"); };
  const openEdit = (p: any) => { setForm({ id: p.id, nombre: p.nombre, tipo: p.tipo, orden: p.orden, fechaInicio: p.fechaInicio?.slice(0, 10), fechaFin: p.fechaFin?.slice(0, 10), activo: p.activo }); setError(""); setModal(p); };
  const close = () => setModal(null);

  const save = async () => {
    if (!form.nombre?.trim() || !form.fechaInicio || !form.fechaFin) { setError("Completa todos los campos"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/periodos", { method: modal === "new" ? "POST" : "PUT", body: JSON.stringify(modal === "new" ? { ...form, anoLectivoId: anoSel } : form) });
    if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    setSaving(false); close(); toast(modal === "new" ? "Período creado" : "Período actualizado"); loadPeriodos(anoSel);
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este período?")) return;
    const res = await fetch("/api/periodos", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) { toast((await res.json()).error, "error"); return; }
    toast("Período eliminado", "info"); loadPeriodos(anoSel);
  };

  return (
    <div>
      <div className="page-header"><h1><IconClock size={24} /> Períodos Académicos</h1><p>Define los bimestres o trimestres del año lectivo</p></div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 220 }}>
          <label>Año lectivo</label>
          <select value={anoSel} onChange={(e) => { setAnoSel(e.target.value); loadPeriodos(e.target.value); }}>
            {anos.map((a: any) => <option key={a.id} value={a.id}>{a.anio}{a.activo ? " (activo)" : ""}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={openNew} disabled={!anoSel}><IconPlus size={16} /> Nuevo período</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Período</th><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6}><div className="empty"><IconLoader size={24} /></div></td></tr>}
            {!loading && periodos.length === 0 && (
              <tr><td colSpan={6}><div className="empty"><IconClock size={32} style={{ color: "var(--muted)" }} /><p>Sin períodos — crea el primer bimestre</p>
                <button className="btn btn-primary btn-sm" onClick={openNew}><IconPlus size={14} /> Crear bimestre 1</button>
              </div></td></tr>
            )}
            {periodos.map((p: any) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                <td><span className="badge" style={{ background: "var(--accent2)22", color: "var(--accent2)" }}>{p.tipo}</span></td>
                <td style={{ color: "var(--muted)" }}>{fmt(p.fechaInicio)}</td>
                <td style={{ color: "var(--muted)" }}>{fmt(p.fechaFin)}</td>
                <td>{p.activo ? <span className="badge" style={{ background: "var(--green)22", color: "var(--green)" }}><IconCheck size={12} /> Activo</span> : <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>Inactivo</span>}</td>
                <td style={{ display: "flex", gap: 4 }}>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(p)}><IconEdit size={15} /></button>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => remove(p.id)}><IconTrash size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <h2><IconClock size={20} /> {modal === "new" ? "Nuevo período" : "Editar período"}</h2>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-group"><label>Nombre</label><input value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Bimestre 1" /></div>
            <div className="form-row">
              <div className="form-group"><label>Tipo</label>
                <select value={form.tipo || "BIMESTRE"} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                  <option value="BIMESTRE">Bimestre</option><option value="TRIMESTRE">Trimestre</option>
                </select></div>
              <div className="form-group"><label>Orden</label><input type="number" min={1} max={6} value={form.orden || 1} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Fecha inicio</label><input type="date" value={form.fechaInicio || ""} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} /></div>
              <div className="form-group"><label>Fecha fin</label><input type="date" value={form.fechaFin || ""} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} /></div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 20, fontSize: ".875rem" }}>
              <input type="checkbox" checked={form.activo || false} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Período activo
            </label>
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
