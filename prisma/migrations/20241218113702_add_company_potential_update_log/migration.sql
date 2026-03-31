-- CreateTable
CREATE TABLE "CompanyPotentialUpdateLog" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyPotential" "CompanyPotential" NOT NULL,
    "companyPotentialOrder" INTEGER NOT NULL DEFAULT 0,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "CompanyPotentialUpdateLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CompanyPotentialUpdateLog" ADD CONSTRAINT "CompanyPotentialUpdateLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
