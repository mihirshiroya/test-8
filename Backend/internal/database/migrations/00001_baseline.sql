-- Baseline schema, identical to what Prisma generated from schema.prisma.
-- Every statement is idempotent so this applies cleanly both to an empty
-- database and to one previously created by `prisma migrate` / `db push`
-- (it only fills in whatever is missing, e.g. newer columns).

-- +goose Up
-- +goose StatementBegin
DO $$ BEGIN CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ActivityType" AS ENUM ('TASK_CREATED', 'TASK_COMPLETED', 'TASK_STARTED', 'TASK_UPDATED', 'TASK_DELETED', 'SESSION_STARTED', 'SESSION_COMPLETED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'DEADLINE_CHANGED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'MODERATOR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ContentType" AS ENUM ('text', 'code'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "NoteTint" AS ENUM ('blue', 'violet', 'pink', 'amber', 'emerald', 'rose', 'cyan', 'lime'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "NoteIcon" AS ENUM ('folder', 'doc', 'image', 'star', 'work', 'heart', 'code', 'music', 'rocket', 'camera'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "googleId" TEXT,
    "avatar" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "emailVerificationToken" TEXT,
    "totalFocusHours" INTEGER NOT NULL DEFAULT 0,
    "pfpFrame" TEXT NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totalFocusHours" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pfpFrame" TEXT NOT NULL DEFAULT 'none';

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "workspaces" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tint" TEXT NOT NULL DEFAULT 'lavender',
    "icon" TEXT NOT NULL DEFAULT 'folder',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL,
    "priority" "TaskPriority" NOT NULL,
    "position" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "deadlineDate" TIMESTAMP(3),
    "plannedDurationSeconds" INTEGER NOT NULL DEFAULT 0,
    "actualDurationSeconds" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "task_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "task_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "daily_analytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analyticsDate" DATE NOT NULL,
    "createdTaskCount" INTEGER NOT NULL DEFAULT 0,
    "completedTaskCount" INTEGER NOT NULL DEFAULT 0,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "totalFocusSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "daily_analytics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "daily_activities" (
    "id" TEXT NOT NULL,
    "dailyAnalyticsId" TEXT NOT NULL,
    "taskId" TEXT,
    "type" "ActivityType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tint" "NoteTint" NOT NULL DEFAULT 'blue',
    "icon" "NoteIcon" NOT NULL DEFAULT 'folder',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "topics" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "subtopics" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subtopics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "contents" (
    "id" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "content" TEXT NOT NULL,
    "language" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "users"("googleId");
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE INDEX IF NOT EXISTS "workspaces_userId_idx" ON "workspaces"("userId");
CREATE INDEX IF NOT EXISTS "tasks_userId_idx" ON "tasks"("userId");
CREATE INDEX IF NOT EXISTS "tasks_workspaceId_idx" ON "tasks"("workspaceId");
CREATE INDEX IF NOT EXISTS "tasks_userId_status_idx" ON "tasks"("userId", "status");
CREATE INDEX IF NOT EXISTS "tasks_workspaceId_status_idx" ON "tasks"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "tasks_userId_deadlineDate_idx" ON "tasks"("userId", "deadlineDate");
CREATE INDEX IF NOT EXISTS "tasks_workspaceId_deadlineDate_idx" ON "tasks"("workspaceId", "deadlineDate");
CREATE INDEX IF NOT EXISTS "task_sessions_userId_idx" ON "task_sessions"("userId");
CREATE INDEX IF NOT EXISTS "task_sessions_taskId_idx" ON "task_sessions"("taskId");
CREATE INDEX IF NOT EXISTS "task_sessions_userId_startedAt_idx" ON "task_sessions"("userId", "startedAt");
CREATE INDEX IF NOT EXISTS "task_sessions_taskId_startedAt_idx" ON "task_sessions"("taskId", "startedAt");
CREATE INDEX IF NOT EXISTS "daily_analytics_userId_idx" ON "daily_analytics"("userId");
CREATE INDEX IF NOT EXISTS "daily_analytics_userId_analyticsDate_idx" ON "daily_analytics"("userId", "analyticsDate");
CREATE UNIQUE INDEX IF NOT EXISTS "daily_analytics_userId_analyticsDate_key" ON "daily_analytics"("userId", "analyticsDate");
CREATE INDEX IF NOT EXISTS "daily_activities_dailyAnalyticsId_idx" ON "daily_activities"("dailyAnalyticsId");
CREATE INDEX IF NOT EXISTS "daily_activities_taskId_idx" ON "daily_activities"("taskId");
CREATE INDEX IF NOT EXISTS "daily_activities_dailyAnalyticsId_type_idx" ON "daily_activities"("dailyAnalyticsId", "type");
CREATE INDEX IF NOT EXISTS "notes_userId_idx" ON "notes"("userId");
CREATE INDEX IF NOT EXISTS "topics_noteId_idx" ON "topics"("noteId");
CREATE INDEX IF NOT EXISTS "subtopics_topicId_idx" ON "subtopics"("topicId");
CREATE INDEX IF NOT EXISTS "contents_subtopicId_idx" ON "contents"("subtopicId");

DO $$ BEGIN ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "task_sessions" ADD CONSTRAINT "task_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "task_sessions" ADD CONSTRAINT "task_sessions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "daily_analytics" ADD CONSTRAINT "daily_analytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "daily_activities" ADD CONSTRAINT "daily_activities_dailyAnalyticsId_fkey" FOREIGN KEY ("dailyAnalyticsId") REFERENCES "daily_analytics"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "daily_activities" ADD CONSTRAINT "daily_activities_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "notes" ADD CONSTRAINT "notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "topics" ADD CONSTRAINT "topics_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "subtopics" ADD CONSTRAINT "subtopics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "contents" ADD CONSTRAINT "contents_subtopicId_fkey" FOREIGN KEY ("subtopicId") REFERENCES "subtopics"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- +goose StatementEnd

-- +goose Down
-- The baseline is intentionally irreversible: rolling it back would drop all data.
SELECT 1;
