-- AlterTable
ALTER TABLE "Action" ADD COLUMN     "contactId" INTEGER;

-- CreateTable
CREATE TABLE "ActionContact" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ActionContact_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ActionContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
