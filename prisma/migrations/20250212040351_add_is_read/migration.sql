-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Email" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "text" TEXT,
    "html" TEXT,
    "attachments" JSONB,
    "headers" JSONB,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Email" ("attachments", "from", "headers", "html", "id", "receivedAt", "subject", "text", "to") SELECT "attachments", "from", "headers", "html", "id", "receivedAt", "subject", "text", "to" FROM "Email";
DROP TABLE "Email";
ALTER TABLE "new_Email" RENAME TO "Email";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
