/*
  Warnings:

  - Made the column `alarmDate` on table `Action` required. This step will fail if there are existing NULL values in that column.
  - Made the column `endDate` on table `Action` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Action" ALTER COLUMN "alarmDate" SET NOT NULL,
ALTER COLUMN "endDate" SET NOT NULL;
