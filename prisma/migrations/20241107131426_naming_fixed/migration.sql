/*
  Warnings:

  - You are about to drop the column `customerId` on the `Action` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `AxonautLink` table. All the data in the column will be lost.
  - You are about to drop the column `potential` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `EmailTracking` table. All the data in the column will be lost.
  - You are about to drop the `_CustomerToProduct` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Action" DROP CONSTRAINT "Action_customerId_fkey";

-- DropForeignKey
ALTER TABLE "AxonautLink" DROP CONSTRAINT "AxonautLink_customerId_fkey";

-- DropForeignKey
ALTER TABLE "EmailTracking" DROP CONSTRAINT "EmailTracking_customerId_fkey";

-- DropForeignKey
ALTER TABLE "_CustomerToProduct" DROP CONSTRAINT "_CustomerToProduct_A_fkey";

-- DropForeignKey
ALTER TABLE "_CustomerToProduct" DROP CONSTRAINT "_CustomerToProduct_B_fkey";

-- AlterTable
ALTER TABLE "Action" DROP COLUMN "customerId";

-- AlterTable
ALTER TABLE "AxonautLink" DROP COLUMN "customerId";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "potential";

-- AlterTable
ALTER TABLE "EmailTracking" DROP COLUMN "customerId";

-- DropTable
DROP TABLE "_CustomerToProduct";
