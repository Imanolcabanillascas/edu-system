import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const SECRET = "16adf0b66ae983fa4d1a94fc9366d2f7eee0b055db3e632f6f6aaefc31c5ac84";
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || SECRET;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  secret: SECRET,
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
      
        console.log("Intentando login:", credentials.email);
        console.log("DATABASE_URL existe:", !!process.env.DATABASE_URL);
      
        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        
        console.log("Usuario encontrado:", !!usuario);
        
        if (!usuario || usuario.password === "PENDIENTE") return null;
      
        const valido = await bcrypt.compare(credentials.password, usuario.password);
        console.log("Password valido:", valido);
        
        if (!valido) return null;
      
        return { id: usuario.id, email: usuario.email, name: usuario.nombre, rol: usuario.rol } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.rol = (user as any).rol;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).rol = token.rol;
      }
      return session;
    },
  },
};