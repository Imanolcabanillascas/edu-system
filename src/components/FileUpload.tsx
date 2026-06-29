"use client";
import { useRef, useState } from "react";
import { IconFile, IconDownload, IconTrash, IconLoader } from "@/components/icons";

interface FileUploadProps {
  label: string;
  archivoUrl?: string | null;
  archivoNombre?: string | null;
  onChange: (url: string | null, nombre: string | null) => void;
}

// Sube directamente a /api/upload (Vercel Blob). No bloquea el guardado del formulario
// principal — el archivo se sube en cuanto se elige, y solo se guarda la URL resultante.
export default function FileUpload({ label, archivoUrl, archivoNombre, onChange }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file: File) => {
    setSubiendo(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al subir el archivo"); setSubiendo(false); return; }
      onChange(data.url, data.nombre);
    } catch {
      setError("Error de conexión al subir el archivo");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="form-group">
      <label>{label}</label>
      {error && <div className="alert-error" style={{ marginBottom: 8 }}>{error}</div>}

      {archivoUrl ? (
        <div className="file-chip">
          <IconFile size={16} />
          <span className="file-chip-name">{archivoNombre || "Archivo adjunto"}</span>
          <a href={archivoUrl} target="_blank" rel="noopener noreferrer" className="file-chip-action" title="Descargar">
            <IconDownload size={14} />
          </a>
          <button type="button" className="file-chip-action" title="Quitar" onClick={() => onChange(null, null)}>
            <IconTrash size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
        >
          {subiendo ? <IconLoader size={14} /> : <IconFile size={14} />}
          {subiendo ? "Subiendo…" : "Adjuntar PDF o imagen"}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <div className="form-hint">PDF, JPG o PNG · máximo 10 MB</div>
    </div>
  );
}