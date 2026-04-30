// Centralized runtime env reader for the web app.
// Values are read lazily (via getters) so module evaluation never throws during Next.js
// static-generation passes — only actual runtime access will throw if the var is missing.
const required = (key: string): string => {
  const v = process.env[key];
  if (!v || v.length === 0) throw new Error(`[env] missing required env: ${key}`);
  return v;
};

export const env = {
  get apiBaseUrl() { return required('NEXT_PUBLIC_API_BASE_URL'); },
  get appName() { return process.env.NEXT_PUBLIC_APP_NAME ?? 'Agency Panel'; },
} as const;
