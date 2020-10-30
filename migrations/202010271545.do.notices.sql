CREATE TYPE notice_status AS ENUM (
  'available',
  'reserved',
  'used'
);

CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY NOT NULL DEFAULT GEN_RANDOM_UUID(),
  created_at DATE NOT NULL DEFAULT CURRENT_DATE,
  self_isolation_end_date DATE NOT NULL,
  status notice_status NOT NULL DEFAULT 'available'
);