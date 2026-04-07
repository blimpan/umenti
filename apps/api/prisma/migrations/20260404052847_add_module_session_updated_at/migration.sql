-- AlterTable: add updatedAt with NOW() as default for existing rows, then make it NOT NULL
ALTER TABLE "ModuleSession" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "ModuleSession" ALTER COLUMN "updatedAt" DROP DEFAULT;
