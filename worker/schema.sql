-- Family Portal — access log schema (Cloudflare D1).
--
-- ts and ip_fingerprint stay plaintext so counts/graphs never require
-- decrypting anything. Everything identifying (real IP, city/region/country,
-- which group/section/item-kind) lives only inside the RSA-sealed `payload`,
-- readable solely by whoever holds the private key in src/log-key.json.

CREATE TABLE IF NOT EXISTS visits (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ts             TEXT NOT NULL,   -- ISO-8601 UTC
  ip_fingerprint TEXT NOT NULL,   -- HMAC-SHA256(secret, ip), hex — one-way, never reversible
  payload        TEXT NOT NULL    -- base64 RSA-OAEP-4096 ciphertext of the event JSON
);

CREATE INDEX IF NOT EXISTS idx_visits_ts ON visits(ts);
CREATE INDEX IF NOT EXISTS idx_visits_fp ON visits(ip_fingerprint);
