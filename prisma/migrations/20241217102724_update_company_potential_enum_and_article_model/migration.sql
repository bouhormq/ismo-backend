/*
  Warnings:

  - The values [AVAILABE_EQUIPMENT] on the enum `CompanyPotential` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CompanyPotential_new" AS ENUM ('AVAILABLE_EQUIPMENT', 'CONCLUSION', 'PROJECT_STUDY', 'NEUTRAL', 'MATERIAL_REQUEST', 'NEGOTIATION');
ALTER TABLE "Company" ALTER COLUMN "companyPotential" TYPE "CompanyPotential_new" USING ("companyPotential"::text::"CompanyPotential_new");
ALTER TYPE "CompanyPotential" RENAME TO "CompanyPotential_old";
ALTER TYPE "CompanyPotential_new" RENAME TO "CompanyPotential";
DROP TYPE "CompanyPotential_old";
COMMIT;

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "isCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showOnWebsite" BOOLEAN NOT NULL DEFAULT false;
