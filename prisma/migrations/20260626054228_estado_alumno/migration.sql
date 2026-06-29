-- CreateEnum
CREATE TYPE "EstadoAlumno" AS ENUM ('ACTIVO', 'EGRESADO', 'RETIRADO');

-- AlterTable
ALTER TABLE "Alumno" ADD COLUMN     "estado" "EstadoAlumno" NOT NULL DEFAULT 'ACTIVO';

-- CreateIndex
CREATE INDEX "Alumno_estado_idx" ON "Alumno"("estado");
