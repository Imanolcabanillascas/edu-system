"use client";
import { useSession } from "next-auth/react";
import Sidebar from "./Sidebar";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const rol = (session?.user as any)?.rol ?? "ALUMNO";
  const nombre = (session?.user as any)?.name ?? session?.user?.name ?? "Usuario";

  return (
    <div className="app-shell">
      <Sidebar rol={rol} nombre={nombre} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
