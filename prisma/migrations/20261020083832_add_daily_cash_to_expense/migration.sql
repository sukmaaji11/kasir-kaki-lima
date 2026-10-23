-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "dailyCashId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_dailyCashId_idx" ON "Expense"("dailyCashId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_businessId_outletId_dailyCashId_fkey" FOREIGN KEY ("businessId", "outletId", "dailyCashId") REFERENCES "DailyCash"("businessId", "outletId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
