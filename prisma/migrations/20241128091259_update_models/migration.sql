/*
  Warnings:

  - You are about to drop the column `companyId` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `companyId` on the `DesiredItem` table. All the data in the column will be lost.
  - You are about to drop the column `companyId` on the `Industry` table. All the data in the column will be lost.
  - You are about to drop the column `companyId` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `companyId` on the `UsedItem` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_companyId_fkey";

-- DropForeignKey
ALTER TABLE "DesiredItem" DROP CONSTRAINT "DesiredItem_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Industry" DROP CONSTRAINT "Industry_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Section" DROP CONSTRAINT "Section_companyId_fkey";

-- DropForeignKey
ALTER TABLE "UsedItem" DROP CONSTRAINT "UsedItem_companyId_fkey";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "DesiredItem" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "Industry" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "Section" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "UsedItem" DROP COLUMN "companyId";

-- CreateTable
CREATE TABLE "_CompanyToIndustry" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_CompanyToSection" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_CompanyToUsedItem" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_CompanyToDesiredItem" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_CategoryToCompany" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_CompanyToIndustry_AB_unique" ON "_CompanyToIndustry"("A", "B");

-- CreateIndex
CREATE INDEX "_CompanyToIndustry_B_index" ON "_CompanyToIndustry"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CompanyToSection_AB_unique" ON "_CompanyToSection"("A", "B");

-- CreateIndex
CREATE INDEX "_CompanyToSection_B_index" ON "_CompanyToSection"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CompanyToUsedItem_AB_unique" ON "_CompanyToUsedItem"("A", "B");

-- CreateIndex
CREATE INDEX "_CompanyToUsedItem_B_index" ON "_CompanyToUsedItem"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CompanyToDesiredItem_AB_unique" ON "_CompanyToDesiredItem"("A", "B");

-- CreateIndex
CREATE INDEX "_CompanyToDesiredItem_B_index" ON "_CompanyToDesiredItem"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CategoryToCompany_AB_unique" ON "_CategoryToCompany"("A", "B");

-- CreateIndex
CREATE INDEX "_CategoryToCompany_B_index" ON "_CategoryToCompany"("B");

-- AddForeignKey
ALTER TABLE "_CompanyToIndustry" ADD CONSTRAINT "_CompanyToIndustry_A_fkey" FOREIGN KEY ("A") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyToIndustry" ADD CONSTRAINT "_CompanyToIndustry_B_fkey" FOREIGN KEY ("B") REFERENCES "Industry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyToSection" ADD CONSTRAINT "_CompanyToSection_A_fkey" FOREIGN KEY ("A") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyToSection" ADD CONSTRAINT "_CompanyToSection_B_fkey" FOREIGN KEY ("B") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyToUsedItem" ADD CONSTRAINT "_CompanyToUsedItem_A_fkey" FOREIGN KEY ("A") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyToUsedItem" ADD CONSTRAINT "_CompanyToUsedItem_B_fkey" FOREIGN KEY ("B") REFERENCES "UsedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyToDesiredItem" ADD CONSTRAINT "_CompanyToDesiredItem_A_fkey" FOREIGN KEY ("A") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyToDesiredItem" ADD CONSTRAINT "_CompanyToDesiredItem_B_fkey" FOREIGN KEY ("B") REFERENCES "DesiredItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToCompany" ADD CONSTRAINT "_CategoryToCompany_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToCompany" ADD CONSTRAINT "_CategoryToCompany_B_fkey" FOREIGN KEY ("B") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
