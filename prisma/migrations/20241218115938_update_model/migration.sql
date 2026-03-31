/*
  Warnings:

  - You are about to drop the column `companyPotentialOrder` on the `CompanyPotentialUpdateLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CompanyPotentialUpdateLog" DROP COLUMN "companyPotentialOrder",
ALTER COLUMN "time" SET DEFAULT 0;
