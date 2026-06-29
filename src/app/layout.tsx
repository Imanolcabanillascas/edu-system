import type { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduAdmin — Sistema de Gestión Escolar",
  description: "Plataforma de administración escolar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      {/* suppressHydrationWarning: algunas extensiones del navegador (ej. ColorZilla)
          inyectan atributos en <body> antes de que React hidrate, lo que genera una
          advertencia inofensiva de "mismatch" que no refleja un problema real. */}
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
