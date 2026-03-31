-- DropForeignKey
ALTER TABLE "Action" DROP CONSTRAINT "Action_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Article" DROP CONSTRAINT "Article_companyId_fkey";

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
