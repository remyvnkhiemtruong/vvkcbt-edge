import pg from 'pg';

const password = process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD ?? '';
const host = process.env.PGHOST ?? '127.0.0.1';
const port = Number(process.env.PGPORT ?? '5432');
const user = process.env.PGUSER ?? 'postgres';
const database = process.env.PGDATABASE ?? 'postgres';

const client = new pg.Client({ host, port, user, password, database });

try {
  await client.connect();

  const roleRes = await client.query(
    "SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'vnu'",
  );
  if (roleRes.rowCount === 0) {
    await client.query("CREATE ROLE vnu LOGIN PASSWORD 'vnu_secret'");
  } else {
    await client.query("ALTER ROLE vnu WITH PASSWORD 'vnu_secret'");
  }

  const dbRes = await client.query(
    "SELECT 1 FROM pg_catalog.pg_database WHERE datname = 'vnu_exam'",
  );
  if (dbRes.rowCount === 0) {
    await client.query('CREATE DATABASE vnu_exam OWNER vnu');
  }

  await client.query('GRANT ALL PRIVILEGES ON DATABASE vnu_exam TO vnu');

  console.log('Database vnu_exam ready.');
} catch (e) {
  const msg = e?.message ?? String(e);
  console.error(msg);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
