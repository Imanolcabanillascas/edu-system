"use client";
import { useEffect, useState } from "react";
import { NIVEL_LABEL, avatarColor, initials } from "@/lib/utils";
import { IconArrowRight, IconLoader, IconCheck, IconStudent, IconAlert } from "@/components/icons";

export default function PromocionPage() {
  const [anos, setAnos] = useState<any[]>([]);
  const [grados, setGrados] = useState<any[]>([]);
  const [secciones, setSecciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [anoOrigenId, setAnoOrigenId] = useState("");
  const [seccionOrigenId, setSeccionOrigenId] = useState("");
  const [anoDestinoId, setAnoDestinoId] = useState("");
  const [gradoDestinoId, setGradoDestinoId] = useState("");
  const [egresar, setEgresar] = useState(false);

  const [alumnosOrigen, setAlumnosOrigen] = useState<any[]>([]);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [cargandoAlumnos, setCargandoAlumnos] = useState(false);

  const [promoviendo, setPromoviendo] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const [resA, resG] = await Promise.all([fetch("/api/anos-lectivos"), fetch("/api/grados")]);
    const anosData = await resA.json();
    setAnos(anosData);
    setGrados(await resG.json());
    const activo = anosData.find((a: any) => a.activo);
    setAnoOrigenId(activo?.id ?? anosData[0]?.id ?? "");
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!anoOrigenId) return;
    fetch(`/api/secciones?anoLectivoId=${anoOrigenId}`).then((r) => r.json()).then(setSecciones);
    setSeccionOrigenId("");
    setAlumnosOrigen([]);
  }, [anoOrigenId]);

  // Carga alumnos via matrículas de la sección seleccionada
  const cargarAlumnosDeSeccion = async (seccionId: string) => {
    setSeccionOrigenId(seccionId);
    setResultado(null);
    setError("");
    if (!seccionId) { setAlumnosOrigen([]); return; }
    setCargandoAlumnos(true);

    // Obtiene matriculas de esa sección en el año origen
    const res = await fetch(`/api/matriculas`);
    const todasMatriculas = await res.json();
    const deEstaSeccion = todasMatriculas.filter(
      (m: any) => m.seccion?.id === seccionId && m.anoLectivoId === anoOrigenId
    );
    const alumnosDeLaSeccion = deEstaSeccion.map((m: any) => ({
      id: m.alumno.id,
      nombre: m.alumno.usuario.nombre,
      dni: m.alumno.dni,
    }));

    setAlumnosOrigen(alumnosDeLaSeccion);
    setSeleccionados(alumnosDeLaSeccion.map((a: any) => a.id));
    setCargandoAlumnos(false);
  };

  const toggleAlumno = (id: string) => {
    setSeleccionados((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const seccionOrigen = secciones.find((s: any) => s.id === seccionOrigenId);
  const gradosDisponibles = grados.filter((g: any) =>
    g.nivel?.tipo === seccionOrigen?.grado?.nivel?.tipo
  );

  const promover = async () => {
    if (!seccionOrigenId || seleccionados.length === 0) {
      setError("Selecciona una sección y al menos un alumno"); return;
    }
    if (!egresar && (!gradoDestinoId || !anoDestinoId)) {
      setError("Selecciona el grado y año de destino"); return;
    }
    setPromoviendo(true); setError(""); setResultado(null);

    const res = await fetch("/api/promocion", {
      method: "POST",
      body: JSON.stringify({
        seccionOrigenId,
        alumnoIds: seleccionados,
        egresar,
        ...(egresar ? {} : { gradoDestinoId, anoLectivoDestinoId: anoDestinoId }),
      }),
    });
    const data = await res.json();
    setPromoviendo(false);
    if (!res.ok) { setError(data.error ?? "Error al procesar"); return; }
    setResultado(data.mensaje);
    setAlumnosOrigen([]);
    setSeleccionados([]);
    setSeccionOrigenId("");
  };

  if (loading) return <div className="empty"><IconLoader size={24} /></div>;

  return (
    <div>
      <div className="page-header">
        <h1><IconArrowRight size={24} /> Promoción Manual</h1>
        <p>Mueve alumnos de una sección a otra o egréasalos</p>
      </div>

      {resultado && (
        <div className="alert-banner" style={{ marginBottom: 24 }}>
          <IconCheck size={16} /> {resultado}
        </div>
      )}
      {error && <div className="alert-error" style={{ marginBottom: 16 }}><IconAlert size={16} /> {error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Sección origen */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div className="muted-label" style={{ marginBottom: 12 }}>Origen</div>
          <div className="form-group">
            <label>Año lectivo origen</label>
            <select value={anoOrigenId} onChange={(e) => setAnoOrigenId(e.target.value)}>
              {anos.map((a: any) => <option key={a.id} value={a.id}>{a.anio}{a.activo ? " (activo)" : ""}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Sección origen</label>
            <select value={seccionOrigenId} onChange={(e) => cargarAlumnosDeSeccion(e.target.value)} disabled={!anoOrigenId}>
              <option value="">Seleccionar sección…</option>
              {secciones.map((s: any) => (
                <option key={s.id} value={s.id}>{s.grado?.nombre} "{s.nombre}"</option>
              ))}
            </select>
          </div>
        </div>

        {/* Destino */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div className="muted-label" style={{ marginBottom: 12 }}>Destino</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 14, fontSize: ".875rem" }}>
            <input type="checkbox" checked={egresar} onChange={(e) => setEgresar(e.target.checked)} />
            Egresar alumnos (en vez de promover)
          </label>
          {!egresar && (
            <>
              <div className="form-group">
                <label>Año lectivo destino</label>
                <select value={anoDestinoId} onChange={(e) => setAnoDestinoId(e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {anos.map((a: any) => <option key={a.id} value={a.id}>{a.anio}{a.activo ? " (activo)" : ""}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Grado destino</label>
                <select value={gradoDestinoId} onChange={(e) => setGradoDestinoId(e.target.value)} disabled={!seccionOrigenId}>
                  <option value="">Seleccionar…</option>
                  {gradosDisponibles.map((g: any) => (
                    <option key={g.id} value={g.id}>{g.nombre} — {NIVEL_LABEL[g.nivel.tipo]}</option>
                  ))}
                </select>
              </div>
              <div className="form-hint">Se asignará a la sección con menos alumnos del grado destino</div>
            </>
          )}
        </div>
      </div>

      {/* Lista de alumnos */}
      {seccionOrigenId && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="muted-label" style={{ marginBottom: 0 }}>
              Alumnos de la sección {cargandoAlumnos ? "" : `(${alumnosOrigen.length})`}
            </div>
            {alumnosOrigen.length > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setSeleccionados(alumnosOrigen.map((a) => a.id))}>
                  Todos
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSeleccionados([])}>Ninguno</button>
              </div>
            )}
          </div>

          {cargandoAlumnos && <div className="empty" style={{ padding: 20 }}><IconLoader size={20} /></div>}

          {!cargandoAlumnos && alumnosOrigen.length === 0 && (
            <div className="empty" style={{ padding: 20 }}>
              <IconStudent size={28} style={{ color: "var(--border)" }} />
              <p>No hay alumnos matriculados en esta sección</p>
            </div>
          )}

          {!cargandoAlumnos && alumnosOrigen.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alumnosOrigen.map((a: any) => {
                const sel = seleccionados.includes(a.id);
                return (
                  <label key={a.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                    borderRadius: 10, cursor: "pointer", transition: "all .15s",
                    background: sel ? "var(--accent2)08" : "var(--surface2)",
                    border: `1.5px solid ${sel ? "var(--accent2)44" : "var(--border)"}`,
                  }}>
                    <input type="checkbox" checked={sel} onChange={() => toggleAlumno(a.id)} style={{ flexShrink: 0 }} />
                    <div className="avatar" style={{ background: avatarColor(a.nombre) + "33", color: avatarColor(a.nombre), width: 30, height: 30, fontSize: ".75rem" }}>
                      {initials(a.nombre)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: ".875rem" }}>{a.nombre}</div>
                      {a.dni && <div style={{ fontSize: ".75rem", color: "var(--muted)" }}>DNI: {a.dni}</div>}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {seccionOrigenId && alumnosOrigen.length > 0 && (
        <button className="btn btn-primary" onClick={promover} disabled={promoviendo || seleccionados.length === 0}
          style={{ width: "100%", justifyContent: "center", padding: 14, fontSize: "1rem" }}>
          {promoviendo ? <><IconLoader size={18} /> Procesando…</> :
            egresar
              ? <><IconCheck size={18} /> Egresar {seleccionados.length} alumno(s)</>
              : <><IconArrowRight size={18} /> Promover {seleccionados.length} alumno(s)</>}
        </button>
      )}
    </div>
  );
}
