"use client";
import { useEffect, useState } from "react";
import { initials, avatarColor, NIVEL_LABEL } from "@/lib/utils";
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

  // Cuando cambia año/grado de origen, recarga las secciones disponibles de ese año
  useEffect(() => {
    if (!anoOrigenId) return;
    fetch(`/api/secciones?anoLectivoId=${anoOrigenId}`).then((r) => r.json()).then(setSecciones);
    setSeccionOrigenId("");
    setAlumnosOrigen([]);
  }, [anoOrigenId]);

  const cargarAlumnosDeSeccion = async (id: string) => {
    setSeccionOrigenId(id);
    setResultado(null);
    if (!id) { setAlumnosOrigen([]); return; }
    setCargandoAlumnos(true);
    const res = await fetch("/api/alumnos?all=true");
    const todos = await res.json();
    const deLaSeccion = todos.filter((a: any) => a.seccion?.id === id);
    setAlumnosOrigen(deLaSeccion);
    setSeleccionados(deLaSeccion.map((a: any) => a.id)); // todos seleccionados por defecto
    setCargandoAlumnos(false);
  };

  const toggleAlumno = (id: string) => {
    setSeleccionados((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const seccionOrigen = secciones.find((s: any) => s.id === seccionOrigenId);
  const gradosDestinoDisponibles = grados.filter((g: any) => g.nivel.tipo === seccionOrigen?.grado.nivel.tipo);

  const promover = async () => {
    if (!seccionOrigenId || seleccionados.length === 0 || (!egresar && (!gradoDestinoId || !anoDestinoId))) {
      setError("Completa todos los campos y selecciona al menos un alumno");
      return;
    }
    setPromoviendo(true); setError(""); setResultado(null);
    const res = await fetch("/api/promocion", {
      method: "POST",
      body: JSON.stringify({
        seccionOrigenId, alumnoIds: seleccionados, egresar,
        ...(egresar ? {} : { gradoDestinoId, anoLectivoDestinoId: anoDestinoId }),
      }),
    });
    const data = await res.json();
    setPromoviendo(false);
    if (!res.ok) { setError(data.error); return; }
    setResultado(egresar ? `${data.promovidos} alumno(s) marcado(s) como egresado(s).` : `${data.promovidos} alumno(s) promovido(s) correctamente.`);
    cargarAlumnosDeSeccion(seccionOrigenId); // recarga para reflejar que ya no están aquí
  };

  return (
    <div>
      <div className="page-header">
        <h1><IconArrowRight size={24} /> Promoción de alumnos</h1>
        <p>Mueve alumnos de una sección/periodo a la del siguiente grado y año lectivo</p>
      </div>

      {loading ? (
        <div className="empty"><IconLoader size={24} /></div>
      ) : (
        <>
          <div className="promo-grid">
            <div className="promo-col">
              <div className="muted-label">Origen</div>
              <div className="form-group"><label>Año lectivo de origen</label>
                <select value={anoOrigenId} onChange={(e) => setAnoOrigenId(e.target.value)}>
                  {anos.map((a: any) => <option key={a.id} value={a.id}>{a.anio}</option>)}
                </select></div>
              <div className="form-group"><label>Sección / periodo de origen</label>
                <select value={seccionOrigenId} onChange={(e) => cargarAlumnosDeSeccion(e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {secciones.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.grado.nombre} "{s.nombre}" — {NIVEL_LABEL[s.grado.nivel.tipo]}
                    </option>
                  ))}
                </select></div>
            </div>

            <div className="promo-arrow"><IconArrowRight size={22} /></div>

            <div className="promo-col">
              <div className="muted-label">Destino</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 14, fontSize: ".85rem" }}>
                <input type="checkbox" checked={egresar} onChange={(e) => setEgresar(e.target.checked)} />
                Egresar (terminó el último grado/ciclo)
              </label>
              <div className="form-group"><label>Año lectivo de destino</label>
                <select value={anoDestinoId} onChange={(e) => setAnoDestinoId(e.target.value)} disabled={egresar}>
                  <option value="">Seleccionar…</option>
                  {anos.map((a: any) => <option key={a.id} value={a.id}>{a.anio}</option>)}
                </select></div>
              <div className="form-group"><label>Grado / ciclo de destino</label>
                <select value={gradoDestinoId} onChange={(e) => setGradoDestinoId(e.target.value)} disabled={!seccionOrigen || egresar}>
                  <option value="">Seleccionar…</option>
                  {gradosDestinoDisponibles.map((g: any) => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select></div>
            </div>
          </div>

          {cargandoAlumnos ? (
            <div className="empty"><IconLoader size={24} /></div>
          ) : seccionOrigenId && alumnosOrigen.length === 0 ? (
            <div className="empty"><IconStudent size={28} style={{ color: "var(--muted)" }} /><p>No hay alumnos en esta sección</p></div>
          ) : alumnosOrigen.length > 0 ? (
            <>
              <div className="muted-label" style={{ marginTop: 24, marginBottom: 10 }}>
                Alumnos a promover ({seleccionados.length}/{alumnosOrigen.length})
              </div>
              <div className="chip-selector">
                {alumnosOrigen.map((a: any) => {
                  const sel = seleccionados.includes(a.id);
                  return (
                    <button key={a.id} type="button" className={`chip-btn ${sel ? "chip-btn-active" : ""}`} onClick={() => toggleAlumno(a.id)}>
                      <span className="avatar" style={{ width: 18, height: 18, fontSize: ".55rem", background: avatarColor(a.usuario.nombre) + "33", color: avatarColor(a.usuario.nombre), marginRight: 6 }}>
                        {initials(a.usuario.nombre)}
                      </span>
                      {a.usuario.nombre}
                    </button>
                  );
                })}
              </div>

              {error && <div className="alert-error" style={{ marginTop: 16 }}>{error}</div>}
              {resultado && (
                <div className="alert-banner" style={{ cursor: "default", background: "var(--green)15", borderColor: "var(--green)40", color: "var(--green)", marginTop: 16 }}>
                  <IconCheck size={16} /> {resultado}
                </div>
              )}

              <div className="toolbar" style={{ marginTop: 20 }}>
                <div style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={promover} disabled={promoviendo}>
                  {promoviendo ? "Procesando…" : egresar ? `Egresar ${seleccionados.length} alumno(s)` : `Promover ${seleccionados.length} alumno(s)`}
                </button>
              </div>
            </>
          ) : (
            <div className="empty"><IconAlert size={28} style={{ color: "var(--muted)" }} /><p>Selecciona una sección de origen para ver sus alumnos</p></div>
          )}
        </>
      )}
    </div>
  );
}
