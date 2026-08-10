"use client";
import { useEffect, useState } from "react";
import { IconCheck, IconX, IconClock, IconAlert, IconLoader, IconStudent, IconClass } from "@/components/icons";
import { useToast } from "@/components/Toast";

const ESTADOS = [
  { valor: "PRESENTE", label: "Presente", color: "var(--green)", icon: IconCheck },
  { valor: "AUSENTE", label: "Ausente", color: "var(--danger)", icon: IconX },
  { valor: "TARDANZA", label: "Tardanza", color: "var(--accent)", icon: IconClock },
  { valor: "JUSTIFICADO", label: "Justificado", color: "var(--accent2)", icon: IconAlert },
];

export default function AsistenciaPage() {
  const { toast } = useToast();
  const [clases, setClases] = useState<any[]>([]);
  const [claseId, setClaseId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [asistencias, setAsistencias] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [rol, setRol] = useState<string | null>(null);
  const [alumnoId, setAlumnoId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/clases").then((r) => r.json()),
      fetch("/api/usuarios/me").then((r) => r.json()),
    ]).then(([clasesData, usuario]) => {
      setClases(clasesData);
      setRol(usuario?.rol ?? null);
      setAlumnoId(usuario?.alumnoId ?? null);
    });
  }, []);

  useEffect(() => {
    if (!claseId || !fecha || rol === "ALUMNO") return;
    setLoading(true);
    fetch(`/api/asistencia?claseId=${claseId}&fecha=${fecha}`)
      .then((r) => r.json())
      .then((data) => {
        const als = data.alumnos ?? [];
        setAlumnos(als);
        const est: Record<string, string> = {};
        const obs: Record<string, string> = {};
        for (const a of data.asistencias ?? []) {
          est[a.alumno.id] = a.estado;
          if (a.observacion) obs[a.alumno.id] = a.observacion;
        }
        for (const a of als) { if (!est[a.id]) est[a.id] = "PRESENTE"; }
        setAsistencias(est);
        setObservaciones(obs);
        setLoading(false);
      });
  }, [claseId, fecha, rol]);

  const guardar = async () => {
    if (!claseId || !fecha || alumnos.length === 0) return;
    setGuardando(true);
    const registros = alumnos.map((a) => ({ alumnoId: a.id, estado: asistencias[a.id] ?? "PRESENTE", observacion: observaciones[a.id] || null }));
    const res = await fetch("/api/asistencia", { method: "POST", body: JSON.stringify({ claseId, fecha, registros }) });
    setGuardando(false);
    if (res.ok) toast("Asistencia guardada correctamente");
    else toast("Error al guardar la asistencia", "error");
  };

  const presentes = Object.values(asistencias).filter((e) => e === "PRESENTE" || e === "TARDANZA").length;
  const ausentes = Object.values(asistencias).filter((e) => e === "AUSENTE").length;

  // Vista alumno
  if (rol === "ALUMNO") {
    return (
      <div>
        <div className="page-header"><h1>Mi Asistencia</h1><p>Revisa tu asistencia por clase</p></div>
        <div className="form-group" style={{ maxWidth: 360 }}>
          <label>Clase</label>
          <select value={claseId} onChange={(e) => setClaseId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {clases.map((c: any) => <option key={c.id} value={c.id}>{c.planEstudio?.materia?.nombre}</option>)}
          </select>
        </div>
        {claseId && <ResumenAlumno claseId={claseId} />}
      </div>
    );
  }

  // Vista profesor/admin
  return (
    <div>
      <div className="page-header">
        <h1>Asistencia</h1>
        <p>Registra la asistencia diaria por clase</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24, maxWidth: 600 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Clase</label>
          <select value={claseId} onChange={(e) => setClaseId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {clases.map((c: any) => (
              <option key={c.id} value={c.id}>{c.planEstudio?.materia?.nombre} — {c.seccion?.grado?.nombre} "{c.seccion?.nombre}"</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Fecha</label>
          <input type="date" value={fecha} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      {!claseId && <div className="empty"><IconClass size={36} style={{ color: "var(--border)" }} /><p>Selecciona una clase</p></div>}
      {claseId && loading && <div className="empty"><IconLoader size={24} /></div>}
      {claseId && !loading && alumnos.length === 0 && <div className="empty"><IconStudent size={36} style={{ color: "var(--border)" }} /><p>No hay alumnos matriculados</p></div>}

      {claseId && !loading && alumnos.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {[["Presentes", presentes, "var(--green)"], ["Ausentes", ausentes, "var(--danger)"], ["Total", alumnos.length, "var(--accent2)"]].map(([l, v, c]) => (
              <div key={String(l)} className="stat-card" style={{ flex: 1 }}>
                <div className="stat-card-icon" style={{ background: `${c}18` }}><IconStudent size={18} style={{ color: String(c) }} /></div>
                <div><div className="stat-card-value">{v}</div><div className="stat-card-label">{l}</div></div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { const all: Record<string,string> = {}; alumnos.forEach((a) => { all[a.id] = "PRESENTE"; }); setAsistencias(all); }}>✓ Todos presentes</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { const all: Record<string,string> = {}; alumnos.forEach((a) => { all[a.id] = "AUSENTE"; }); setAsistencias(all); }}>✗ Todos ausentes</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {alumnos.map((alumno, idx) => {
              const estadoActual = asistencias[alumno.id] ?? "PRESENTE";
              return (
                <div key={alumno.id} style={{ background: "var(--surface)", border: `1.5px solid ${estadoActual === "PRESENTE" ? "var(--green)44" : estadoActual === "AUSENTE" ? "var(--danger)44" : "var(--border)"}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".75rem", color: "var(--muted)", fontWeight: 600, flexShrink: 0 }}>{idx + 1}</div>
                  <div style={{ flex: 1, fontWeight: 500 }}>{alumno.usuario.nombre}</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {ESTADOS.map((e) => {
                      const Icon = e.icon;
                      const activo = estadoActual === e.valor;
                      return (
                        <button key={e.valor} title={e.label} onClick={() => setAsistencias((prev) => ({ ...prev, [alumno.id]: e.valor }))}
                          style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${activo ? e.color : "var(--border)"}`, background: activo ? e.color + "22" : "var(--surface2)", color: activo ? e.color : "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: ".12s" }}>
                          <Icon size={14} />
                        </button>
                      );
                    })}
                  </div>
                  {estadoActual === "AUSENTE" && (
                    <input value={observaciones[alumno.id] || ""} onChange={(e) => setObservaciones((prev) => ({ ...prev, [alumno.id]: e.target.value }))} placeholder="Motivo…"
                      style={{ width: 140, fontSize: ".78rem", padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)" }} />
                  )}
                </div>
              );
            })}
          </div>

          <button className="btn btn-primary" onClick={guardar} disabled={guardando} style={{ width: "100%", justifyContent: "center" }}>
            {guardando ? "Guardando…" : "Guardar asistencia"}
          </button>
        </>
      )}
    </div>
  );
}

function ResumenAlumno({ claseId }: { claseId: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch(`/api/asistencia?claseId=${claseId}&alumnoId=me`).then((r) => r.json()).then(setData); }, [claseId]);
  if (!data) return <div className="empty"><IconLoader size={20} /></div>;
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        {[["Asistencias", data.presentes ?? 0, "var(--green)", IconCheck], ["Faltas", data.ausentes ?? 0, "var(--danger)", IconX], ["% Asistencia", `${data.porcentajeAsistencia ?? 100}%`, "var(--accent2)", IconStudent]].map(([l, v, c, Icon]) => (
          <div key={String(l)} className="stat-card">
            <div className="stat-card-icon" style={{ background: `${c}18` }}><Icon size={18} style={{ color: String(c) }} /></div>
            <div><div className="stat-card-value">{v}</div><div className="stat-card-label">{l}</div></div>
          </div>
        ))}
      </div>
      {(data.porcentajeAsistencia ?? 100) < 70 && (
        <div className="alert-error"><IconAlert size={16} /> Tu asistencia es menor al 70% — riesgo de desaprobación</div>
      )}
    </div>
  );
}
