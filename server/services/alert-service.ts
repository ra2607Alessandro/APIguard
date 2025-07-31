import { WebClient } from "@slack/web-api";
import * as nodemailer from "nodemailer";
import type { AlertConfig } from "@shared/schema";

interface AlertTestResult {
  success: boolean;
  message: string;
}

export class AlertService {
  private slackClient?: WebClient;
  private emailTransporter?: nodemailer.Transporter;

  constructor() {
    // Initialize Slack client if token is provided
    if (process.env.SLACK_BOT_TOKEN) {
      this.slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    }

    // Initialize email transporter
    this.setupEmailTransporter();
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
      this.emailTransporter = nodemailer.createTransporter(emailConfig);
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
          await this.sendSlackMessage(config.config_data, message);
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

  private async sendSlackMessage(configData: any, message: string): Promise<void> {
    if (!this.slackClient) {
      throw new Error("Slack client not initialized - SLACK_BOT_TOKEN required");
    }

    const channel = configData.channel || process.env.SLACK_CHANNEL_ID;
    if (!channel) {
      throw new Error("Slack channel not specified");
    }

    const blocks = this.createSlackBlocks(message);

    await this.slackClient.chat.postMessage({
      channel,
      text: "API Sentinel Alert",
      blocks,
    });
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
