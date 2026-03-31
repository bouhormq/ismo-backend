-- DropForeignKey
ALTER TABLE "CompanyPotentialUpdateLog" DROP CONSTRAINT "CompanyPotentialUpdateLog_companyId_fkey";

-- AddForeignKey
ALTER TABLE "CompanyPotentialUpdateLog" ADD CONSTRAINT "CompanyPotentialUpdateLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
