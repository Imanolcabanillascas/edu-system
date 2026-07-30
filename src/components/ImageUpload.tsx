"use client";
import { useRef, useState, useCallback } from "react";
import { IconLoader, IconTrash, IconStudent } from "@/components/icons";

interface ImageUploadProps {
  fotoUrl?: string | null;
  nombre?: string;
  onChange: (url: string | null) => void;
  size?: number; // diámetro en px, default 96
}

const TIPOS_PERMITIDOS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export default function ImageUpload({ fotoUrl, nombre, onChange, size = 96 }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setError("");
    if (!TIPOS_PERMITIDOS.includes(file.type)) {
      setError("Solo se permiten JPG, PNG o WebP"); return;
    }
    if (file.size > MAX_BYTES) {
      setError("La imagen no puede superar 5 MB"); return;
    }

    setSubiendo(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al subir"); setSubiendo(false); return; }
      onChange(data.url);
    } catch {
      setError("Error de conexión al subir la imagen");
    }
    setSubiendo(false);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const initials = (n?: string) => (n ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {/* Avatar / vista previa */}
      <div
        onClick={() => !subiendo && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        title="Clic para cambiar foto"
        style={{
          width: size, height: size, borderRadius: "50%", cursor: subiendo ? "wait" : "pointer",
          border: dragOver ? "2.5px dashed var(--accent2)" : "2.5px dashed var(--border)",
          background: fotoUrl ? "transparent" : "var(--surface2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", transition: ".15s", position: "relative",
          boxShadow: dragOver ? "0 0 0 4px var(--accent2)22" : "none",
        }}
      >
        {subiendo ? (
          <IconLoader size={24} style={{ color: "var(--muted)" }} />
        ) : fotoUrl ? (
          <img src={fotoUrl} alt="Foto de perfil"
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: size * 0.3, fontWeight: 700, color: "var(--muted)" }}>
            {initials(nombre)}
          </span>
        )}
      </div>

      {/* Acciones */}
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" className="btn btn-ghost btn-sm" disabled={subiendo}
          onClick={() => inputRef.current?.click()}>
          {fotoUrl ? "Cambiar foto" : "Subir foto"}
        </button>
        {fotoUrl && (
          <button type="button" className="btn btn-danger btn-sm" disabled={subiendo}
            onClick={() => onChange(null)} title="Quitar foto">
            <IconTrash size={13} />
          </button>
        )}
      </div>

      <div style={{ fontSize: ".7rem", color: "var(--muted)", textAlign: "center" }}>
        JPG, PNG o WebP · máx. 5 MB · arrastra o haz clic
      </div>

      {error && <div style={{ fontSize: ".75rem", color: "var(--danger)" }}>{error}</div>}

      <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}
