-- VVKCBT native database bootstrap (role only; database via init-native-db.mjs)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'vnu') THEN
    CREATE ROLE vnu LOGIN PASSWORD 'vnu_secret';
  ELSE
    ALTER ROLE vnu WITH PASSWORD 'vnu_secret';
  END IF;
END
$$;

-- CREATE DATABASE cannot run inside DO blocks. Use:
--   node scripts/sql/init-native-db.mjs
