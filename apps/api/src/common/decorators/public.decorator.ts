import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as public so the global ThrottlerGuard skips it.
 * Used for infrastructure endpoints such as /health.
 */
export const SKIP_THROTTLE_KEY = 'skipThrottle';
export const SkipThrottleRoute = () => SetMetadata(SKIP_THROTTLE_KEY, true);
