import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const TZ_PERU = "America/Lima";

/** Fecha/hora actual en Perú (UTC-5, sin DST) */
export function nowPeru(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ_PERU }));
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric", timeZone: TZ_PERU,
  });
}

export function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("es-PE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: TZ_PERU,
  });
}

/** ¿Una fecha límite ya pasó, según la hora actual de Perú? */
export function yaVencio(fechaLimite: Date | string): boolean {
  const limite = new Date(fechaLimite).getTime();
  const ahoraPeru = new Date(
    new Date().toLocaleString("en-US", { timeZone: TZ_PERU })
  ).getTime();
  return limite < ahoraPeru;
}

export function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function avatarColor(name: string) {
  const colors = ["#7c6af5", "#4ecdc4", "#e8b86d", "#e05c5c", "#56c596", "#f06595"];
  return colors[name.charCodeAt(0) % colors.length];
}

export function estadoColor(estado: string) {
  const map: Record<string, string> = {
    PAGADO: "#56c596",
    PENDIENTE: "#e8b86d",
    VENCIDO: "#e05c5c",
    PUBLICADA: "#7c6af5",
    BORRADOR: "#7a7599",
    CERRADA: "#4ecdc4",
    ENTREGADA: "#56c596",
    CALIFICADA: "#7c6af5",
    ENTREGADO: "#56c596",
    CALIFICADO: "#7c6af5",
    FUERA_DE_PLAZO: "#e05c5c",
  };
  return map[estado] ?? "#7a7599";
}

export const MEDIOS_PAGO = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia bancaria" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "YAPE", label: "Yape" },
  { value: "PLIN", label: "Plin" },
  { value: "OTRO", label: "Otro" },
];

export const NIVEL_LABEL: Record<string, string> = {
  PRIMARIA: "Primaria",
  SECUNDARIA: "Secundaria",
};

/** Nombre del grado, ej. "3er Grado" */
export function nombreGrado(grado: { nombre: string; nivel?: { nombre: string } }) {
  return grado.nombre;
}

/** Nombre completo de una sección: "3er Grado A — Primaria" */
export function nombreSeccion(seccion: { nombre: string; grado: { nombre: string; nivel: { nombre: string } } }) {
  return `${seccion.grado.nombre} "${seccion.nombre}" — ${seccion.grado.nivel.nombre}`;
}

/** Nombre de una clase a partir de Materia + Sección, ej: "Matemáticas — 3er Grado A" */
export function nombreClase(clase: { materia: { nombre: string }; seccion: { nombre: string; grado: { nombre: string } } }) {
  return `${clase.materia.nombre} — ${clase.seccion.grado.nombre} "${clase.seccion.nombre}"`;
}
