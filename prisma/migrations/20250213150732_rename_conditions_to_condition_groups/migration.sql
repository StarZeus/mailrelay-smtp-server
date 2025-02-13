/*
  Warnings:

  - You are about to drop the column `conditions` on the `EmailRule` table. All the data in the column will be lost.
  - Added the required column `conditionGroups` to the `EmailRule` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmailRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "conditionGroups" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_EmailRule" ("action", "createdAt", "id", "isActive", "name") SELECT "action", "createdAt", "id", "isActive", "name" FROM "EmailRule";
DROP TABLE "EmailRule";
ALTER TABLE "new_EmailRule" RENAME TO "EmailRule";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
