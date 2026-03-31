/*
  Warnings:

  - You are about to drop the column `temporaryPassword` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `verficationCode` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `verificationDate` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "temporaryPassword",
DROP COLUMN "verficationCode",
DROP COLUMN "verificationDate";
