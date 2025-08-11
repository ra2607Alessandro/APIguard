import * as crypto from 'crypto';

export const DEFAULT_CONFIG = {
  // Database - SQLite by default
  DATABASE_URL: process.env.DATABASE_URL || 'sqlite://./data/api-guard.db',
  
  // Server
  PORT: process.env.PORT || '5000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || generateDefaultJwtSecret(),
  
  // GitHub - Personal token mode by default
  GITHUB_MODE: process.env.GITHUB_MODE || 'token',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  
  // Optional GitHub App (only if mode=app)
  GITHUB_APP_ID: process.env.GITHUB_APP_ID || '',
  GITHUB_PRIVATE_KEY: process.env.GITHUB_PRIVATE_KEY || '',
  
  // Email - Console logging by default
  EMAIL_MODE: process.env.EMAIL_MODE || 'console',
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
  
  // Monitoring
  CHECK_INTERVAL: process.env.CHECK_INTERVAL || '1h',
  
  // Security - Permissive defaults for development
  CORS_ORIGINS: process.env.CORS_ORIGINS || '*',
  RATE_LIMIT: process.env.RATE_LIMIT || '1000',
};

function generateDefaultJwtSecret(): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  // Development only - predictable secret
  return 'dev-secret-do-not-use-in-production';
}
