import { NextResponse } from "next/server";

// Registro público deshabilitado: las cuentas (Profesor, Alumno) las crea
// exclusivamente el Administrador desde los paneles /profesores y /alumnos.
export async function POST() {
  return NextResponse.json({ error: "El registro público está deshabilitado" }, { status: 403 });
}
