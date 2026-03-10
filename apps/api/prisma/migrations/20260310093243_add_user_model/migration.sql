-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TEACHER', 'STUDENT');

-- CreateTable
CREATE TABLE "User" (
    "supabaseId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("supabaseId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
