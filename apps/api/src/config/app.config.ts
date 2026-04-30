// App-level configuration namespace.
import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  appUrl: string;
  webUrl: string;
}

export default registerAs<AppConfig>('app', () => ({
  nodeEnv: (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'],
  port: Number(process.env.PORT ?? 4000),
  appUrl: process.env.APP_URL ?? 'http://localhost:4000',
  webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
}));
