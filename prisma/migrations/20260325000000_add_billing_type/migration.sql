-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('ONE_TIME', 'ONGOING');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "billingType" "BillingType" NOT NULL DEFAULT 'ONE_TIME';
