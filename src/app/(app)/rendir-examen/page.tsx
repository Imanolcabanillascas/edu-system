"use client";
import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { IconExam, IconLoader, IconCheck, IconX, IconClock, IconAlert } from "@/components/icons";

function RendirExamenContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examenId = searchParams.get("id");
  const [examen, setExamen] = useState<any>(null);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [error, setError] = useState("");
  const [tiempoRestante, setTiempoRestante] = useState<number | null>(null);
  const [yaRespondido, setYaRespondido] = useState(false);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!examenId) return;
    fetch(`/api/examenes-seleccion?id=${examenId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        setExamen(data);
        if (data.respuesta) { setYaRespondido(true); setResultado(data.respuesta); }
        else {
          const restante = Math.max(0, Math.floor((new Date(data.fechaLimite).getTime() - Date.now()) / 1000));
          setTiempoRestante(restante);
        }
        setLoading(false);
      })
      .catch(() => { setError("Error al cargar el examen"); setLoading(false); });
  }, [examenId]);

  const enviar = useCallback(async (forzado = false) => {
    if (!examen || enviando) return;
    if (!forzado && Object.keys(respuestas).length < examen.preguntas.length) {
      if (!confirm("Hay preguntas sin responder. ¿Enviar de todas formas?")) return;
    }
    setEnviando(true);
    if (intervaloRef.current) clearInterval(intervaloRef.current);
    const res = await fetch("/api/examenes-seleccion/responder", {
      method: "POST",
      body: JSON.stringify({ examenId, respuestas }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Error al enviar"); setEnviando(false); return; }
    setResultado(data); setYaRespondido(true); setEnviando(false);
  }, [examen, enviando, respuestas, examenId]);

  useEffect(() => {
    if (tiempoRestante === null || yaRespondido) return;
    if (tiempoRestante <= 0) { enviar(true); return; }
    intervaloRef.current = setInterval(() => {
      setTiempoRestante((t) => {
        if (t === null || t <= 1) { clearInterval(intervaloRef.current!); enviar(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervaloRef.current) clearInterval(intervaloRef.current); };
  }, [tiempoRestante, yaRespondido, enviar]);

  const fmt = (seg: number) => `${Math.floor(seg/60).toString().padStart(2,"0")}:${(seg%60).toString().padStart(2,"0")}`;

  if (loading) return <div className="empty"><IconLoader size={28} /></div>;
  if (error) return <div className="alert-error" style={{ margin: 32 }}><IconAlert size={16} /> {error}</div>;
  if (!examen) return <div className="empty"><p>Examen no encontrado</p></div>;

  if (yaRespondido && resultado) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div className="page-header"><h1><IconExam size={24} /> {examen.titulo}</h1></div>
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 16, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: "3.5rem", fontWeight: 700, color: resultado.nota >= 10.5 ? "var(--green)" : "var(--danger)", fontFamily: "'DM Serif Display',serif" }}>
            {resultado.nota?.toFixed(2) ?? "—"}
          </div>
          <div style={{ fontSize: ".9rem", color: "var(--muted)", margin: "8px 0 24px" }}>Nota sobre 20</div>
          <span className="badge" style={{ background: resultado.nota >= 10.5 ? "var(--green)22" : "var(--danger)22", color: resultado.nota >= 10.5 ? "var(--green)" : "var(--danger)", fontSize: ".9rem", padding: "8px 20px" }}>
            {resultado.nota >= 10.5 ? "Aprobado" : "Desaprobado"}
          </span>
          <div style={{ marginTop: 24 }}>
            <button className="btn btn-ghost" onClick={() => router.back()}>Volver</button>
          </div>
        </div>
      </div>
    );
  }

  const preguntas = [...(examen.preguntas ?? [])].sort((a: any, b: any) => a.orden - b.orden);
  const respondidas = Object.keys(respuestas).length;
  const pct = preguntas.length > 0 ? Math.round((respondidas / preguntas.length) * 100) : 0;
  const tiempoCritico = tiempoRestante !== null && tiempoRestante < 120;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div className="page-header">
        <h1><IconExam size={24} /> {examen.titulo}</h1>
        <p>{examen.clase?.planEstudio?.materia?.nombre}</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: ".8rem", color: "var(--muted)" }}>
            <span>{respondidas} de {preguntas.length} respondidas</span><span>{pct}%</span>
          </div>
          <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent2)", borderRadius: 3, transition: "width .3s" }} />
          </div>
        </div>
        {tiempoRestante !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 10, background: tiempoCritico ? "var(--danger)15" : "var(--surface2)", color: tiempoCritico ? "var(--danger)" : "var(--text)", fontWeight: 600, fontSize: "1rem", border: `1.5px solid ${tiempoCritico ? "var(--danger)44" : "var(--border)"}` }}>
            <IconClock size={16} />{fmt(tiempoRestante)}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
        {preguntas.map((p: any, idx: number) => {
          const sel = respuestas[p.id];
          return (
            <div key={p.id} style={{ background: "var(--surface)", border: `1.5px solid ${sel ? "var(--accent2)44" : "var(--border)"}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 14, fontSize: ".95rem", lineHeight: 1.5 }}>
                <span style={{ color: "var(--accent2)", marginRight: 8 }}>{idx + 1}.</span>{p.texto}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...(p.opciones ?? [])].sort((a: any, b: any) => a.orden - b.orden).map((op: any) => {
                  const activa = sel === op.id;
                  return (
                    <button key={op.id} onClick={() => setRespuestas((prev) => ({ ...prev, [p.id]: op.id }))}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${activa ? "var(--accent2)" : "var(--border)"}`, background: activa ? "var(--accent2)12" : "var(--surface2)", cursor: "pointer", textAlign: "left", transition: "all .15s", width: "100%" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${activa ? "var(--accent2)" : "var(--border)"}`, background: activa ? "var(--accent2)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {activa && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                      </div>
                      <span style={{ fontSize: ".875rem", color: activa ? "var(--accent2)" : "var(--text)", fontWeight: activa ? 500 : 400 }}>{op.texto}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn btn-primary" onClick={() => enviar(false)} disabled={enviando}
        style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: "1rem" }}>
        {enviando ? "Enviando…" : "Enviar examen"}
      </button>
    </div>
  );
}

export default function RendirExamenPage() {
  return (
    <Suspense fallback={<div className="empty"><IconLoader size={28} /></div>}>
      <RendirExamenContent />
    </Suspense>
  );
}
