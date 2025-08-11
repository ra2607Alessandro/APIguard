import { DEFAULT_CONFIG } from './config-defaults.js';

export class Config {
  private static instance: Config;
  private config: any;
  
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.validate();
  }
  
  private validate() {
    // Only validate what's actually needed based on mode
    if (this.config.GITHUB_MODE === 'token' && !this.config.GITHUB_TOKEN) {
      console.error(`
        ⚠️  No GitHub token provided!
        
        To get started:
        1. Create a token at: https://github.com/settings/tokens
        2. Add to .env: GITHUB_TOKEN=ghp_your_token
        
        Or use GitHub App mode (advanced).
      `);
      process.exit(1);
    }
    
    if (this.config.EMAIL_MODE === 'sendgrid' && !this.config.SENDGRID_API_KEY) {
      console.warn('📧 Email mode set to SendGrid but no API key provided. Falling back to console.');
      this.config.EMAIL_MODE = 'console';
    }
  }
  
  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }
  
  get(key: string): any {
    return this.config[key];
  }
}

export const config = Config.getInstance();
