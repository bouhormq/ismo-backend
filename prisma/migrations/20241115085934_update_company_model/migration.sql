-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "activityDescription" TEXT;

-- CreateTable
CREATE TABLE "UsedItem" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" INTEGER,

    CONSTRAINT "UsedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesiredItem" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" INTEGER,

    CONSTRAINT "DesiredItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UsedItem" ADD CONSTRAINT "UsedItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesiredItem" ADD CONSTRAINT "DesiredItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
