// Winston logger config used by nest-winston for structured JSON logs in prod.
import { utilities as nestWinstonUtils, type WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

export function buildLoggerOptions(env: string): WinstonModuleOptions {
  const isProd = env === 'production';
  return {
    level: isProd ? 'info' : 'debug',
    transports: [
      new winston.transports.Console({
        format: isProd
          ? winston.format.combine(winston.format.timestamp(), winston.format.json())
          : winston.format.combine(
              winston.format.timestamp(),
              winston.format.ms(),
              nestWinstonUtils.format.nestLike('Agency', {
                colors: true,
                prettyPrint: true,
              }),
            ),
      }),
    ],
  };
}
