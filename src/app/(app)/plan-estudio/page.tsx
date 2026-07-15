"use client";
import { useEffect, useState } from "react";
import { NIVEL_LABEL } from "@/lib/utils";
import { IconBook, IconPlus, IconEdit, IconTrash, IconLoader, IconCheck } from "@/components/icons";

export default function PlanEstudioPage() {
  const [grados, setGrados] = useState<any[]>([]);
  const [materias, setMaterias] = useState<any[]>([]);
  const [planes, setPlanes] = useState<any[]>([]);
  const [gradoSel, setGradoSel] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "new" | any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadBase = async () => {
    setLoading(true);
    const [resG, resM] = await Promise.all([fetch("/api/grados"), fetch("/api/materias")]);
    const gradosData = await resG.json();
    setGrados(gradosData);
    setMaterias(await resM.json());
    if (!gradoSel && gradosData.length > 0) setGradoSel(gradosData[0].id);
    setLoading(false);
  };

  const loadPlanes = async (gid: string) => {
    if (!gid) return;
    const res = await fetch(`/api/plan-estudio?gradoId=${gid}`);
    setPlanes(await res.json());
  };

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (gradoSel) loadPlanes(gradoSel); }, [gradoSel]);

  const gradoActual = grados.find((g: any) => g.id === gradoSel);
  const materiasNoEnPlan = materias.filter((m: any) => !planes.find((p: any) => p.materia.id === m.id));

  const openNew = () => {
    setForm({ materiaId: "", horasSemanales: 4, orden: planes.length + 1, obligatoria: true, observaciones: "" });
    setError(""); setModal("new");
  };
  const openEdit = (p: any) => {
    setForm({ id: p.id, horasSemanales: p.horasSemanales, orden: p.orden, obligatoria: p.obligatoria, observaciones: p.observaciones || "" });
    setError(""); setModal(p);
  };
  const close = () => setModal(null);

  const save = async () => {
    if (modal === "new" && !form.materiaId) { setError("Selecciona una materia"); return; }
    setSaving(true); setError("");
    const method = modal === "new" ? "POST" : "PUT";
    const body = modal === "new" ? { ...form, gradoId: gradoSel } : form;
    const res = await fetch("/api/plan-estudio", { method, body: JSON.stringify(body) });
    if (!res.ok) { setError((await res.json()).error); setSaving(false); return; }
    setSaving(false); close(); loadPlanes(gradoSel);
  };

  const remove = async (id: string) => {
    if (!confirm("¿Quitar esta materia del plan de estudios de este grado?")) return;
    const res = await fetch("/api/plan-estudio", { method: "DELETE", body: JSON.stringify({ id }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    loadPlanes(gradoSel);
  };

  return (
    <div>
      <div className="page-header">
        <h1><IconBook size={24} /> Plan de Estudios</h1>
        <p>Define qué materias corresponden a cada Grado, con horas semanales y orden</p>
      </div>

      <div className="form-group" style={{ maxWidth: 360, marginBottom: 20 }}>
        <label>Selecciona un Grado</label>
        <select value={gradoSel} onChange={(e) => setGradoSel(e.target.value)}>
          {grados.map((g: any) => (
            <option key={g.id} value={g.id}>{g.nombre} — {NIVEL_LABEL[g.nivel.tipo]}</option>
          ))}
        </select>
      </div>

      <div className="toolbar">
        <div style={{ flex: 1 }}>
          {gradoActual && (
            <span className="muted-label" style={{ marginBottom: 0 }}>
              {planes.length} materia(s) en el plan de {gradoActual.nombre}
            </span>
          )}
        </div>
        <button className="btn btn-primary" onClick={openNew} disabled={!gradoSel || materiasNoEnPlan.length === 0}>
          <IconPlus size={16} /> Agregar materia
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Orden</th><th>Materia</th><th>Área</th><th>Horas / sem.</th><th>Obligatoria</th><th>Acciones</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6}><div className="empty"><IconLoader size={24} /></div></td></tr>}
            {!loading && planes.length === 0 && (
              <tr><td colSpan={6}><div className="empty"><IconBook size={32} style={{ color: "var(--muted)" }} /><p>Sin materias en este plan todavía</p></div></td></tr>
            )}
            {planes.map((p: any) => (
              <tr key={p.id}>
                <td style={{ color: "var(--muted)", textAlign: "center" }}>{p.orden}</td>
                <td style={{ fontWeight: 500 }}>{p.materia.nombre}</td>
                <td style={{ color: "var(--muted)" }}>{p.materia.area || "—"}</td>
                <td style={{ color: "var(--muted)", textAlign: "center" }}>{p.horasSemanales}h</td>
                <td>{p.obligatoria ? <IconCheck size={16} style={{ color: "var(--green)" }} /> : <span style={{ color: "var(--muted)" }}>No</span>}</td>
                <td style={{ display: "flex", gap: 6 }}>
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
          <div className="modal">
            <h2><IconBook size={20} /> {modal === "new" ? "Agregar materia al plan" : `Editar: ${modal.materia?.nombre}`}</h2>
            {error && <div className="alert-error">{error}</div>}
            {modal === "new" && (
              <div className="form-group"><label>Materia</label>
                <select value={form.materiaId || ""} onChange={(e) => setForm({ ...form, materiaId: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {materiasNoEnPlan.map((m: any) => <option key={m.id} value={m.id}>{m.nombre}{m.area ? ` (${m.area})` : ""}</option>)}
                </select>
                {materiasNoEnPlan.length === 0 && <div className="form-hint">Todas las materias ya están en el plan de este grado</div>}
              </div>
            )}
            <div className="form-row">
              <div className="form-group"><label>Horas semanales</label>
                <input type="number" min={0} max={40} value={form.horasSemanales} onChange={(e) => setForm({ ...form, horasSemanales: e.target.value })} /></div>
              <div className="form-group"><label>Orden en grilla</label>
                <input type="number" min={1} value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value })} /></div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 16, fontSize: ".85rem" }}>
              <input type="checkbox" checked={form.obligatoria} onChange={(e) => setForm({ ...form, obligatoria: e.target.checked })} />
              Materia obligatoria
            </label>
            <div className="form-group"><label>Observaciones (opcional)</label>
              <textarea rows={2} value={form.observaciones || ""} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
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
