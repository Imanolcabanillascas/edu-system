"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  IconSchool, IconTeacher, IconStudent, IconClass, IconTask, IconExam,
  IconCard, IconLogout, IconMenu, IconX, IconLayers, IconBook, IconReport,
  IconArrowRight, IconCheck,
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
    { href: "/matriculas", icon: IconCard, label: "Matrículas" },
    { href: "/promocion", icon: IconArrowRight, label: "Promoción manual" },
    { href: "/promocion-automatica", icon: IconCheck, label: "Promoción fin de año" },
    { href: "/reportes", icon: IconReport, label: "Reportes" },
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
  const inicial = nombre?.charAt(0)?.toUpperCase() ?? "U";

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const SidebarInner = () => (
    <div style={{
      width: "var(--sidebar-w)", height: "100%", display: "flex", flexDirection: "column",
      background: "var(--surface)", borderRight: "1px solid var(--border)", overflowY: "auto",
    }}>
      <div style={{ padding: "20px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
        <Link href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconSchool size={18} style={{ color: "#fff" }} />
          </div>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.1rem", color: "var(--text)", fontWeight: 700 }}>EduAdmin</span>
        </Link>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "none" }} className="btn-close-sidebar">
          <IconX size={20} />
        </button>
      </div>

      <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                borderRadius: 10, transition: "all .15s",
                background: active ? "var(--accent2)18" : "transparent",
                color: active ? "var(--accent2)" : "var(--muted)",
                fontWeight: active ? 600 : 400, fontSize: ".875rem",
              }}>
                <Icon size={18} style={{ flexShrink: 0 }} />
                <span>{label}</span>
                {active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--accent2)", marginLeft: "auto", flexShrink: 0 }} />}
              </div>
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "12px 10px", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "var(--surface2)", marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: rolColor + "33", color: rolColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: ".85rem", flexShrink: 0 }}>
            {inicial}
          </div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: ".82rem", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nombre}</div>
            <div style={{ fontSize: ".72rem", color: rolColor, fontWeight: 500 }}>{rolLabel}</div>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/sign-in" })} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
          borderRadius: 10, border: "none", background: "transparent", cursor: "pointer",
          color: "var(--muted)", fontSize: ".875rem",
        }}>
          <IconLogout size={16} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Topbar móvil */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 56, zIndex: 400,
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        alignItems: "center", padding: "0 16px", gap: 12,
        display: "none",
      }} className="mobile-topbar">
        <button onClick={() => setOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)", padding: 4, display: "flex" }}>
          <IconMenu size={22} />
        </button>
        <Link href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "var(--accent2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconSchool size={14} style={{ color: "#fff" }} />
          </div>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1rem", color: "var(--text)", fontWeight: 700 }}>EduAdmin</span>
        </Link>
        <div style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: "50%", background: rolColor + "33", color: rolColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: ".78rem" }}>
          {inicial}
        </div>
      </div>

      {/* Backdrop */}
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 450 }} />}

      {/* Sidebar desktop */}
      <div className="sidebar-desktop" style={{ position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 200 }}>
        <SidebarInner />
      </div>

      {/* Sidebar móvil drawer */}
      <div className="sidebar-mobile" style={{
        position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 500,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform .25s ease",
      }}>
        <SidebarInner />
      </div>
    </>
  );
}