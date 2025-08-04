import { MailService } from '@sendgrid/mail';
import type { UserNotification } from '@shared/schema';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

export class EmailService {
  private fromEmail = 'alerts@apisentinel.dev'; // Use your verified sender

  async sendBreakingChangeAlert(
    notification: UserNotification,
    projectName: string,
    changeDescription: string,
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
    commitHash?: string,
    repository?: string
  ): Promise<void> {
    const severityColors = {
      CRITICAL: '#FF0000',
      HIGH: '#FF8C00',
      MEDIUM: '#FFD700',
      LOW: '#32CD32'
    };

    const severityEmojis = {
      CRITICAL: '🚨',
      HIGH: '⚠️',
      MEDIUM: '📊',
      LOW: 'ℹ️'
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background-color: ${severityColors[severity]}; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .severity-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; color: white; background-color: ${severityColors[severity]}; }
            .project-info { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .change-details { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; }
            .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${severityEmojis[severity]} API Sentinel Alert</h1>
              <span class="severity-badge">${severity} SEVERITY</span>
            </div>
            
            <div class="content">
              <div class="project-info">
                <h2>Project: ${projectName}</h2>
                ${repository ? `<p><strong>Repository:</strong> ${repository}</p>` : ''}
                ${commitHash ? `<p><strong>Commit:</strong> <code>${commitHash.substring(0, 8)}</code></p>` : ''}
              </div>
              
              <div class="change-details">
                <h3>Breaking Change Detected</h3>
                <p>${changeDescription}</p>
              </div>
              
              <p>This breaking change was automatically detected in your API specification. Please review the changes and update your API consumers accordingly.</p>
              
              <p><strong>Recommended Actions:</strong></p>
              <ul>
                <li>Review the API changes in detail</li>
                <li>Update API documentation</li>
                <li>Notify API consumers</li>
                <li>Plan a migration strategy if needed</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>This alert was sent by API Sentinel - Proactive API Change Monitoring</p>
              <p>You are receiving this because you subscribed to alerts for the "${projectName}" project.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
API Sentinel Alert - ${severity} SEVERITY

Project: ${projectName}
${repository ? `Repository: ${repository}\n` : ''}${commitHash ? `Commit: ${commitHash.substring(0, 8)}\n` : ''}

Breaking Change Detected:
${changeDescription}

This breaking change was automatically detected in your API specification. Please review the changes and update your API consumers accordingly.

Recommended Actions:
- Review the API changes in detail
- Update API documentation  
- Notify API consumers
- Plan a migration strategy if needed

This alert was sent by API Sentinel - Proactive API Change Monitoring
    `;

    try {
      await mailService.send({
        to: notification.email,
        from: this.fromEmail,
        subject: `${severityEmojis[severity]} API Breaking Change Alert - ${projectName}`,
        text: textContent,
        html: htmlContent,
      });

      console.log(`Breaking change email sent to ${notification.email} for project ${projectName}`);
    } catch (error: any) {
      console.error(`Failed to send email to ${notification.email}:`, error.message);
      throw error;
    }
  }

  async sendTestEmail(email: string, projectName: string): Promise<void> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ API Sentinel Test Email</h1>
            </div>
            
            <div class="content">
              <h2>Email Notifications Configured Successfully!</h2>
              <p>This is a test email to confirm that your email notifications are working correctly for the <strong>${projectName}</strong> project.</p>
              
              <p>You will now receive email alerts when breaking changes are detected in your API specifications.</p>
              
              <p><strong>What happens next:</strong></p>
              <ul>
                <li>API Sentinel monitors your repository for changes</li>
                <li>When breaking changes are detected, you'll receive detailed email alerts</li>
                <li>Alerts include severity levels, change descriptions, and recommended actions</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>This test email was sent by API Sentinel - Proactive API Change Monitoring</p>
              <p>Sent at: ${new Date().toISOString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
API Sentinel Test Email

Email Notifications Configured Successfully!

This is a test email to confirm that your email notifications are working correctly for the "${projectName}" project.

You will now receive email alerts when breaking changes are detected in your API specifications.

What happens next:
- API Sentinel monitors your repository for changes  
- When breaking changes are detected, you'll receive detailed email alerts
- Alerts include severity levels, change descriptions, and recommended actions

This test email was sent by API Sentinel - Proactive API Change Monitoring
Sent at: ${new Date().toISOString()}
    `;

    try {
      await mailService.send({
        to: email,
        from: this.fromEmail,
        subject: '✅ API Sentinel Email Notifications Active',
        text: textContent,
        html: htmlContent,
      });

      console.log(`Test email sent to ${email} for project ${projectName}`);
    } catch (error: any) {
      console.error(`Failed to send test email to ${email}:`, error.message);
      throw error;
    }
  }
}

export const emailService = new EmailService();