// Centralized runtime env reader for the web app.
export const env = {
  get apiBaseUrl() {
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.zos.zlaark.com';
  },
  get appName() { return process.env.NEXT_PUBLIC_APP_NAME ?? 'Agency Panel'; },
} as const;
