/*
  Warnings:

  - You are about to drop the column `companyId` on the `CompanyPotential` table. All the data in the column will be lost.
  - You are about to drop the column `companyId` on the `ContactOrigin` table. All the data in the column will be lost.
  - Added the required column `companyPotentialId` to the `Company` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contactOriginId` to the `Company` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CompanyPotential" DROP CONSTRAINT "CompanyPotential_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ContactOrigin" DROP CONSTRAINT "ContactOrigin_companyId_fkey";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "companyPotentialId" INTEGER NOT NULL,
ADD COLUMN     "contactOriginId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "CompanyPotential" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "ContactOrigin" DROP COLUMN "companyId";

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_companyPotentialId_fkey" FOREIGN KEY ("companyPotentialId") REFERENCES "CompanyPotential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_contactOriginId_fkey" FOREIGN KEY ("contactOriginId") REFERENCES "ContactOrigin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
