"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { IconExam, IconLoader, IconCheck, IconX, IconClock, IconAlert } from "@/components/icons";
import { formatDateTime } from "@/lib/utils";

export default function RendirExamenPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examenId = searchParams.get("id");

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);
  const [error, setError] = useState("");

  // Temporizador
  const [tiempoRestante, setTiempoRestante] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!examenId) return;
    fetch(`/api/examenes-seleccion?examenId=${examenId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false);
        if (d.examen?.duracion && !d.yaRespondio) {
          setTiempoRestante(d.examen.duracion * 60);
        }
        // Pre-cargar respuestas si ya respondió
        if (d.yaRespondio?.respuestasPreguntas) {
          const prev: Record<string, string> = {};
          for (const r of d.yaRespondio.respuestasPreguntas) prev[r.preguntaId] = r.opcionId;
          setRespuestas(prev);
        }
      });
  }, [examenId]);

  useEffect(() => {
    if (tiempoRestante === null || tiempoRestante <= 0) return;
    timerRef.current = setTimeout(() => setTiempoRestante((t) => (t ?? 1) - 1), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [tiempoRestante]);

  // Auto-envío cuando se acaba el tiempo
  useEffect(() => {
    if (tiempoRestante === 0 && !resultado && data && !data.yaRespondio) enviar(true);
  }, [tiempoRestante]);

  const formatTiempo = (seg: number) => `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
  const tiempoColor = tiempoRestante !== null && tiempoRestante < 60 ? "var(--danger)" : "var(--text)";

  const elegirOpcion = (preguntaId: string, opcionId: string) => {
    if (data?.yaRespondio || resultado) return;
    setRespuestas((prev) => ({ ...prev, [preguntaId]: opcionId }));
  };

  const enviar = async (autoEnvio = false) => {
    if (!autoEnvio && !confirm("¿Confirmas el envío? No podrás cambiar tus respuestas después.")) return;
    setEnviando(true); setError("");
    if (timerRef.current) clearTimeout(timerRef.current);

    const res = await fetch("/api/examenes-seleccion/responder", {
      method: "POST",
      body: JSON.stringify({
        examenId,
        respuestas: Object.entries(respuestas).map(([preguntaId, opcionId]) => ({ preguntaId, opcionId })),
      }),
    });
    const d = await res.json();
    setEnviando(false);
    if (!res.ok) { setError(d.error); return; }
    setResultado(d);

    // Recarga el examen para mostrar las respuestas correctas
    fetch(`/api/examenes-seleccion?examenId=${examenId}`)
      .then((r) => r.json()).then((d2) => setData(d2));
  };

  if (loading) return <div className="empty"><IconLoader size={24} /></div>;
  if (!data?.examen) return <div className="empty"><IconAlert size={28} /><p>Examen no encontrado</p></div>;

  const { examen, yaRespondio } = data;
  const respondido = !!yaRespondio || !!resultado;
  const notaFinal = resultado?.nota ?? yaRespondio?.nota;
  const totalRespondidas = Object.keys(respuestas).length;
  const totalPreguntas = examen.preguntas.length;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="page-header">
        <h1><IconExam size={24} /> {examen.titulo}</h1>
        {examen.descripcion && <p>{examen.descripcion}</p>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div className="muted-label" style={{ marginBottom: 0 }}>
          {totalPreguntas} preguntas · {examen.duracion} min · Límite: {formatDateTime(examen.fechaLimite)}
        </div>
        {tiempoRestante !== null && !respondido && (
          <div style={{ fontFamily: "monospace", fontSize: "1.2rem", fontWeight: 600, color: tiempoColor, display: "flex", alignItems: "center", gap: 6 }}>
            <IconClock size={18} style={{ color: tiempoColor }} />
            {formatTiempo(tiempoRestante)}
          </div>
        )}
      </div>

      {/* Resultado */}
      {(resultado || respondido) && notaFinal !== undefined && (
        <div className="promedio-hero" style={{ marginBottom: 28, borderColor: notaFinal >= 10.5 ? "var(--green)40" : "var(--danger)40" }}>
          <div className="promedio-numero" style={{ color: notaFinal >= 10.5 ? "var(--green)" : "var(--danger)" }}>
            {notaFinal?.toFixed(2)}
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {notaFinal >= 10.5 ? "¡Aprobado!" : "No aprobado"}
            </div>
            {resultado && (
              <div className="muted-label" style={{ marginBottom: 0 }}>
                {resultado.correctas} de {resultado.total} correctas
              </div>
            )}
            <div className="form-hint" style={{ marginTop: 4 }}>Las respuestas correctas se muestran en verde abajo</div>
          </div>
        </div>
      )}

      {error && <div className="alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Preguntas */}
      {examen.preguntas.map((p: any, pi: number) => {
        const respuestaAlumno = respuestas[p.id];
        const opcionCorrecta = p.opciones.find((o: any) => o.correcta);

        return (
          <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <span style={{ fontWeight: 700, color: "var(--accent2)", minWidth: 24 }}>{pi + 1}.</span>
              <span style={{ fontWeight: 500 }}>{p.texto}</span>
              {p.puntaje !== 1 && <span className="badge" style={{ background: "var(--surface2)", color: "var(--muted)", marginLeft: "auto" }}>{p.puntaje}pt</span>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 28 }}>
              {p.opciones.map((o: any, oi: number) => {
                const elegida = respuestaAlumno === o.id;
                const esCorrecta = o.correcta;
                let bg = "var(--surface2)";
                let border = "var(--border)";
                let color = "var(--text)";

                if (respondido) {
                  if (esCorrecta) { bg = "var(--green)15"; border = "var(--green)"; color = "var(--green)"; }
                  else if (elegida && !esCorrecta) { bg = "var(--danger)15"; border = "var(--danger)"; color = "var(--danger)"; }
                } else if (elegida) {
                  bg = "var(--accent2)15"; border = "var(--accent2)"; color = "var(--accent2)";
                }

                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => elegirOpcion(p.id, o.id)}
                    disabled={respondido}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 8, textAlign: "left",
                      background: bg, border: `1.5px solid ${border}`, color,
                      cursor: respondido ? "default" : "pointer", transition: ".12s",
                    }}
                  >
                    <span style={{ fontWeight: 600, minWidth: 20 }}>{String.fromCharCode(65 + oi)}.</span>
                    <span style={{ flex: 1 }}>{o.texto}</span>
                    {respondido && esCorrecta && <IconCheck size={16} style={{ color: "var(--green)" }} />}
                    {respondido && elegida && !esCorrecta && <IconX size={16} style={{ color: "var(--danger)" }} />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {!respondido && (
        <div className="toolbar" style={{ marginTop: 8 }}>
          <div className="muted-label" style={{ marginBottom: 0 }}>
            {totalRespondidas}/{totalPreguntas} preguntas respondidas
          </div>
          <button className="btn btn-primary" onClick={() => enviar(false)} disabled={enviando || totalRespondidas === 0}>
            {enviando ? "Enviando…" : "Enviar examen"}
          </button>
        </div>
      )}
    </div>
  );
}
