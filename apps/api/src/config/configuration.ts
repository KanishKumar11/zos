// Aggregator that registers all config namespaces with @nestjs/config.
import appConfig from './app.config';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
import mailConfig from './mail.config';
import seedConfig from './seed.config';
import storageConfig from './storage.config';
import throttlerConfig from './throttler.config';

export const configurations = [
  appConfig,
  databaseConfig,
  jwtConfig,
  mailConfig,
  storageConfig,
  throttlerConfig,
  seedConfig,
];
