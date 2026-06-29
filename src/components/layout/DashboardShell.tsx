import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "./Sidebar";

export default async function DashboardShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");

  const usuario = await prisma.usuario.findUnique({ where: { id: (session.user as any).id } });
  if (!usuario) redirect("/sign-in");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar rol={usuario.rol as any} nombre={usuario.nombre} />
      <main className="layout-main" style={{ marginLeft: "var(--sidebar-w)", flex: 1, padding: "36px 40px", maxWidth: "calc(100vw - var(--sidebar-w))", minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
