"use client";
import { useSession } from "next-auth/react";
import Sidebar from "./Sidebar";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const rol = (session?.user as any)?.rol ?? "ALUMNO";
  const nombre = (session?.user as any)?.name ?? session?.user?.name ?? "Usuario";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar rol={rol} nombre={nombre} />
      <main style={{
        flex: 1,
        marginLeft: "var(--sidebar-w)",
        padding: "32px 36px",
        minWidth: 0,
        overflowX: "hidden",
      }} className="main-content">
        {children}
      </main>
    </div>
  );
}