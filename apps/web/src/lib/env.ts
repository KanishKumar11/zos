// Centralized runtime env reader for the web app. Throws at boot if a required key is missing.
const required = (key: string): string => {
  const v = process.env[key];
  if (!v || v.length === 0) throw new Error(`[env] missing required env: ${key}`);
  return v;
};

export const env = {
  apiBaseUrl: required('NEXT_PUBLIC_API_BASE_URL'),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Agency Panel',
} as const;
