import * as Sentry from "@sentry/nextjs";

type ErrorContext = {
  route: string;
  digest: string;
  extra?: Record<string, unknown>;
};

export function captureServerError(error: unknown, context: ErrorContext) {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.withScope((scope) => {
    scope.setTag("route", context.route);
    scope.setTag("digest", context.digest);
    if (context.extra) {
      for (const [key, value] of Object.entries(context.extra)) {
        scope.setExtra(key, value);
      }
    }
    Sentry.captureException(error);
  });
}
