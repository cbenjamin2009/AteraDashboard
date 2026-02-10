const requiredKeys = ["ATERA_API_KEY"] as const;

type RequiredKey = (typeof requiredKeys)[number];

type ServerEnv = Record<RequiredKey, string>;

let cachedEnv: ServerEnv | null = null;

function loadEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const env: Partial<ServerEnv> = {};
  for (const key of requiredKeys) {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    env[key] = value;
  }

  cachedEnv = env as ServerEnv;
  return cachedEnv;
}

export function getServerEnv(key: RequiredKey) {
  return loadEnv()[key];
}
