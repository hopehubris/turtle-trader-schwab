-- CreateTable
CREATE TABLE "Trade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL DEFAULT 'long',
    "system" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'open',
    "broker" TEXT NOT NULL DEFAULT 'schwab',
    "entryDate" TEXT NOT NULL,
    "exitDate" TEXT,
    "exitReason" TEXT,
    "exitPrice" REAL,
    "unitCount" INTEGER NOT NULL DEFAULT 1,
    "currentStop" REAL,
    "totalShares" REAL NOT NULL,
    "avgEntryPrice" REAL NOT NULL,
    "dollarAmount" REAL NOT NULL,
    "pnl" REAL,
    "pnlPct" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TradeUnit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tradeId" INTEGER NOT NULL,
    "unitNumber" INTEGER NOT NULL,
    "entryDate" TEXT NOT NULL,
    "entryPrice" REAL NOT NULL,
    "shares" REAL NOT NULL,
    "atrAtEntry" REAL NOT NULL,
    "stopLoss" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeUnit_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "scanDate" TEXT NOT NULL,
    "system" INTEGER NOT NULL DEFAULT 1,
    "direction" TEXT NOT NULL DEFAULT 'long',
    "close" REAL,
    "dcEntryUpper" REAL,
    "dcEntryLower" REAL,
    "dcExitLower" REAL,
    "dcExitUpper" REAL,
    "atrValue" REAL,
    "entryBreakout" BOOLEAN NOT NULL DEFAULT false,
    "exitBreakout" BOOLEAN NOT NULL DEFAULT false,
    "unitAddSignal" BOOLEAN NOT NULL DEFAULT false,
    "stopTriggered" BOOLEAN NOT NULL DEFAULT false,
    "actionTaken" TEXT NOT NULL DEFAULT 'no_signal',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DailyPnL" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "equity" REAL NOT NULL,
    "dailyPnl" REAL NOT NULL DEFAULT 0,
    "cumulativePnl" REAL NOT NULL DEFAULT 0,
    "openPositionsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Config_key_key" ON "Config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPnL_date_key" ON "DailyPnL"("date");
