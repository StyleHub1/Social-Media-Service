// src/config/auth.config.ts
import { registerAs } from '@nestjs/config';
import { StringValue } from 'ms';

export interface AuthConfig {
  jwt: {
    secret: string;
    expiresIn: StringValue;
    refreshSecret: string;
    refreshExpiresIn: StringValue;
    refreshHashSecret: string;
    emailVerificationSecret: string;
    emailVerificationExpiresIn: StringValue;
  };
}

export const authConfig = registerAs(
  'auth',
  (): AuthConfig => ({
    jwt: {
      secret: process.env.JWT_TOKEN || 'fallback_secret',
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as StringValue,
      refreshSecret: process.env.JWT_REFRESH_TOKEN || 'fallback_refresh_secret',
      refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ??
        '7d') as StringValue,
      refreshHashSecret:
        process.env.JWT_REFRESH_TOKEN_HASH_SECRET ||
        'fallback_refresh_hash_secret',
      emailVerificationSecret:
        process.env.JWT_EMAIL_VERIFICATION_SECRET ||
        'fallback_email_verification_secret',
      emailVerificationExpiresIn: (process.env
        .JWT_EMAIL_VERIFICATION_EXPIRES_IN ?? '24h') as StringValue,
    },
  }),
);
