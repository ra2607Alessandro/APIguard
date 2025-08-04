import { WebClient, LogLevel } from "@slack/web-api";
import { storage } from "../storage";

export async function sendSlackAlert(
  workspaceId: string,
  channel: string,
  text: string,
  blocks?: any[]
): Promise<void> {
  try {
    const token = await storage.getSlackToken(workspaceId);
    const client = new WebClient(token, { logLevel: LogLevel.WARN });

    await client.chat.postMessage({ 
      channel, 
      text, 
      blocks 
    });
  } catch (err: any) {
    console.error(`Failed to send Slack alert to workspace ${workspaceId}, channel ${channel}:`, err);
    
    if (err.data?.error === "channel_not_found") {
      console.warn(`Channel ${channel} not found in workspace ${workspaceId}. Marking destination as invalid.`);
      // TODO: Mark destination as invalid in UI
    }
    
    if (err.data?.error === "invalid_auth") {
      console.warn(`Invalid auth for workspace ${workspaceId}. Token may have been revoked.`);
      // TODO: Flag workspace as having authentication issues
    }
    
    throw err;
  }
}

export async function sendBreakingChangeAlert(
  projectId: string,
  changeDescription: string,
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  projectName: string,
  commitHash?: string,
  repository?: string
): Promise<void> {
  try {
    // Get all alert destinations for the project
    const destinations = await storage.getAlertDestinationsForProject(projectId);
    
    if (destinations.length === 0) {
      console.log(`No Slack destinations configured for project ${projectId}`);
      return;
    }

    // Create formatted message
    const severityEmoji = {
      'CRITICAL': '🚨',
      'HIGH': '⚠️',
      'MEDIUM': '🟡',
      'LOW': '🔵'
    }[severity];

    const text = `${severityEmoji} API Breaking Change Detected`;
    
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${severityEmoji} API Breaking Change Detected`
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Project:*\n${projectName}`
          },
          {
            type: "mrkdwn", 
            text: `*Severity:*\n${severity}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Change Description:*\n${changeDescription}`
        }
      }
    ];

    if (repository && commitHash) {
      blocks.push({
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Repository:*\n${repository}`
          },
          {
            type: "mrkdwn",
            text: `*Commit:*\n\`${commitHash.substring(0, 7)}\``
          }
        ]
      });
    }

    // Send to all configured destinations
    const sendPromises = destinations.map(async (destination) => {
      try {
        await sendSlackAlert(
          destination.workspace_id,
          destination.channel_id,
          text,
          blocks
        );
        console.log(`Successfully sent alert to workspace ${destination.workspace_id}, channel ${destination.channel_name}`);
      } catch (error) {
        console.error(`Failed to send alert to workspace ${destination.workspace_id}, channel ${destination.channel_name}:`, error);
        // Don't throw - continue sending to other destinations
      }
    });

    await Promise.allSettled(sendPromises);
  } catch (error) {
    console.error('Failed to send breaking change alerts:', error);
    throw error;
  }
}