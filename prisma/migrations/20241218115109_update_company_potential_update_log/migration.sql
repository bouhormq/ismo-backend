/*
  Warnings:

  - A unique constraint covering the columns `[companyId,companyPotential]` on the table `CompanyPotentialUpdateLog` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `time` to the `CompanyPotentialUpdateLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CompanyPotentialUpdateLog" ADD COLUMN     "time" BIGINT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPotentialUpdateLog_companyId_companyPotential_key" ON "CompanyPotentialUpdateLog"("companyId", "companyPotential");
