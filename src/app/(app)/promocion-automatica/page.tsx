"use client";
import { useEffect, useState } from "react";
import { initials, avatarColor, NIVEL_LABEL } from "@/lib/utils";
import { IconArrowRight, IconLoader, IconCheck, IconAlert, IconX } from "@/components/icons";

type Accion = "PROMOVER" | "EGRESAR" | "REPETIR";

export default function PromocionAutomaticaPage() {
  const [anos, setAnos] = useState<any[]>([]);
  const [anoOrigenId, setAnoOrigenId] = useState("");
  const [anoDestinoId, setAnoDestinoId] = useState("");

  const [vistaPrevia, setVistaPrevia] = useState<any[] | null>(null);
  const [decisiones, setDecisiones] = useState<Record<string, Accion>>({});
  const [cargando, setCargando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/anos-lectivos").then((r) => r.json()).then((data) => {
      setAnos(data);
      const activo = data.find((a: any) => a.activo);
      setAnoOrigenId(activo?.id ?? data[0]?.id ?? "");
    });
  }, []);

  const cargarVistaPrevia = async () => {
    if (!anoOrigenId) return;
    setCargando(true); setError(""); setResultado(null);
    const res = await fetch(`/api/promocion-automatica?anoLectivoOrigenId=${anoOrigenId}`);
    const data = await res.json();
    setCargando(false);
    if (!res.ok) { setError(data.error); return; }

    setVistaPrevia(data);
    // Decisión inicial automática: aprueba → promover (o egresar si es el último grado); no aprueba → repetir
    const iniciales: Record<string, Accion> = {};
    for (const seccion of data) {
      for (const a of seccion.alumnos) {
        iniciales[a.id] = a.aprueba ? (seccion.esUltimoGrado ? "EGRESAR" : "PROMOVER") : "REPETIR";
      }
    }
    setDecisiones(iniciales);
  };

  const cambiarDecision = (alumnoId: string, accion: Accion) => {
    setDecisiones((prev) => ({ ...prev, [alumnoId]: accion }));
  };

  const aplicar = async () => {
    if (!vistaPrevia || !anoDestinoId) { setError("Selecciona el año lectivo de destino"); return; }
    if (anoDestinoId === anoOrigenId) { setError("El año de destino debe ser distinto al de origen"); return; }

    const listaDecisiones = vistaPrevia.flatMap((seccion) =>
      seccion.alumnos.map((a: any) => ({ alumnoId: a.id, seccionOrigenId: seccion.seccionId, accion: decisiones[a.id] }))
    );

    if (!confirm(`¿Aplicar la promoción a ${listaDecisiones.filter((d) => d.accion !== "REPETIR").length} alumno(s)? Esta acción modifica sus secciones/estado.`)) return;

    setAplicando(true); setError("");
    const res = await fetch("/api/promocion-automatica", {
      method: "POST",
      body: JSON.stringify({ anoLectivoDestinoId: anoDestinoId, decisiones: listaDecisiones }),
    });
    const data = await res.json();
    setAplicando(false);
    if (!res.ok) { setError(data.error); return; }
    setResultado(data);
    setVistaPrevia(null);
  };

  const totalAlumnos = vistaPrevia?.reduce((s, sec) => s + sec.alumnos.length, 0) ?? 0;
  const totalPromover = vistaPrevia ? Object.values(decisiones).filter((d) => d === "PROMOVER").length : 0;
  const totalEgresar = vistaPrevia ? Object.values(decisiones).filter((d) => d === "EGRESAR").length : 0;
  const totalRepiten = vistaPrevia ? Object.values(decisiones).filter((d) => d === "REPETIR").length : 0;

  return (
    <div>
      <div className="page-header">
        <h1><IconArrowRight size={24} /> Promoción automática de fin de año</h1>
        <p>Calcula quién aprueba según su promedio y revisa antes de aplicar los cambios masivos</p>
      </div>

      <div className="form-row" style={{ maxWidth: 600, marginBottom: 4 }}>
        <div className="form-group"><label>Año lectivo de origen (el que termina)</label>
          <select value={anoOrigenId} onChange={(e) => { setAnoOrigenId(e.target.value); setVistaPrevia(null); }}>
            {anos.map((a: any) => <option key={a.id} value={a.id}>{a.anio}{a.activo ? " (activo)" : ""}</option>)}
          </select></div>
        <div className="form-group"><label>Año lectivo de destino (al que pasan)</label>
          <select value={anoDestinoId} onChange={(e) => setAnoDestinoId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {anos.map((a: any) => <option key={a.id} value={a.id}>{a.anio}</option>)}
          </select></div>
      </div>

      <div className="toolbar">
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={cargarVistaPrevia} disabled={cargando || !anoOrigenId}>
          {cargando ? "Calculando…" : "Calcular vista previa"}
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {resultado && (
        <div className="alert-banner" style={{ cursor: "default", background: "var(--green)15", borderColor: "var(--green)40", color: "var(--green)" }}>
          <IconCheck size={16} />
          Listo: {resultado.promovidos} promovido(s), {resultado.egresados} egresado(s), {resultado.repiten} repiten de año.
        </div>
      )}

      {cargando && <div className="empty"><IconLoader size={24} /></div>}

      {vistaPrevia && !cargando && (
        <>
          {totalAlumnos === 0 ? (
            <div className="empty"><IconAlert size={28} style={{ color: "var(--muted)" }} /><p>No hay alumnos activos en secciones de este año</p></div>
          ) : (
            <>
              <div className="stats" style={{ marginTop: 20 }}>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: "var(--green)1f", color: "var(--green)" }}><IconCheck size={20} /></div>
                  <div><div className="stat-value">{totalPromover}</div><div className="stat-label">Pasan de grado</div></div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: "var(--accent2)1f", color: "var(--accent2)" }}><IconArrowRight size={20} /></div>
                  <div><div className="stat-value">{totalEgresar}</div><div className="stat-label">Egresan</div></div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: "var(--danger)1f", color: "var(--danger)" }}><IconX size={20} /></div>
                  <div><div className="stat-value">{totalRepiten}</div><div className="stat-label">Repiten</div></div>
                </div>
              </div>

              {vistaPrevia.map((seccion) => (
                <div key={seccion.seccionId} style={{ marginBottom: 28 }}>
                  <h3 className="section-title">
                    {seccion.grado.nombre} "{seccion.seccionNombre}" — {NIVEL_LABEL[seccion.grado.nivel.tipo]}
                    {seccion.grado.carrera ? ` (${seccion.grado.carrera.nombre})` : ""}
                    {seccion.esUltimoGrado && <span className="badge" style={{ background: "var(--accent2)22", color: "var(--accent2)", marginLeft: 10 }}>Último grado — egresan</span>}
                    {!seccion.esUltimoGrado && !seccion.grado.gradoSiguiente && (
                      <span className="badge" style={{ background: "var(--danger)22", color: "var(--danger)", marginLeft: 10 }}>Sin grado siguiente configurado</span>
                    )}
                  </h3>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Alumno</th><th>DNI</th><th>Promedio</th><th>Decisión</th></tr></thead>
                      <tbody>
                        {seccion.alumnos.map((a: any) => (
                          <tr key={a.id}>
                            <td style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div className="avatar" style={{ background: avatarColor(a.nombre) + "33", color: avatarColor(a.nombre) }}>{initials(a.nombre)}</div>
                              {a.nombre}
                            </td>
                            <td style={{ color: "var(--muted)", fontFamily: "monospace" }}>{a.dni}</td>
                            <td>
                              {a.promedio !== null ? (
                                <span className="badge" style={{ background: a.aprueba ? "var(--green)22" : "var(--danger)22", color: a.aprueba ? "var(--green)" : "var(--danger)" }}>
                                  {a.promedio.toFixed(2)}
                                </span>
                              ) : <span style={{ color: "var(--muted)" }}>Sin notas</span>}
                            </td>
                            <td>
                              <select
                                value={decisiones[a.id] ?? "REPETIR"}
                                onChange={(e) => cambiarDecision(a.id, e.target.value as Accion)}
                                style={{ width: "auto", padding: "5px 10px", fontSize: ".8rem" }}
                              >
                                {!seccion.esUltimoGrado && <option value="PROMOVER">Promover</option>}
                                {seccion.esUltimoGrado && <option value="EGRESAR">Egresar</option>}
                                <option value="REPETIR">Repite de año</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <div className="toolbar">
                <div style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={aplicar} disabled={aplicando || !anoDestinoId}>
                  {aplicando ? "Aplicando…" : "Confirmar y aplicar promoción"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
