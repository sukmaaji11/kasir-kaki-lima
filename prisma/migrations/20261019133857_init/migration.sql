-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('PCS', 'PORSI', 'GELAS', 'PAKET', 'LAINNYA');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'QRIS', 'TRANSFER');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('ACTIVE', 'VOID');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('MATERIAL_PURCHASE', 'OPERATING', 'OWNER_WITHDRAWAL', 'OTHER');

-- CreateEnum
CREATE TYPE "DailyCashStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('CASH_IN', 'CASH_OUT');

-- CreateEnum
CREATE TYPE "VoidRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "pinHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outlet" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outlet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutletAssignment" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutletAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "unit" "ProductUnit" NOT NULL DEFAULT 'PCS',
    "sellingPrice" DECIMAL(14,2) NOT NULL,
    "hpp" DECIMAL(14,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductHppHistory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "changedById" TEXT,
    "oldHpp" DECIMAL(14,2),
    "newHpp" DECIMAL(14,2),
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "ProductHppHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "dailyCashId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'ACTIVE',
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "hppSnapshot" DECIMAL(14,2),
    "lineTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "description" TEXT,
    "expenseAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCash" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "operationalDate" DATE NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL,
    "expectedClosingBalance" DECIMAL(14,2),
    "actualClosingBalance" DECIMAL(14,2),
    "status" "DailyCashStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "DailyCash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "dailyCashId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoidRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "reason" TEXT NOT NULL,
    "status" "VoidRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "VoidRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");

-- CreateIndex
CREATE INDEX "Membership_businessId_role_isActive_idx" ON "Membership"("businessId", "role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_businessId_key" ON "Membership"("userId", "businessId");

-- CreateIndex
CREATE INDEX "Outlet_businessId_isActive_idx" ON "Outlet"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Outlet_businessId_name_key" ON "Outlet"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Outlet_businessId_code_key" ON "Outlet"("businessId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Outlet_businessId_id_key" ON "Outlet"("businessId", "id");

-- CreateIndex
CREATE INDEX "OutletAssignment_outletId_isActive_idx" ON "OutletAssignment"("outletId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OutletAssignment_membershipId_outletId_key" ON "OutletAssignment"("membershipId", "outletId");

-- CreateIndex
CREATE INDEX "Product_businessId_outletId_isActive_idx" ON "Product"("businessId", "outletId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Product_outletId_name_key" ON "Product"("outletId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_outletId_id_key" ON "Product"("businessId", "outletId", "id");

-- CreateIndex
CREATE INDEX "ProductHppHistory_productId_changedAt_idx" ON "ProductHppHistory"("productId", "changedAt");

-- CreateIndex
CREATE INDEX "Sale_businessId_outletId_soldAt_status_idx" ON "Sale"("businessId", "outletId", "soldAt", "status");

-- CreateIndex
CREATE INDEX "Sale_dailyCashId_status_idx" ON "Sale"("dailyCashId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_outletId_transactionNumber_key" ON "Sale"("outletId", "transactionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_outletId_idempotencyKey_key" ON "Sale"("outletId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_businessId_outletId_id_key" ON "Sale"("businessId", "outletId", "id");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "Expense_businessId_outletId_expenseAt_idx" ON "Expense"("businessId", "outletId", "expenseAt");

-- CreateIndex
CREATE INDEX "Expense_businessId_outletId_category_expenseAt_idx" ON "Expense"("businessId", "outletId", "category", "expenseAt");

-- CreateIndex
CREATE INDEX "DailyCash_businessId_outletId_operationalDate_status_idx" ON "DailyCash"("businessId", "outletId", "operationalDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCash_outletId_operationalDate_key" ON "DailyCash"("outletId", "operationalDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCash_businessId_outletId_id_key" ON "DailyCash"("businessId", "outletId", "id");

-- CreateIndex
CREATE INDEX "CashMovement_dailyCashId_createdAt_idx" ON "CashMovement"("dailyCashId", "createdAt");

-- CreateIndex
CREATE INDEX "VoidRequest_businessId_outletId_status_requestedAt_idx" ON "VoidRequest"("businessId", "outletId", "status", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VoidRequest_businessId_outletId_saleId_key" ON "VoidRequest"("businessId", "outletId", "saleId");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outlet" ADD CONSTRAINT "Outlet_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletAssignment" ADD CONSTRAINT "OutletAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletAssignment" ADD CONSTRAINT "OutletAssignment_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessId_outletId_fkey" FOREIGN KEY ("businessId", "outletId") REFERENCES "Outlet"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductHppHistory" ADD CONSTRAINT "ProductHppHistory_businessId_outletId_productId_fkey" FOREIGN KEY ("businessId", "outletId", "productId") REFERENCES "Product"("businessId", "outletId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductHppHistory" ADD CONSTRAINT "ProductHppHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessId_outletId_fkey" FOREIGN KEY ("businessId", "outletId") REFERENCES "Outlet"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessId_outletId_dailyCashId_fkey" FOREIGN KEY ("businessId", "outletId", "dailyCashId") REFERENCES "DailyCash"("businessId", "outletId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_businessId_outletId_fkey" FOREIGN KEY ("businessId", "outletId") REFERENCES "Outlet"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCash" ADD CONSTRAINT "DailyCash_businessId_outletId_fkey" FOREIGN KEY ("businessId", "outletId") REFERENCES "Outlet"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCash" ADD CONSTRAINT "DailyCash_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCash" ADD CONSTRAINT "DailyCash_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_businessId_outletId_fkey" FOREIGN KEY ("businessId", "outletId") REFERENCES "Outlet"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_businessId_outletId_dailyCashId_fkey" FOREIGN KEY ("businessId", "outletId", "dailyCashId") REFERENCES "DailyCash"("businessId", "outletId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoidRequest" ADD CONSTRAINT "VoidRequest_businessId_outletId_fkey" FOREIGN KEY ("businessId", "outletId") REFERENCES "Outlet"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoidRequest" ADD CONSTRAINT "VoidRequest_businessId_outletId_saleId_fkey" FOREIGN KEY ("businessId", "outletId", "saleId") REFERENCES "Sale"("businessId", "outletId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoidRequest" ADD CONSTRAINT "VoidRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoidRequest" ADD CONSTRAINT "VoidRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
