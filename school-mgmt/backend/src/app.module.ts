import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { BullModule } from "@nestjs/bullmq";
import { CsrfMiddleware } from "./common/middleware/csrf.middleware";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { AdminSeeder } from "./seed/admin.seeder";
import { ProductsModule } from "./products/products.module";
import { StudentsModule } from "./students/students.module";
import { TeachersModule } from "./teachers/teachers.module";
import { ClassesModule } from "./classes/classes.module";
import { SessionsModule } from "./sessions/sessions.module";
import { WalletsModule } from "./wallets/wallets.module";
import { PayrollModule } from "./payroll/payroll.module";
import { TicketsModule } from "./tickets/tickets.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { TeachingMaterialsModule } from "./teaching-materials/teaching-materials.module";
import { AuditLogModule } from "./audit-log/audit-log.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PendingApprovalsModule } from "./pending-approvals/pending-approvals.module";
import { ExportModule } from "./export/export.module";
import { LeadsModule } from "./leads/leads.module";
import { OrdersModule } from "./orders/orders.module";
import { TrialEnrollmentsModule } from "./trial-enrollments/trial-enrollments.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { FinancialControlModule } from "./financial-control/financial-control.module";
import { LoansModule } from "./loans/loans.module";
import { AdsModule } from "./ads/ads.module";
import { ChatbotModule } from "./chatbot/chatbot.module";
import { WorkSessionsModule } from "./work-sessions/work-sessions.module";
import { SalaryConfigModule } from "./salary-config/salary-config.module";
import { StaffPayrollModule } from "./staff-payroll/staff-payroll.module";
import { MessagesModule } from "./messages/messages.module";
import { LandingPagesModule } from "./landing-pages/landing-pages.module";
import { ReportTemplatesModule } from "./report-templates/report-templates.module";
import { ReportsModule } from "./reports/reports.module";
import { TasksModule } from "./tasks/tasks.module";
import { SupplierQuotesModule } from "./supplier-quotes/supplier-quotes.module";
import { SupplierPaymentsModule } from "./supplier-payments/supplier-payments.module";
import { AgentsModule } from "./agents/agents.module";
import { DevModule } from "./dev/dev.module";
import { TeacherRegistrationsModule } from "./teacher-registrations/teacher-registrations.module";

const redisEnabled =
  (process.env.REDIS_ENABLED ?? "true").toLowerCase() !== "false";

function parsePositiveNumber(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return value.toLowerCase() === "true";
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ...(redisEnabled
      ? [
          BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              connection: {
                host: config.get<string>("REDIS_HOST", "localhost"),
                port: config.get<number>("REDIS_PORT", 6379),
                ...(config.get<string>("REDIS_PASSWORD")
                  ? { password: config.get<string>("REDIS_PASSWORD") }
                  : {}),
                // Do NOT buffer commands when Redis is offline — fail-fast so the
                // webhook controller's catch block can trigger the sync fallback.
                enableOfflineQueue: false,
                lazyConnect: true,
                connectTimeout: 3000,
                maxRetriesPerRequest: 0,
                retryStrategy: () => null,
              },
            }),
          }),
        ]
      : []),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const ttl = Number(config.get<string>("THROTTLE_TTL_MS", "60000"));
        const limit = Number(config.get<string>("THROTTLE_LIMIT", "100"));
        return [
          {
            ttl: Number.isFinite(ttl) && ttl > 0 ? ttl : 60000,
            limit: Number.isFinite(limit) && limit > 0 ? limit : 100,
          },
        ];
      },
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const nodeEnv = config.get<string>("NODE_ENV", "development");
        const isTestEnv = nodeEnv === "test";
        return {
          uri: config.get<string>(
            "MONGODB_URI",
            "mongodb://127.0.0.1:27017/school-mgmt",
          ),
          maxPoolSize: parsePositiveNumber(
            config.get<string>("MONGODB_MAX_POOL_SIZE"),
            30,
          ),
          minPoolSize: parsePositiveNumber(
            config.get<string>("MONGODB_MIN_POOL_SIZE"),
            5,
          ),
          maxIdleTimeMS: parsePositiveNumber(
            config.get<string>("MONGODB_MAX_IDLE_MS"),
            30000,
          ),
          serverSelectionTimeoutMS: parsePositiveNumber(
            config.get<string>("MONGODB_SERVER_SELECTION_TIMEOUT_MS"),
            5000,
          ),
          socketTimeoutMS: parsePositiveNumber(
            config.get<string>("MONGODB_SOCKET_TIMEOUT_MS"),
            45000,
          ),
          autoIndex: isTestEnv
            ? false
            : parseBoolean(
                config.get<string>("MONGODB_AUTO_INDEX"),
                nodeEnv !== "production",
              ),
        };
      },
    }),
    AuditLogModule,
    NotificationsModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    StudentsModule,
    TeachersModule,
    ClassesModule,
    SessionsModule,
    WalletsModule,
    PayrollModule,
    TicketsModule,
    AttendanceModule,
    InvoicesModule,
    DashboardModule,
    TeachingMaterialsModule,
    PendingApprovalsModule,
    ExportModule,
    LeadsModule,
    OrdersModule,
    TrialEnrollmentsModule,
    ExpensesModule,
    FinancialControlModule,
    LoansModule,
    AdsModule,
    ChatbotModule,
    WorkSessionsModule,
    SalaryConfigModule,
    StaffPayrollModule,
    MessagesModule,
    LandingPagesModule,
    ReportTemplatesModule,
    ReportsModule,
    TasksModule,
    SupplierQuotesModule,
    SupplierPaymentsModule,
    AgentsModule,
    TeacherRegistrationsModule,
    ...(process.env.NODE_ENV !== "production" ? [DevModule] : []),
  ],
  providers: [AdminSeeder, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CsrfMiddleware)
      .exclude(
        "auth/login",
        "auth/register",
        "webhooks/(.*)",
        "public/attendance/(.*)",
        "public/landing-pages/(.*)",
        "public/teacher-registrations",
      )
      .forRoutes("*");
  }
}
