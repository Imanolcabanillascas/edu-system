import { redirect } from "next/navigation";

// El registro público está deshabilitado: solo el Administrador crea cuentas
// (Profesores y Alumnos) desde los paneles correspondientes.
export default function SignUpPage() {
  redirect("/sign-in");
}
