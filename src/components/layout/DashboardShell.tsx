import Sidebar from "./Sidebar";

interface DashboardShellProps {
  children: React.ReactNode;
  rol: "ADMIN" | "PROFESOR" | "ALUMNO";
  nombre: string;
}

export default function DashboardShell({ children, rol, nombre }: DashboardShellProps) {
  return (
    <div className="app-shell">
      <Sidebar rol={rol} nombre={nombre} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
