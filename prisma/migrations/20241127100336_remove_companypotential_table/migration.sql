/*
  Warnings:

  - You are about to drop the column `articleId` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `companyPotentialId` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `articleId` on the `Industry` table. All the data in the column will be lost.
  - You are about to drop the column `articleId` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the `CompanyPotential` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `categoryId` to the `Article` table without a default value. This is not possible if the table is not empty.
  - Added the required column `industryId` to the `Article` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sectionId` to the `Article` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_articleId_fkey";

-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_companyPotentialId_fkey";

-- DropForeignKey
ALTER TABLE "Industry" DROP CONSTRAINT "Industry_articleId_fkey";

-- DropForeignKey
ALTER TABLE "Section" DROP CONSTRAINT "Section_articleId_fkey";

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "categoryId" INTEGER NOT NULL,
ADD COLUMN     "industryId" INTEGER NOT NULL,
ADD COLUMN     "sectionId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "articleId";

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "companyPotentialId";

-- AlterTable
ALTER TABLE "Industry" DROP COLUMN "articleId";

-- AlterTable
ALTER TABLE "Section" DROP COLUMN "articleId";

-- DropTable
DROP TABLE "CompanyPotential";

-- DropEnum
DROP TYPE "Potential";

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
