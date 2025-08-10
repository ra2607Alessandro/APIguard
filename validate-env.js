#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * 
 * This script validates required environment variables based on the current environment.
 * It can be run standalone or as part of build/deployment processes.
 */

const fs = require('fs');
const path = require('path');

// Environment variable requirements by environment
const ENV_REQUIREMENTS = {
  production: {
    required: [
      'DATABASE_URL',
      'JWT_SECRET',
      'TOKEN_ENCRYPTION_KEY',
      'GITHUB_OAUTH_CLIENT_ID',
      'GITHUB_OAUTH_CLIENT_SECRET'
    ],
    optional: [
      'SENDGRID_API_KEY',
      'FROM_EMAIL',
      'OPENAI_API_KEY',
      'CORS_ORIGINS',
      'RATE_LIMIT_WINDOW_MS',
      'RATE_LIMIT_MAX_REQUESTS'
    ]
  },
  staging: {
    required: [
      'DATABASE_URL',
      'JWT_SECRET',
      'TOKEN_ENCRYPTION_KEY',
      'GITHUB_OAUTH_CLIENT_ID',
      'GITHUB_OAUTH_CLIENT_SECRET'
    ],
    optional: [
      'SENDGRID_API_KEY',
      'FROM_EMAIL',
      'OPENAI_API_KEY'
    ]
  },
  development: {
    required: [
      'DATABASE_URL'
    ],
    optional: [
      'JWT_SECRET',
      'TOKEN_ENCRYPTION_KEY',
      'GITHUB_OAUTH_CLIENT_ID',
      'GITHUB_OAUTH_CLIENT_SECRET',
      'SENDGRID_API_KEY',
      'FROM_EMAIL',
      'OPENAI_API_KEY'
    ]
  },
  test: {
    required: [
      'DATABASE_URL'
    ],
    optional: [
      'JWT_SECRET',
      'TOKEN_ENCRYPTION_KEY'
    ]
  }
};

/**
 * Load environment variables from .env file if it exists
 */
function loadDotEnv() {
  const envPath = path.join(process.cwd(), '.env');
  
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n').filter(line => 
        line.trim() && !line.trim().startsWith('#')
      );
      
      lines.forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          // Only set if not already in environment (environment takes precedence)
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value.replace(/^["']|["']$/g, ''); // Remove quotes
          }
        }
      });
      
      console.log('✓ Loaded environment variables from .env');
    } catch (error) {
      console.warn('⚠️  Could not load .env file:', error.message);
    }
  }
}

/**
 * Validate environment variables for the current environment
 */
function validateEnvironment() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isCI = process.env.CI === 'true';
  
  console.log(`🔍 Validating environment: ${nodeEnv}${isCI ? ' (CI)' : ''}`);
  
  const requirements = ENV_REQUIREMENTS[nodeEnv] || ENV_REQUIREMENTS.development;
  const { required, optional } = requirements;
  
  // Check required variables
  const missingRequired = required.filter(varName => !process.env[varName]);
  const missingOptional = optional.filter(varName => !process.env[varName]);
  
  // Results summary
  const results = {
    environment: nodeEnv,
    isCI,
    required: {
      total: required.length,
      present: required.length - missingRequired.length,
      missing: missingRequired
    },
    optional: {
      total: optional.length,
      present: optional.length - missingOptional.length,
      missing: missingOptional
    }
  };
  
  // Handle missing required variables
  if (missingRequired.length > 0) {
    if (nodeEnv === 'production') {
      console.error('❌ VALIDATION FAILED');
      console.error(`Missing required environment variables for production:`);
      missingRequired.forEach(varName => {
        console.error(`   - ${varName}`);
      });
      console.error('\n💡 Add these variables to your environment or .env file');
      process.exit(1);
    } else if (isCI) {
      console.error('❌ VALIDATION FAILED');
      console.error(`Missing required environment variables for CI:`);
      missingRequired.forEach(varName => {
        console.error(`   - ${varName}`);
      });
      console.error('\n💡 Add these variables to your CI environment');
      process.exit(1);
    } else {
      console.warn('⚠️  VALIDATION WARNING');
      console.warn(`Missing required environment variables:`);
      missingRequired.forEach(varName => {
        console.warn(`   - ${varName}`);
      });
      console.warn('\n💡 Some features may not work properly');
    }
  }
  
  // Report on optional variables
  if (missingOptional.length > 0 && nodeEnv !== 'test') {
    console.log(`ℹ️  Optional variables not configured: ${missingOptional.length}/${optional.length}`);
    if (process.env.VERBOSE === 'true') {
      missingOptional.forEach(varName => {
        console.log(`   - ${varName} (optional)`);
      });
    }
  }
  
  // Success message
  if (missingRequired.length === 0) {
    console.log('✅ Environment validation passed');
    console.log(`   Required: ${results.required.present}/${results.required.total}`);
    console.log(`   Optional: ${results.optional.present}/${results.optional.total}`);
  }
  
  return results;
}

/**
 * Generate a sample .env file based on current environment
 */
function generateSampleEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const requirements = ENV_REQUIREMENTS[nodeEnv] || ENV_REQUIREMENTS.development;
  
  console.log(`\n📝 Sample .env file for ${nodeEnv} environment:`);
  console.log('# ==========================================');
  console.log(`# Environment: ${nodeEnv.toUpperCase()}`);
  console.log('# ==========================================\n');
  
  console.log('# Required variables');
  requirements.required.forEach(varName => {
    const currentValue = process.env[varName];
    if (currentValue) {
      console.log(`${varName}=${varName.includes('SECRET') || varName.includes('KEY') ? '[REDACTED]' : currentValue}`);
    } else {
      console.log(`${varName}=your-${varName.toLowerCase().replace(/_/g, '-')}-here`);
    }
  });
  
  if (requirements.optional.length > 0) {
    console.log('\n# Optional variables');
    requirements.optional.forEach(varName => {
      const currentValue = process.env[varName];
      if (currentValue) {
        console.log(`${varName}=${varName.includes('SECRET') || varName.includes('KEY') ? '[REDACTED]' : currentValue}`);
      } else {
        console.log(`# ${varName}=your-${varName.toLowerCase().replace(/_/g, '-')}-here`);
      }
    });
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Environment Validation Script

Usage:
  node scripts/validate-env.js [options]

Options:
  --help, -h        Show this help message
  --sample          Generate a sample .env file
  --verbose         Show detailed output
  --no-exit         Don't exit on validation failure (warnings only)

Environment Variables:
  NODE_ENV          Target environment (development, test, staging, production)
  CI                Set to 'true' for CI environments
  VERBOSE           Set to 'true' for detailed output
`);
    return;
  }
  
  // Load environment variables from .env if available
  loadDotEnv();
  
  if (args.includes('--sample')) {
    generateSampleEnv();
    return;
  }
  
  // Run validation
  const results = validateEnvironment();
  
  // Exit with appropriate code (unless --no-exit is specified)
  if (!args.includes('--no-exit') && results.required.missing.length > 0) {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isCI = process.env.CI === 'true';
    
    if (nodeEnv === 'production' || isCI) {
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  validateEnvironment,
  loadDotEnv,
  ENV_REQUIREMENTS
};
