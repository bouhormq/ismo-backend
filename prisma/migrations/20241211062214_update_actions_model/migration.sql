/*
  Warnings:

  - You are about to drop the column `date` on the `Action` table. All the data in the column will be lost.
  - You are about to drop the column `actionId` on the `CalendarEvent` table. All the data in the column will be lost.
  - Added the required column `actionTypeId` to the `Action` table without a default value. This is not possible if the table is not empty.
  - Added the required column `alarmDate` to the `Action` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `Action` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endDate` to the `Action` table without a default value. This is not possible if the table is not empty.
  - Added the required column `object` to the `Action` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `Action` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Action` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Action` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "CalendarEvent" DROP CONSTRAINT "CalendarEvent_actionId_fkey";

-- AlterTable
ALTER TABLE "Action" DROP COLUMN "date",
ADD COLUMN     "actionTypeId" INTEGER NOT NULL,
ADD COLUMN     "alarmDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "companyId" INTEGER NOT NULL,
ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "isDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "object" TEXT NOT NULL,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" INTEGER NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CalendarEvent" DROP COLUMN "actionId";

-- DropEnum
DROP TYPE "ActionType";

-- CreateTable
CREATE TABLE "ActionType" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "ActionType_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_actionTypeId_fkey" FOREIGN KEY ("actionTypeId") REFERENCES "ActionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
