/*
  Warnings:

  - You are about to drop the column `companyType` on the `Company` table. All the data in the column will be lost.
  - Added the required column `companyTypeId` to the `Company` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Company" DROP COLUMN "companyType",
ADD COLUMN     "companyTypeId" INTEGER NOT NULL;

-- DropEnum
DROP TYPE "CompanyType";

-- CreateTable
CREATE TABLE "CompanyType" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CompanyType_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_companyTypeId_fkey" FOREIGN KEY ("companyTypeId") REFERENCES "CompanyType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
