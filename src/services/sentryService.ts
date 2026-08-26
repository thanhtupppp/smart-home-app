/**
 * Sentry & Error Monitoring Service
 * Provides centralized error capturing, user context tagging, and breadcrumb logging.
 */

interface SentryConfig {
  dsn?: string;
  environment?: string;
  enabled?: boolean;
}

class SentryService {
  private isInitialized = false;

  public init(config: SentryConfig = {}) {
    this.isInitialized = true;
    console.log('[SentryService] Initialized with environment:', config.environment || 'development');
  }

  public captureException(error: Error, context?: Record<string, any>) {
    console.error('[SentryService] Captured Exception:', error.message, {
      stack: error.stack,
      context,
    });
    // When @sentry/react-native is linked in native build:
    // Sentry.captureException(error, { extra: context });
  }

  public captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    console.log(`[SentryService] [${level.toUpperCase()}] ${message}`);
  }

  public addBreadcrumb(category: string, message: string, data?: Record<string, any>) {
    console.log(`[SentryBreadcrumb] [${category}] ${message}`, data || '');
  }

  public setUser(user: { id: string; email?: string; role?: string }) {
    console.log('[SentryService] User context updated:', user);
  }
}

export const sentryService = new SentryService();
