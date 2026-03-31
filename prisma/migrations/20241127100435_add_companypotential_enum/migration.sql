/*
  Warnings:

  - Added the required column `companyPotential` to the `Company` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CompanyPotential" AS ENUM ('AVAILABE_EQUIPMENT', 'CONCLUSION', 'PROJECT_STUDY', 'NEUTRAL', 'MATERIAL_REQUEST', 'NEGOTIATION');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "companyPotential" "CompanyPotential" NOT NULL;
