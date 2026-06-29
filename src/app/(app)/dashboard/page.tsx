import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime, nowPeru } from "@/lib/utils";
import {
  IconTeacher, IconStudent, IconClass, IconTask, IconAlert, IconExam, IconCard,
} from "@/components/icons";
import YearFilter from "./YearFilter";

const ANO_ACTUAL = new Date().getFullYear();

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: {
      nombre: true, rol: true,
      profesor: { select: { id: true, dni: true } },
      alumno: { select: { id: true, dni: true, matricula: { select: { estado: true } } } },
    },
  });
  if (!usuario) redirect("/sign-in");

  if (usuario.rol === "ADMIN") {
    const { ano } = await searchParams;
    const anosDisponibles = await prisma.alumno.findMany({ select: { anoIngreso: true }, distinct: ["anoIngreso"], orderBy: { anoIngreso: "desc" } });
    const anoFiltro = ano ? Number(ano) : null; // null = todos los años

    await prisma.matricula.updateMany({
      where: { estado: "PENDIENTE", fechaVencimiento: { lt: nowPeru() } },
      data: { estado: "VENCIDO" },
    });

    const whereAlumno = anoFiltro ? { anoIngreso: anoFiltro } : {};

    const [profesores, alumnos, clases, matriculasVencidas, tareasActivas, clasesRecientes] = await Promise.all([
      prisma.profesor.count(),
      prisma.alumno.count({ where: whereAlumno }),
      prisma.clase.count(),
      prisma.matricula.count({ where: { estado: "VENCIDO", ...(anoFiltro ? { alumno: { anoIngreso: anoFiltro } } : {}) } }),
      prisma.tarea.count({ where: { estado: "PUBLICADA" } }),
      prisma.clase.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, horario: true, salon: true,
          profesor: { select: { usuario: { select: { nombre: true } } } },
          alumnos: { select: { alumnoId: true } },
          materia: { select: { nombre: true } },
          seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
        },
      }),
    ]);

    return (
      <div>
        <div className="page-header">
          <h1>Panel de administración</h1>
          <p>Resumen general del colegio</p>
        </div>
        <YearFilter anos={anosDisponibles.map((a) => a.anoIngreso)} anoActual={anoFiltro} />
        <div className="stats">
          <StatCard icon={<IconTeacher size={20} />} value={profesores} label="Profesores" color="var(--accent)" />
          <StatCard icon={<IconStudent size={20} />} value={alumnos} label={anoFiltro ? `Alumnos (ingreso ${anoFiltro})` : "Alumnos"} color="var(--accent2)" />
          <StatCard icon={<IconClass size={20} />} value={clases} label="Clases" color="var(--accent3)" />
          <StatCard icon={<IconTask size={20} />} value={tareasActivas} label="Tareas activas" color="var(--green)" />
          <StatCard icon={<IconAlert size={20} />} value={matriculasVencidas} label="Matrículas vencidas" color="var(--danger)" href="/matriculas" />
        </div>
        <h2 className="section-title">Clases recientes</h2>
        <div className="card-grid">
          {clasesRecientes.map((c) => (
            <div className="info-card" key={c.id}>
              <div className="info-card-title">{c.materia.nombre} — {c.seccion.grado.nombre} "{c.seccion.nombre}"</div>
              <div className="info-card-meta">
                <span>{c.profesor.usuario.nombre}</span>
                <span>{c.horario}</span>
                <span>{c.salon}</span>
                <span>{c.alumnos.length} alumnos</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (usuario.rol === "PROFESOR" && usuario.profesor) {
    const [clases, tareas, examenes] = await Promise.all([
      prisma.clase.findMany({ where: { profesorId: usuario.profesor.id }, select: { alumnos: { select: { alumnoId: true } } } }),
      prisma.tarea.count({ where: { profesorId: usuario.profesor.id } }),
      prisma.examen.findMany({
        where: { profesorId: usuario.profesor.id, fechaLimite: { gte: nowPeru() } },
        orderBy: { fechaLimite: "asc" }, take: 3,
        select: {
          id: true, titulo: true, fechaLimite: true, duracion: true,
          clase: { select: { materia: { select: { nombre: true } }, seccion: { select: { nombre: true, grado: { select: { nombre: true } } } } } },
        },
      }),
    ]);
    const totalAlumnos = clases.reduce((acc, c) => acc + c.alumnos.length, 0);

    return (
      <div>
        <div className="page-header">
          <h1>Hola, {usuario.nombre.split(" ")[0]}</h1>
          <p>Resumen de tu actividad docente · DNI {usuario.profesor.dni}</p>
        </div>
        <div className="stats">
          <StatCard icon={<IconClass size={20} />} value={clases.length} label="Mis clases" color="var(--accent2)" />
          <StatCard icon={<IconStudent size={20} />} value={totalAlumnos} label="Alumnos a cargo" color="var(--accent3)" />
          <StatCard icon={<IconTask size={20} />} value={tareas} label="Tareas creadas" color="var(--accent)" />
        </div>
        <h2 className="section-title">Próximos exámenes</h2>
        {examenes.length === 0 ? (
          <div className="empty"><IconExam size={32} style={{ color: "var(--muted)" }} /><p>No tienes exámenes programados</p></div>
        ) : (
          <div className="card-grid">
            {examenes.map((e) => (
              <div className="info-card" key={e.id}>
                <div className="info-card-title">{e.titulo}</div>
                <div className="info-card-meta">
                  <span>{e.clase.materia.nombre} — {e.clase.seccion.grado.nombre} "{e.clase.seccion.nombre}"</span>
                  <span>Vence: {formatDateTime(e.fechaLimite)}</span>
                  <span>{e.duracion} min</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (usuario.rol === "ALUMNO" && usuario.alumno) {
    const [seccionInfo, clases, tareasPendientes, proximoExamen] = await Promise.all([
      prisma.alumno.findUnique({
        where: { id: usuario.alumno.id },
        select: { anoIngreso: true, seccion: { select: { nombre: true, grado: { select: { nombre: true } } } } },
      }),
      prisma.alumnoClase.count({ where: { alumnoId: usuario.alumno.id } }),
      prisma.entrega.count({ where: { alumnoId: usuario.alumno.id, estado: "PENDIENTE" } }),
      prisma.examen.findFirst({
        where: { clase: { alumnos: { some: { alumnoId: usuario.alumno.id } } }, fechaLimite: { gte: nowPeru() } },
        orderBy: { fechaLimite: "asc" },
        select: {
          id: true, titulo: true, fechaLimite: true, duracion: true,
          clase: { select: { materia: { select: { nombre: true } }, seccion: { select: { nombre: true, grado: { select: { nombre: true } } } } } },
        },
      }),
    ]);
    const matricula = usuario.alumno.matricula;

    return (
      <div>
        <div className="page-header">
          <h1>Hola, {usuario.nombre.split(" ")[0]}</h1>
          <p>
            DNI {usuario.alumno.dni}
            {seccionInfo?.seccion && <> · {seccionInfo.seccion.grado.nombre} "{seccionInfo.seccion.nombre}"</>}
            {seccionInfo?.anoIngreso && <> · Ingreso {seccionInfo.anoIngreso}</>}
          </p>
        </div>
        <div className="stats">
          <StatCard icon={<IconClass size={20} />} value={clases} label="Mis clases" color="var(--accent2)" />
          <StatCard icon={<IconTask size={20} />} value={tareasPendientes} label="Tareas pendientes" color="var(--accent)" />
          <StatCard
            icon={<IconCard size={20} />}
            value={matricula?.estado ?? "—"}
            label="Estado matrícula"
            color={matricula?.estado === "PAGADO" ? "var(--green)" : matricula?.estado === "VENCIDO" ? "var(--danger)" : "var(--accent)"}
            isText
            href="/matriculas"
          />
        </div>
        {proximoExamen && (
          <>
            <h2 className="section-title">Próximo examen</h2>
            <div className="info-card" style={{ maxWidth: 320 }}>
              <div className="info-card-title">{proximoExamen.titulo}</div>
              <div className="info-card-meta">
                <span>{proximoExamen.clase.materia.nombre} — {proximoExamen.clase.seccion.grado.nombre} "{proximoExamen.clase.seccion.nombre}"</span>
                <span>Vence: {formatDateTime(proximoExamen.fechaLimite)}</span>
                <span>{proximoExamen.duracion} min</span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="empty">
      <IconAlert size={32} style={{ color: "var(--muted)" }} />
      <p>Tu cuenta aún no tiene un rol asignado. Contacta al administrador del colegio.</p>
    </div>
  );
}

function StatCard({ icon, value, label, color, isText, href }: { icon: React.ReactNode; value: number | string; label: string; color: string; isText?: boolean; href?: string }) {
  const content = (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `${color}1f`, color }}>{icon}</div>
      <div>
        <div className="stat-value" style={isText ? { fontSize: "1.05rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color } : {}}>
          {value}
        </div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
  if (href) {
    return <a href={href} style={{ display: "block" }}>{content}</a>;
  }
  return content;
}
