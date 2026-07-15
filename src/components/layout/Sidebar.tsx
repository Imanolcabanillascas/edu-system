"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  IconSchool, IconTeacher, IconStudent, IconClass, IconTask, IconExam, IconCard, IconLogout, IconMenu, IconX, IconLayers, IconBook, IconReport, IconArrowRight, IconCheck,
} from "@/components/icons";

const navItems = {
  ADMIN: [
    { href: "/dashboard", icon: IconSchool, label: "Dashboard" },
    { href: "/academico", icon: IconLayers, label: "Estructura Académica" },
    { href: "/materias", icon: IconBook, label: "Materias" },
    { href: "/plan-estudio", icon: IconBook, label: "Plan de Estudios" },
    { href: "/profesores", icon: IconTeacher, label: "Profesores" },
    { href: "/alumnos", icon: IconStudent, label: "Alumnos" },
    { href: "/clases", icon: IconClass, label: "Clases" },
    { href: "/promocion", icon: IconArrowRight, label: "Promoción manual" },
    { href: "/promocion-automatica", icon: IconCheck, label: "Promoción fin de año" },
    { href: "/reportes", icon: IconReport, label: "Reportes de notas" },
    { href: "/matriculas", icon: IconCard, label: "Matrículas" },
  ],
  PROFESOR: [
    { href: "/dashboard", icon: IconSchool, label: "Dashboard" },
    { href: "/clases", icon: IconClass, label: "Mis Clases" },
    { href: "/tareas", icon: IconTask, label: "Tareas" },
    { href: "/examenes", icon: IconExam, label: "Exámenes" },
  ],
  ALUMNO: [
    { href: "/dashboard", icon: IconSchool, label: "Dashboard" },
    { href: "/clases", icon: IconClass, label: "Mis Clases" },
    { href: "/tareas", icon: IconTask, label: "Mis Tareas" },
    { href: "/examenes", icon: IconExam, label: "Mis Exámenes" },
    { href: "/mi-promedio", icon: IconReport, label: "Mi Promedio" },
    { href: "/matriculas", icon: IconCard, label: "Mi Matrícula" },
  ],
};

interface SidebarProps {
  rol: "ADMIN" | "PROFESOR" | "ALUMNO";
  nombre: string;
}

export default function Sidebar({ rol, nombre }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = navItems[rol] ?? navItems.ALUMNO;
  const rolLabel = { ADMIN: "Administrador", PROFESOR: "Profesor", ALUMNO: "Alumno" }[rol];
  const rolColor = { ADMIN: "var(--accent)", PROFESOR: "var(--accent2)", ALUMNO: "var(--accent3)" }[rol];

  return (
    <>
      {/* Barra superior solo visible en móvil/tablet */}
      <div className="mobile-topbar" style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 64, zIndex: 180,
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        justifyContent: "space-between", padding: "0 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--accent)" }}><IconSchool size={20} /></span>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.1rem", color: "var(--accent)" }}>EduAdmin</span>
        </div>
        <button onClick={() => setOpen(true)} style={{ background: "transparent", border: "none", color: "var(--text)", padding: 6 }}>
          <IconMenu size={22} />
        </button>
      </div>

      {/* Fondo oscuro al abrir en móvil */}
      <div className={`sidebar-backdrop ${open ? "show" : ""}`} onClick={() => setOpen(false)} />

      <aside className={`sidebar ${open ? "sidebar-open" : ""}`} style={{
        width: "var(--sidebar-w)", minHeight: "100vh", background: "var(--surface)",
        borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column",
        padding: "24px 12px", gap: 4, position: "fixed", top: 0, left: 0, bottom: 0,
      }}>
        <div style={{ padding: "0 8px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--accent)" }}><IconSchool size={24} /></span>
            <div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.25rem", color: "var(--accent)", letterSpacing: "-0.5px", lineHeight: 1 }}>EduAdmin</div>
              <div style={{ fontSize: ".62rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 2 }}>Sistema Escolar</div>
            </div>
          </div>
          <button className="sidebar-close-btn" onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: "var(--muted)", padding: 4 }}>
            <IconX size={18} />
          </button>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 9, fontSize: ".875rem", fontWeight: 500, transition: ".15s",
                background: active ? "var(--accent2)22" : "transparent",
                color: active ? "var(--accent2)" : "var(--muted)",
              }}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 12, padding: "12px", borderRadius: 10, background: "var(--surface2)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: rolColor + "33", color: rolColor,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".8rem", fontWeight: 600,
          }}>
            {nombre.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div style={{ fontSize: ".8rem", fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nombre}</div>
            <div style={{ fontSize: ".7rem", color: rolColor, fontWeight: 600 }}>{rolLabel}</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/" })} title="Cerrar sesión" style={{ background: "transparent", border: "none", color: "var(--muted)", padding: 4, flexShrink: 0 }}>
            <IconLogout size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
