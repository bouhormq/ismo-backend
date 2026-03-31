/*
  Warnings:

  - You are about to drop the column `customerId` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `CompanyPotential` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `ContactOrigin` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `Industry` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `Section` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_customerId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyPotential" DROP CONSTRAINT "CompanyPotential_customerId_fkey";

-- DropForeignKey
ALTER TABLE "ContactOrigin" DROP CONSTRAINT "ContactOrigin_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Industry" DROP CONSTRAINT "Industry_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Section" DROP CONSTRAINT "Section_customerId_fkey";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "customerId",
ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "CompanyPotential" DROP COLUMN "customerId",
ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "ContactOrigin" DROP COLUMN "customerId",
ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "Industry" DROP COLUMN "customerId",
ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "Section" DROP COLUMN "customerId",
ADD COLUMN     "companyId" INTEGER;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPotential" ADD CONSTRAINT "CompanyPotential_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactOrigin" ADD CONSTRAINT "ContactOrigin_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Industry" ADD CONSTRAINT "Industry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
