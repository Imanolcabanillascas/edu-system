# EduAdmin — Sistema de Gestión Escolar

Sistema completo con login propio (email + contraseña) para **Administrador**, **Profesor** y **Alumno**. Construido con Next.js, Prisma, PostgreSQL (Neon), NextAuth y Vercel Blob Storage.

## Funcionalidades

**Estructura académica**
- Niveles fijos (Primaria, Secundaria, Superior) con **nombre editable**
- Carreras (solo en Superior, ej. Enfermería con sus ciclos)
- Primaria/Secundaria: Grados con **Secciones** tradicionales (A, B, C), reutilizadas año tras año
- Superior: Ciclos con **Periodos de ingreto** con código (ej. "2026-I", "2026-II") — cada ciclo de matrícula es un periodo nuevo, no hay secciones A/B/C
- Materias específicas por grado, con uno o varios profesores asignados
- Cada alumno registra su **año de ingreso** (`anoIngreso`), usado para filtrar el dashboard y para elegir automáticamente los periodos disponibles en Superior

**Profesores**
- DNI, teléfono, materias que dicta (selección múltiple de materias existentes)
- Botón "Generar PDF" con su horario de clases y los alumnos de cada aula asignada (PDF generado en memoria con `pdf-lib`, sin Chromium — bajo consumo de CPU/RAM, solo se ejecuta al presionar el botón)

**Alumnos**
- DNI, sección (vía selector en cascada Nivel → Carrera → Grado → Sección), fecha de nacimiento
- Datos del tutor/apoderado: DNI, nombre completo y teléfono

**Tareas y exámenes**
- El profesor sube el enunciado como **archivo PDF/imagen** y/o lo describe en texto
- Fecha/hora de **inicio** y fecha/hora **límite** (zona horaria de Perú, America/Lima)
- El alumno entrega su respuesta subiendo un **archivo PDF/imagen**
- Entregas fuera de plazo se marcan automáticamente como "Fuera de plazo"
- El profesor califica manualmente cada entrega (nota 0-20 + comentario)
- Los archivos se almacenan en **Vercel Blob Storage** — la base de datos solo guarda la URL (texto corto), manteniendo las consultas rápidas y livianas

**Matrículas**
- Búsqueda de alumno **por DNI** antes de matricular
- Selección del **medio de pago** (efectivo, transferencia, tarjeta, Yape, Plin, otro)
- Filtro rápido de **matrículas vencidas**, calculado según la hora actual de Perú

**Diseño**
- Iconografía SVG propia (sin emojis, sin librerías de iconos externas — peso mínimo)
- Responsive: sidebar colapsable en móvil, formularios y tarjetas adaptados a pantallas pequeñas

---

## 1. Instalación local

```bash
npm install
cp .env.example .env
```

Completa `.env` con:
- `DATABASE_URL` de Neon
- `NEXTAUTH_SECRET` (genera uno con `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
- `BLOB_READ_WRITE_TOKEN` (ver paso 2)

## 2. Configurar Vercel Blob Storage

1. Ve a https://vercel.com/dashboard, entra a tu proyecto (o créalo vacío primero)
2. Pestaña **Storage** → **Create Database** → **Blob**
3. Una vez creado, copia el token `BLOB_READ_WRITE_TOKEN` que te muestra y pégalo en tu `.env` local
4. Este mismo token se inyecta automáticamente en producción cuando conectas el Blob Store a tu proyecto de Vercel

## 3. Base de datos

```bash
npx prisma migrate dev --name init
npx prisma generate
```

## 4. Ejecutar en local

```bash
npm run dev
```

Regístrate en `/sign-up` — el primer usuario se vuelve **Administrador** automáticamente.

---

## 5. Subir a GitHub

```bash
git init
git add .
git commit -m "feat: sistema EduAdmin completo"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/eduadmin.git
git push -u origin main
```

---

## 6. Desplegar en Vercel

### 6.1 Importar el proyecto

1. Ve a https://vercel.com → **"Add New" → "Project"**
2. Selecciona el repositorio `eduadmin` e impórtalo

### 6.2 Variables de entorno

Antes de desplegar, en **Environment Variables** agrega:

```
DATABASE_URL=postgresql://usuario:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
NEXTAUTH_SECRET=el_mismo_secreto_largo_que_usaste_en_local
NEXTAUTH_URL=https://tu-proyecto.vercel.app
```

`BLOB_READ_WRITE_TOKEN` se agrega automáticamente cuando conectas el Blob Store al proyecto (paso 6.4) — no es necesario pegarlo a mano si lo conectas así.

> ⚠️ No conoces la URL final hasta el primer deploy. Despliega una vez, copia la URL (`https://eduadmin-xxxx.vercel.app`), actualiza `NEXTAUTH_URL` en Settings → Environment Variables, y vuelve a desplegar.

### 6.3 Build Command

En **Project Settings → Build & Development Settings**:

```
prisma generate && prisma migrate deploy && next build
```

### 6.4 Conectar el Blob Store al proyecto

**Storage** (en el proyecto de Vercel) → selecciona tu Blob Store → **Connect Project** → elige `eduadmin`. Esto inyecta `BLOB_READ_WRITE_TOKEN` automáticamente en producción.

### 6.5 Deploy y deploys automáticos

Clic en **Deploy**. A partir de ahí, cada `git push` a `main` genera un nuevo deploy.

---

## Por qué este stack consume pocos recursos

- **Archivos en Vercel Blob, no en Postgres**: la base de datos nunca recibe binarios, solo URLs cortas — consultas e índices se mantienen rápidos incluso con miles de tareas/exámenes.
- **Consultas con `select` explícito**: cada endpoint pide solo los campos que la pantalla necesita, no objetos completos con todas sus relaciones.
- **Índices en columnas de filtrado frecuente** (`claseId`, `profesorId`, `seccionId`, `estado`) para acelerar los listados.
- **PDF de horario generado con `pdf-lib`** en memoria, sin navegador headless, solo al solicitarse.
- **Sin polling**: las páginas cargan datos una vez al entrar.
- **Funciones serverless de Vercel** + **Neon** que escala a cero en inactividad.

## Comandos útiles

```bash
npm run dev                # desarrollo local
npx prisma studio           # ver/editar datos visualmente
npx prisma migrate dev      # nueva migración en desarrollo
npx prisma migrate deploy   # aplicar migraciones en producción (Vercel lo hace automático)
```

## Notas

- El primer usuario registrado es **ADMIN** automáticamente.
- Al crear un Profesor/Alumno desde el panel, el Admin define directamente su contraseña inicial (editable después).
- Las fechas de vencimiento, entregas y exámenes se evalúan según la hora de **Perú (America/Lima, UTC-5)**.
- El orden de Niveles/Carreras/Grados/Secciones en las listas sigue siempre el orden de creación — no hay campo de orden manual.
