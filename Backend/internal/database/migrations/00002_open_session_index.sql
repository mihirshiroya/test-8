-- Every authenticated kanban request looks up the user's running session
-- ("endedAt" IS NULL). A partial index keeps that lookup O(1) regardless of
-- how much session history a user accumulates.

-- +goose Up
CREATE INDEX IF NOT EXISTS "task_sessions_open_userId_idx" ON "task_sessions"("userId") WHERE "endedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "task_sessions_open_taskId_idx" ON "task_sessions"("taskId") WHERE "endedAt" IS NULL;

-- +goose Down
DROP INDEX IF EXISTS "task_sessions_open_userId_idx";
DROP INDEX IF EXISTS "task_sessions_open_taskId_idx";
