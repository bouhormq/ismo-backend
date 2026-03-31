/*
  Warnings:

  - You are about to drop the column `categoryId` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `industryId` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `sectionId` on the `Article` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Article" DROP CONSTRAINT "Article_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Article" DROP CONSTRAINT "Article_industryId_fkey";

-- DropForeignKey
ALTER TABLE "Article" DROP CONSTRAINT "Article_sectionId_fkey";

-- AlterTable
ALTER TABLE "Article" DROP COLUMN "categoryId",
DROP COLUMN "industryId",
DROP COLUMN "sectionId";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "articleId" INTEGER;

-- AlterTable
ALTER TABLE "Industry" ADD COLUMN     "articleId" INTEGER;

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "articleId" INTEGER;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Industry" ADD CONSTRAINT "Industry_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
