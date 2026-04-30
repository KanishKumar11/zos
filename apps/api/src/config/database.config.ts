// Database (MongoDB) connection config.
import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  uri: string;
}

export default registerAs<DatabaseConfig>('database', () => ({
  uri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/agency',
}));
