-- AlterTable
ALTER TABLE "Action" ADD COLUMN     "companyContactId" INTEGER;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_companyContactId_fkey" FOREIGN KEY ("companyContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
