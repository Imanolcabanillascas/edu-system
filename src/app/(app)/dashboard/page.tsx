import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime, nowPeru } from "@/lib/utils";
import {
  IconTeacher, IconStudent, IconClass, IconTask, IconAlert, IconExam,
  IconCard, IconClock, IconLocation,
} from "@/components/icons";
import YearFilter from "./YearFilter";
import StatCard from "./StatCard";
import Link from "next/link";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");

  const usuario = await prisma.usuario.findUnique({
    where: { id: (session.user as any).id },
    select: {
      nombre: true, rol: true,
      profesor: { select: { id: true } },
      alumno: { select: { id: true } },
    },
  });
  if (!usuario) redirect("/sign-in");

  if (usuario.rol === "ADMIN") {
    const { ano } = await searchParams;
    const anosDisponibles = await prisma.alumno.findMany({
      select: { anoIngreso: true }, distinct: ["anoIngreso"], orderBy: { anoIngreso: "desc" },
    });
    const anoFiltro = ano ? Number(ano) : null;
    await prisma.matricula.updateMany({
      where: { estado: "PENDIENTE", fechaVencimiento: { lt: nowPeru() } },
      data: { estado: "VENCIDO" },
    });
    const whereAlumno = anoFiltro ? { anoIngreso: anoFiltro } : {};
    const [profesores, alumnos, clases, matriculasVencidas, tareasActivas, examenesActivos, clasesRecientes] = await Promise.all([
      prisma.profesor.count(),
      prisma.alumno.count({ where: whereAlumno }),
      prisma.clase.count(),
      prisma.matricula.count({ where: { estado: "VENCIDO", ...(anoFiltro ? { alumno: { anoIngreso: anoFiltro } } : {}) } }),
      prisma.tarea.count({ where: { estado: "PUBLICADA" } }),
      prisma.examen.count({ where: { fechaLimite: { gte: nowPeru() } } }),
      prisma.clase.findMany({
        take: 6, orderBy: { createdAt: "desc" },
        select: {
          id: true, horario: true, salon: true,
          profesor: { select: { usuario: { select: { nombre: true } } } },
          planEstudio: { select: { materia: { select: { nombre: true } } } },
          seccion: {
            select: {
              nombre: true,
              grado: { select: { nombre: true } },
              _count: { select: { matriculas: true } },
            },
          },
        },
      }),
    ]);
    return (
      <div>
        <div className="page-header">
          <h1>Panel de administración</h1>
          <p>Resumen general del colegio</p>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
          <YearFilter anos={anosDisponibles.map((a) => a.anoIngreso)} anoActual={anoFiltro} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 36 }}>
          <StatCard icon={<IconTeacher size={22} />} value={profesores} label="Profesores" color="var(--accent)" href="/profesores" />
          <StatCard icon={<IconStudent size={22} />} value={alumnos} label={anoFiltro ? `Alumnos ${anoFiltro}` : "Alumnos"} color="var(--accent2)" href="/alumnos" />
          <StatCard icon={<IconClass size={22} />} value={clases} label="Clases" color="var(--accent3)" href="/clases" />
          <StatCard icon={<IconTask size={22} />} value={tareasActivas} label="Tareas activas" color="var(--green)" href="/reportes" />
          <StatCard icon={<IconExam size={22} />} value={examenesActivos} label="Exámenes activos" color="var(--accent2)" href="/examenes" />
          <StatCard icon={<IconAlert size={22} />} value={matriculasVencidas} label="Matrículas vencidas" color="var(--danger)" href="/matriculas" />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>Clases recientes</h2>
          <Link href="/clases" style={{ fontSize: ".8rem", color: "var(--accent2)", textDecoration: "none", fontWeight: 500 }}>Ver todas</Link>
        </div>
        <div className="card-grid">
          {clasesRecientes.length === 0 && <div className="empty" style={{ gridColumn: "1/-1" }}><p>No hay clases todavía</p></div>}
          {clasesRecientes.map((c) => (
            <div className="info-card" key={c.id}>
              <div className="info-card-title">{c.planEstudio.materia.nombre}</div>
              <div className="info-card-meta">
                <span style={{ color: "var(--accent2)", fontWeight: 500 }}>{c.seccion.grado.nombre} "{c.seccion.nombre}"</span>
                <span><IconTeacher size={13} /> {c.profesor.usuario.nombre}</span>
                {c.horario && <span><IconClock size={13} /> {c.horario}</span>}
                {c.salon && <span><IconLocation size={13} /> {c.salon}</span>}
                <span><IconStudent size={13} /> {c.seccion._count.matriculas} alumno(s)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (usuario.rol === "PROFESOR" && usuario.profesor) {
    const [clases, tareas, examenes] = await Promise.all([
      prisma.clase.findMany({
        where: { profesorId: usuario.profesor.id },
        select: { seccion: { select: { _count: { select: { matriculas: true } } } } },
      }),
      prisma.tarea.count({ where: { profesorId: usuario.profesor.id } }),
      prisma.examen.findMany({
        where: { profesorId: usuario.profesor.id, fechaLimite: { gte: nowPeru() } },
        orderBy: { fechaLimite: "asc" }, take: 3,
        select: {
          id: true, titulo: true, fechaLimite: true, duracion: true, tipo: true,
          clase: {
            select: {
              planEstudio: { select: { materia: { select: { nombre: true } } } },
              seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
            },
          },
        },
      }),
    ]);
    const totalAlumnos = clases.reduce((acc, c) => acc + (c.seccion?._count?.matriculas ?? 0), 0);
    return (
      <div>
        <div className="page-header">
          <h1>Bienvenido, {usuario.nombre.split(" ")[0]}</h1>
          <p>Resumen de tu actividad docente</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 36 }}>
          <StatCard icon={<IconClass size={22} />} value={clases.length} label="Mis clases" color="var(--accent2)" href="/clases" />
          <StatCard icon={<IconStudent size={22} />} value={totalAlumnos} label="Alumnos a cargo" color="var(--accent3)" />
          <StatCard icon={<IconTask size={22} />} value={tareas} label="Tareas creadas" color="var(--green)" href="/tareas" />
          <StatCard icon={<IconExam size={22} />} value={examenes.length} label="Exámenes próximos" color="var(--accent)" href="/examenes" />
        </div>
        {examenes.length > 0 && (
          <><h2 className="section-title">Próximos exámenes</h2>
          <div className="card-grid">
            {examenes.map((e) => (
              <div className="info-card" key={e.id}>
                <div className="info-card-title">{e.titulo}</div>
                <div className="info-card-meta">
                  <span style={{ color: "var(--accent2)", fontWeight: 500 }}>{e.clase.planEstudio.materia.nombre}</span>
                  <span>{e.clase.seccion.grado.nombre} "{e.clase.seccion.nombre}"</span>
                  <span><IconClock size={13} /> {formatDateTime(e.fechaLimite)}</span>
                </div>
              </div>
            ))}
          </div></>
        )}
      </div>
    );
  }

  if (usuario.rol === "ALUMNO" && usuario.alumno) {
    const anoActivo = await prisma.anoLectivo.findFirst({ where: { activo: true }, select: { id: true } });
    const matriculaActiva = anoActivo ? await prisma.matricula.findUnique({
      where: { alumnoId_anoLectivoId: { alumnoId: usuario.alumno.id, anoLectivoId: anoActivo.id } },
      select: {
        estado: true, seccionId: true,
        seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
      },
    }) : null;
    const seccionId = matriculaActiva?.seccionId ?? null;
    const [clases, tareasPendientes, proximoExamen] = await Promise.all([
      seccionId ? prisma.clase.count({ where: { seccionId } }) : Promise.resolve(0),
      prisma.entrega.count({ where: { alumnoId: usuario.alumno.id, estado: "PENDIENTE" } }),
      seccionId ? prisma.examen.findFirst({
        where: { clase: { seccionId }, fechaLimite: { gte: nowPeru() } },
        orderBy: { fechaLimite: "asc" },
        select: {
          id: true, titulo: true, fechaLimite: true, duracion: true,
          clase: {
            select: {
              planEstudio: { select: { materia: { select: { nombre: true } } } },
              seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
            },
          },
        },
      }) : Promise.resolve(null),
    ]);
    return (
      <div>
        <div className="page-header">
          <h1>Bienvenido, {usuario.nombre.split(" ")[0]}</h1>
          <p>{matriculaActiva?.seccion ? `${matriculaActiva.seccion.grado.nombre} "${matriculaActiva.seccion.nombre}"` : "Sin sección asignada este año"}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 36 }}>
          <StatCard icon={<IconClass size={22} />} value={clases} label="Mis cursos" color="var(--accent2)" href="/clases" />
          <StatCard icon={<IconTask size={22} />} value={tareasPendientes} label="Tareas pendientes" color="var(--accent)" href="/tareas" />
          <StatCard icon={<IconCard size={22} />} value={matriculaActiva?.estado === "PAGADO" ? 1 : 0} label="Matrícula al día" color="var(--green)" href="/matriculas" />
        </div>
        {proximoExamen && (
          <><h2 className="section-title">Próximo examen</h2>
          <div style={{ maxWidth: 400 }}>
            <div className="info-card">
              <div className="info-card-title">{proximoExamen.titulo}</div>
              <div className="info-card-meta">
                <span style={{ color: "var(--accent2)", fontWeight: 500 }}>{proximoExamen.clase.planEstudio.materia.nombre}</span>
                <span><IconClock size={13} /> {formatDateTime(proximoExamen.fechaLimite)}</span>
                <span>{proximoExamen.duracion} min</span>
              </div>
              <div style={{ marginTop: 14 }}>
                <Link href="/examenes" className="btn btn-primary btn-sm" style={{ textDecoration: "none", display: "inline-flex" }}>Ver examen</Link>
              </div>
            </div>
          </div></>
        )}
      </div>
    );
  }

  redirect("/sign-in");
}
