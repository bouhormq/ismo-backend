-- AlterTable
ALTER TABLE "Contact" ALTER COLUMN "functionality" DROP NOT NULL,
ALTER COLUMN "note" DROP NOT NULL,
ALTER COLUMN "hasWhatsapp" SET DEFAULT false;
