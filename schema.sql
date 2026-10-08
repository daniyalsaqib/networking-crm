CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  city TEXT DEFAULT 'Lahore',
  area TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_area ON contacts (area);
CREATE INDEX IF NOT EXISTS idx_contacts_city ON contacts (city);

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT,
  image       TEXT DEFAULT '',
  provider    TEXT NOT NULL DEFAULT 'credentials',
  google_id   TEXT UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_contacts_user'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT fk_contacts_user
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts (user_id);
