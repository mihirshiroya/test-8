-- Application-level settings shared by every client of this database (the
-- desktop app seeds defaults on first setup). Per-device preferences such as
-- shortcuts and window positions stay in the desktop app's local store.

-- +goose Up
CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" TEXT PRIMARY KEY,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "app_settings" ("key", "value") VALUES
  ('schema.initializedAt', to_jsonb(to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))),
  ('timer.completionNotification', 'true'::jsonb),
  ('timer.checkInIntervalSeconds', '120'::jsonb)
ON CONFLICT ("key") DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS "app_settings";
