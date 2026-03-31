import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { PlaygroundsModule } from './playgrounds/playgrounds.module';
import { DocumentsModule } from './documents/documents.module';
import { ArticlesModule } from './articles/articles.module';
import { MediaModule } from './media/media.module';
import { ActionsModule } from './actions/actions.module';
import { ContactsModule } from './contacts/contacts.module';
import { MailModule } from './integrations/mail/mail.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LoggingInterceptor } from './utils/interceptors/logging.interceptor';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        limit: 10, // 10 requests per
        ttl: 3000, // 3 seconds
      },
    ]),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'images'), // Path to your static files after build
      serveRoot: '/images', // Public path (optional, default is '/')
    }),
    MailModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    DocumentsModule,
    CompaniesModule,
    PlaygroundsModule,
    ArticlesModule,
    MediaModule,
    ActionsModule,
    ContactsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule {}
