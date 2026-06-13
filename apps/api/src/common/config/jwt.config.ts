/**
 * Centralized JWT secret resolution.
 *
 * In production a missing JWT_SECRET is a hard failure: signing/verifying tokens
 * with a well-known fallback would make every token forgeable. In non-production
 * we keep a development fallback so local dev does not break.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (secret && secret.length > 0) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET environment variable is required in production. Refusing to start with an insecure fallback secret.',
    );
  }

  return 'super-secret-development-key';
}
