// MongooseModule wired against MONGO_URI from ConfigService. Imported once globally.
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('database.uri'),
      }),
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
