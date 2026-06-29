/*
  Warnings:

  - You are about to drop the column `tipo` on the `Examen` table. All the data in the column will be lost.
  - You are about to drop the column `orden` on the `Grado` table. All the data in the column will be lost.
  - You are about to drop the column `orden` on the `Nivel` table. All the data in the column will be lost.
  - You are about to drop the column `enviado` on the `RespuestaExamen` table. All the data in the column will be lost.
  - You are about to drop the `PreguntaExamen` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RespuestaPregunta` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `anoIngreso` to the `Alumno` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EstadoRespuestaExamen" AS ENUM ('PENDIENTE', 'ENTREGADO', 'CALIFICADO', 'FUERA_DE_PLAZO');

-- DropForeignKey
ALTER TABLE "PreguntaExamen" DROP CONSTRAINT "PreguntaExamen_examenId_fkey";

-- DropForeignKey
ALTER TABLE "RespuestaPregunta" DROP CONSTRAINT "RespuestaPregunta_preguntaId_fkey";

-- DropForeignKey
ALTER TABLE "RespuestaPregunta" DROP CONSTRAINT "RespuestaPregunta_respuestaExamenId_fkey";

-- AlterTable
ALTER TABLE "Alumno" ADD COLUMN "anoIngreso" INTEGER NOT NULL DEFAULT 2026;

-- AlterTable
ALTER TABLE "Carrera" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Entrega" ADD COLUMN     "archivoNombre" TEXT,
ADD COLUMN     "archivoUrl" TEXT;

-- AlterTable
ALTER TABLE "Examen" DROP COLUMN "tipo",
ADD COLUMN     "archivoNombre" TEXT,
ADD COLUMN     "archivoUrl" TEXT;

-- AlterTable
ALTER TABLE "Grado" DROP COLUMN "orden";

-- AlterTable
ALTER TABLE "Nivel" DROP COLUMN "orden",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "RespuestaExamen" DROP COLUMN "enviado",
ADD COLUMN     "archivoNombre" TEXT,
ADD COLUMN     "archivoUrl" TEXT,
ADD COLUMN     "comentario" TEXT,
ADD COLUMN     "estado" "EstadoRespuestaExamen" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "fechaEntrega" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Seccion" ADD COLUMN     "anoLectivo" INTEGER;

-- AlterTable
ALTER TABLE "Tarea" ADD COLUMN     "archivoNombre" TEXT,
ADD COLUMN     "archivoUrl" TEXT;

-- DropTable
DROP TABLE "PreguntaExamen";

-- DropTable
DROP TABLE "RespuestaPregunta";

-- DropEnum
DROP TYPE "TipoExamen";

-- CreateIndex
CREATE INDEX "Alumno_seccionId_idx" ON "Alumno"("seccionId");

-- CreateIndex
CREATE INDEX "Alumno_anoIngreso_idx" ON "Alumno"("anoIngreso");

-- CreateIndex
CREATE INDEX "Clase_seccionId_idx" ON "Clase"("seccionId");

-- CreateIndex
CREATE INDEX "Clase_profesorId_idx" ON "Clase"("profesorId");

-- CreateIndex
CREATE INDEX "Examen_claseId_idx" ON "Examen"("claseId");

-- CreateIndex
CREATE INDEX "Examen_profesorId_idx" ON "Examen"("profesorId");

-- CreateIndex
CREATE INDEX "Tarea_claseId_idx" ON "Tarea"("claseId");

-- CreateIndex
CREATE INDEX "Tarea_profesorId_idx" ON "Tarea"("profesorId");

-- CreateIndex
CREATE INDEX "Tarea_estado_idx" ON "Tarea"("estado");
