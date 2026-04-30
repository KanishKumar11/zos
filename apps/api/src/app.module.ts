// Root NestJS module — wires config, database, infra, health and global APP_* providers.
import { type MiddlewareConsumer, Module, type NestModule, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';

import { configurations } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { buildLoggerOptions } from './config/logger.config';

import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { SerializeInterceptor } from './common/interceptors/serialize.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { MongoExceptionFilter } from './common/filters/mongo-exception.filter';

import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { AuditModule } from './modules/audit/audit.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { CompensationModule } from './modules/compensation/compensation.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { DesignationsModule } from './modules/designations/designations.module';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { MailModule } from './modules/mail/mail.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { ClientsModule } from './modules/clients/clients.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SowModule } from './modules/sow/sow.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StorageModule } from './modules/storage/storage.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configurations,
      validate: validateEnv,
      cache: true,
    }),
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildLoggerOptions(config.get('app.nodeEnv') ?? 'development'),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: (config.get<number>('throttler.ttl') ?? 60) * 1000,
          limit: config.get<number>('throttler.limit') ?? 100,
        },
      ],
    }),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 50 }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    HealthModule,
    MailModule,
    UsersModule,
    AuthModule,
    StorageModule,
    DepartmentsModule,
    DesignationsModule,
    SettingsModule,
    HolidaysModule,
    CompensationModule,
    AttendanceModule,
    LeavesModule,
    PayrollModule,
    NotificationsModule,
    AnnouncementsModule,
    AuditModule,
    ClientsModule,
    DashboardModule,
    InvoicesModule,
    ProjectsModule,
    SowModule,
    TasksModule,
  ],
  providers: [
    { provide: APP_PIPE, useFactory: () => new ValidationPipe({ whitelist: true, transform: true }) },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: SerializeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: MongoExceptionFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
