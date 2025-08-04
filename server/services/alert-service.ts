import type { UserNotification } from "@shared/schema";
import { storage } from "../storage.js";

/**
 * API Sentinel Alert Service - Email-Based Notifications
 * 
 * Email-First Alert System:
 * - Sends breaking change alerts to subscribed email addresses
 * - Uses SendGrid for reliable email delivery
 * - Supports project-specific subscription management
 * - Rich HTML formatting with change details and severity indicators
 */

interface AlertTestResult {
  success: boolean;
  message: string;
  details?: any;
}

export class AlertService {
  private emailService: any;

  constructor() {
    // Initialize email service for sending alerts
    this.initEmailService();
  }

  private async initEmailService() {
    try {
      const { emailService } = await import('./email-service.js');
      this.emailService = emailService;
    } catch (error) {
      console.warn('Email service not available:', error);
    }
  }

  /**
   * Trigger email alerts for breaking changes detected in a project
   */
  async triggerEmailAlerts(
    projectId: string, 
    apiName: string, 
    result: any
  ): Promise<void> {
    try {
      // Get email notifications for this project
      const notifications = await storage.getUserNotifications(projectId);
      
      if (notifications.length === 0) {
        console.log(`No email notifications configured for project ${projectId}`);
        return;
      }
      
      // Ensure email service is available
      if (!this.emailService) {
        await this.initEmailService();
        if (!this.emailService) {
          console.error('Email service not available for sending alerts');
          return;
        }
      }

      // Get project details
      const project = await storage.getProject(projectId);
      if (!project) {
        console.error(`Project not found: ${projectId}`);
        return;
      }

      // Send email alerts to all subscribed addresses
      const emailPromises = notifications
        .filter(notification => notification.is_active)
        .map(notification => 
          this.emailService.sendBreakingChangeAlert(
            notification.email, 
            project.name, 
            apiName, 
            result
          )
        );

      await Promise.allSettled(emailPromises);
      console.log(`Email alerts sent to ${notifications.length} addresses for project ${project.name}`);
    } catch (error) {
      console.error(`Error sending email alerts for project ${projectId}:`, error);
    }
  }

  /**
   * Test email notification functionality
   */
  async testEmailAlert(email: string, projectName: string): Promise<AlertTestResult> {
    try {
      if (!this.emailService) {
        await this.initEmailService();
        if (!this.emailService) {
          return {
            success: false,
            message: "Email service not available"
          };
        }
      }

      await this.emailService.sendTestEmail(email, projectName);
      
      return {
        success: true,
        message: "Test email sent successfully"
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to send test email",
        details: error
      };
    }
  }
}

export const alertService = new AlertService();