-- DropForeignKey
ALTER TABLE "Action" DROP CONSTRAINT "Action_userId_fkey";

-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_companyTypeId_fkey";

-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_contactOriginId_fkey";

-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_userId_fkey";

-- AlterTable
ALTER TABLE "Action" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "contactOriginId" DROP NOT NULL,
ALTER COLUMN "companyTypeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_companyTypeId_fkey" FOREIGN KEY ("companyTypeId") REFERENCES "CompanyType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_contactOriginId_fkey" FOREIGN KEY ("contactOriginId") REFERENCES "ContactOrigin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
