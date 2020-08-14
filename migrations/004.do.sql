CREATE TABLE IF NOT EXISTS verification_certificates (
  id SERIAL NOT NULL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  private_key TEXT NOT NULL,
  public_key TEXT NOT NULL
);
