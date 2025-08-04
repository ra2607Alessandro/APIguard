import { WebClient } from "@slack/web-api";
import * as nodemailer from "nodemailer";
import type { AlertConfig } from "@shared/schema";

/**
 * API Sentinel Alert Service
 * 
 * Notification Setup Guide:
 * 
 * Slack Integration Options:
 * 1. Bot API (Preferred): Requires SLACK_BOT_TOKEN with 'chat:write' or 'chat:write.public' scope
 *    - Configure: { "channel": "C097MKQMQLS" } or { "channel": "#general" }
 *    - Features: Rich formatting, interactive blocks, better error handling
 * 
 * 2. Incoming Webhooks: Use Slack webhook URLs for simpler setup
 *    - Configure: { "webhookUrl": "https://hooks.slack.com/services/..." }
 *    - Features: Simple setup, no app installation required
 * 
 * 3. Hybrid (Recommended): Combine both for maximum reliability
 *    - Configure: { "channel": "C097MKQMQLS", "webhookUrl": "https://hooks.slack.com/...", "fallback": true }
 *    - Features: Bot API with webhook fallback on failure
 * 
 * Other Channels:
 * - Email: Requires SMTP_HOST, SMTP_USER, SMTP_PASS environment variables
 * - Generic Webhooks: Any HTTP endpoint accepting JSON payloads
 * - GitHub: Create comments on PRs (requires GitHub integration)
 */

interface AlertTestResult {
  success: boolean;
  message: string;
  details?: any;
}

interface SlackConfig {
  channel?: string;
  webhookUrl?: string;
  fallback?: boolean;
}

export class AlertService {
  private slackClient?: WebClient;
  private emailTransporter?: nodemailer.Transporter;

  constructor() {
    // Initialize Slack client if token is provided
    if (process.env.SLACK_BOT_TOKEN) {
      this.slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
      this.validateSlackScope();
    }

    // Initialize email transporter
    this.setupEmailTransporter();
  }

  private async validateSlackScope(): Promise<void> {
    if (!this.slackClient) return;
    
    try {
      const authResult = await this.slackClient.auth.test();
      const scopes = authResult.response_metadata?.scopes as string[] || [];
      
      const hasWriteScope = scopes.includes('chat:write') || scopes.includes('chat:write.public');
      
      if (!hasWriteScope) {
        throw new Error(
          `Slack Bot Token missing required scope. ` +
          `Found scopes: ${scopes.join(', ')}. ` +
          `Required: 'chat:write' or 'chat:write.public'. ` +
          `Please update your Slack App permissions and reinstall to your workspace.`
        );
      }
    } catch (error: any) {
      console.error('Slack scope validation failed:', error.message);
      // Don't throw here to allow fallback to webhooks
    }
  }

  private setupEmailTransporter(): void {
    // Configure email transporter based on environment
    const emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    if (emailConfig.auth.user && emailConfig.auth.pass) {
      this.emailTransporter = nodemailer.createTransport(emailConfig);
    }
  }

  async triggerConfiguredAlerts(
    projectId: string, 
    apiName: string, 
    result: any, 
    alertConfigs: AlertConfig[]
  ): Promise<void> {
    const message = this.generateContextAwareMessage(apiName, result);
    
    const alertPromises = alertConfigs
      .filter(config => config.is_active)
      .map(config => this.routeAlert(config, message));

    try {
      await Promise.allSettled(alertPromises);
      console.log(`Alerts sent for project ${projectId}`);
    } catch (error) {
      console.error(`Error sending alerts for project ${projectId}:`, error);
    }
  }

  private async routeAlert(config: AlertConfig, message: string): Promise<void> {
    try {
      switch (config.channel_type) {
        case 'slack':
          await this.sendSlackAlert(config.config_data, message);
          break;
        case 'email':
          await this.sendEmail(config.config_data, message);
          break;
        case 'github':
          await this.createGitHubComment(config.config_data, message);
          break;
        case 'webhook':
          await this.sendWebhook(config.config_data, message);
          break;
        default:
          console.warn(`Unknown alert channel type: ${config.channel_type}`);
      }
    } catch (error) {
      console.error(`Error sending ${config.channel_type} alert:`, error);
      throw error;
    }
  }

  private async sendSlackAlert(configData: any, message: string): Promise<void> {
    const { channel, webhookUrl, fallback = true } = configData;

    // If both channel and webhookUrl provided, try Bot API first, fallback to webhook
    if (channel && webhookUrl && fallback) {
      try {
        await this.retry(() => this.sendSlackBotMessage(channel, message));
        return;
      } catch (error: any) {
        console.warn(`Bot API failed, falling back to webhook:`, error.message);
        await this.retry(() => this.sendSlackWebhook(webhookUrl, message));
        return;
      }
    }

    // If only channel exists, attempt Bot API
    if (channel && !webhookUrl) {
      await this.retry(() => this.sendSlackBotMessage(channel, message));
      return;
    }

    // If only webhookUrl exists, send webhook directly
    if (webhookUrl && !channel) {
      await this.retry(() => this.sendSlackWebhook(webhookUrl, message));
      return;
    }

    throw new Error("Either channel or webhookUrl must be provided in Slack config");
  }

  private async sendSlackBotMessage(channel: string, message: string): Promise<void> {
    if (!this.slackClient) {
      throw new Error("Slack client not initialized - SLACK_BOT_TOKEN required");
    }

    const effectiveChannel = channel || process.env.SLACK_CHANNEL_ID;
    if (!effectiveChannel) {
      throw new Error("Slack channel not specified");
    }

    const blocks = this.createSlackBlocks(message);

    const response = await this.slackClient.chat.postMessage({
      channel: effectiveChannel,
      text: "API Sentinel Alert",
      blocks,
    });

    if (!response.ok) {
      throw new Error(`Slack Bot API failed: ${response.error}`);
    }
  }

  private async sendSlackWebhook(webhookUrl: string, message: string): Promise<void> {
    if (!webhookUrl) {
      throw new Error("Webhook URL not specified");
    }

    const lines = message.split('\n');
    const firstLine = lines[0];
    const blocks = this.createSlackBlocks(message);

    const payload = {
      text: firstLine,
      blocks: blocks
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'API-Sentinel-Alert'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed with status ${response.status}`);
    }
  }

  private async retry<T>(fn: () => Promise<T>, attempts: number = 3, backoff: number[] = [1000, 2000, 4000]): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on certain errors
        if (error.code === 'slack_webapi_platform_error' && 
            (error.data?.error === 'missing_scope' || error.data?.error === 'not_in_channel')) {
          throw error;
        }
        
        if (i < attempts - 1) {
          const delay = backoff[i] || backoff[backoff.length - 1];
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  private createSlackBlocks(message: string): any[] {
    const lines = message.split('\n');
    const title = lines[0];
    const details = lines.slice(1).join('\n');

    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🚨 ${title}*`
        }
      },
      {
        type: "section",
        text: {
          type: "plain_text",
          text: details
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Details"
            },
            style: "primary",
            url: `${process.env.API_URL || 'http://localhost:5000'}/monitoring`
          }
        ]
      }
    ];
  }

  private async sendEmail(configData: any, message: string): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error("Email transporter not configured - SMTP settings required");
    }

    const { to, subject = "API Sentinel Alert" } = configData;
    if (!to) {
      throw new Error("Email recipient not specified");
    }

    const html = this.createEmailHtml(message);

    await this.emailTransporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: message,
      html,
    });
  }

  private createEmailHtml(message: string): string {
    const lines = message.split('\n');
    const title = lines[0];
    const details = lines.slice(1);

    return `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #dc3545; margin: 0 0 16px 0;">🚨 ${title}</h2>
            <div style="background: white; padding: 16px; border-radius: 4px; border-left: 4px solid #dc3545;">
              ${details.map(line => `<p style="margin: 8px 0;">${line}</p>`).join('')}
            </div>
            <div style="margin-top: 20px;">
              <a href="${process.env.API_URL || 'http://localhost:5000'}/monitoring" 
                 style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Details
              </a>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private async createGitHubComment(configData: any, message: string): Promise<void> {
    // Implement GitHub comment creation
    // This would require GitHub API integration and PR context
    console.log("GitHub comment alert:", message);
  }

  private async sendWebhook(configData: any, message: string): Promise<void> {
    const { url, method = 'POST' } = configData;
    if (!url) {
      throw new Error("Webhook URL not specified");
    }

    const payload = {
      timestamp: new Date().toISOString(),
      message,
      source: 'api-sentinel',
      type: 'breaking-change-alert'
    };

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'API-Sentinel-Alert'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`);
    }
  }

  private generateContextAwareMessage(apiName: string, result: any): string {
    const { breakingChanges, nonBreakingChanges, summary } = result;
    
    let message = `API Sentinel Alert - ${apiName}\n`;
    message += `${summary}\n\n`;

    if (breakingChanges && breakingChanges.length > 0) {
      message += "🚨 Breaking Changes:\n";
      breakingChanges.forEach((change: any, index: number) => {
        message += `${index + 1}. ${change.description}\n`;
        message += `   Impact: ${change.impact}\n`;
        message += `   Recommendation: ${change.recommendation}\n\n`;
      });
    }

    if (nonBreakingChanges && nonBreakingChanges.length > 0) {
      message += "✅ Safe Changes:\n";
      nonBreakingChanges.forEach((change: any, index: number) => {
        message += `${index + 1}. ${change.description}\n`;
      });
    }

    message += `\nTime: ${new Date().toISOString()}`;
    return message;
  }

  async testAlert(channelType: string, configData: any): Promise<AlertTestResult> {
    const testMessage = `API Sentinel Test Alert
This is a test message to verify your alert configuration.
If you received this, your ${channelType} integration is working correctly.

Test performed at: ${new Date().toISOString()}`;

    try {
      if (channelType === 'slack') {
        const slackConfig = configData as SlackConfig;
        const { channel, webhookUrl } = slackConfig;
        
        // If both channel and webhookUrl provided, test both
        if (channel && webhookUrl) {
          const results: any = { bot: null, webhook: null };
          
          // Test Bot API
          try {
            await this.sendSlackBotMessage(channel, testMessage);
            results.bot = { success: true, message: "Bot API test successful" };
          } catch (error: any) {
            results.bot = { success: false, message: error.message };
          }
          
          // Test Webhook
          try {
            await this.sendSlackWebhook(webhookUrl, testMessage);
            results.webhook = { success: true, message: "Webhook test successful" };
          } catch (error: any) {
            results.webhook = { success: false, message: error.message };
          }
          
          const overallSuccess = results.bot.success || results.webhook.success;
          return {
            success: overallSuccess,
            message: overallSuccess 
              ? "At least one Slack method is working" 
              : "Both Slack methods failed",
            details: results
          };
        }
      }

      // Standard single-method test
      const testConfig: AlertConfig = {
        id: 'test',
        project_id: 'test',
        channel_type: channelType,
        config_data: configData,
        is_active: true,
        created_at: new Date(),
      };

      await this.routeAlert(testConfig, testMessage);
      
      return {
        success: true,
        message: `Test alert sent successfully via ${channelType}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send test alert: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const alertService = new AlertService();

/**
 * Send breaking change alerts using the new Slack workspace integration
 * This function integrates MILESTONE 3 with the existing alert pipeline
 */
export async function sendBreakingChangeAlert(
  projectId: string,
  changeDescription: string,
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  projectName: string,
  commitHash?: string,
  repository?: string
): Promise<void> {
  try {
    // Import the Slack service to avoid circular dependencies
    const { sendBreakingChangeAlert } = await import('./slack-service.js');
    
    await sendBreakingChangeAlert(
      projectId,
      changeDescription,
      severity,
      projectName,
      commitHash,
      repository
    );
    
    console.log(`Breaking change alert sent for project ${projectName} (${projectId})`);
  } catch (error: any) {
    console.error('Failed to send Slack breaking change alerts:', error);
    // Don't throw - we still want other alert types to work if configured
  }
}
