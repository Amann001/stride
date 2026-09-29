// Reads settings from environment variables (the .env file) and fails early if any are missing.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy apps/api/.env.example to apps/api/.env and fill it in.`);
  }
  return value;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  port: Number(process.env.PORT ?? 4000),
};
