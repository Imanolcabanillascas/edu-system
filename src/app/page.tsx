import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

// Sin landing page pública: la raíz del sitio siempre lleva directo al login
// (o al dashboard si ya hay sesión activa).
export default async function Home() {
  const session = await getServerSession(authOptions);
  redirect(session ? "/dashboard" : "/sign-in");
}
