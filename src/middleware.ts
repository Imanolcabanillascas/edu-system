import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPaths = ["/dashboard", "/profesores", "/alumnos", "/clases", "/tareas", "/examenes", "/matriculas"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.redirect(new URL("/sign-in", req.url));

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profesores/:path*",
    "/alumnos/:path*",
    "/clases/:path*",
    "/tareas/:path*",
    "/examenes/:path*",
    "/matriculas/:path*",
  ],
};
