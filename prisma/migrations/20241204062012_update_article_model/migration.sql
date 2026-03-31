-- DropForeignKey
ALTER TABLE "Article" DROP CONSTRAINT "Article_companyId_fkey";

-- AlterTable
ALTER TABLE "Article" ALTER COLUMN "companyId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
