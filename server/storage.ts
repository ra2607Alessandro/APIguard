import { 
  projects, 
  spec_sources, 
  environments, 
  schema_versions, 
  change_analyses, 
  alert_configs, 
  discovered_specs, 
  monitoring_configs,
  users,
  user_notifications,
  user_projects,
  slack_workspaces,
  github_app_installations,
  type Project,
  type InsertProject,
  type SpecSource,
  type InsertSpecSource,
  type Environment,
  type InsertEnvironment,
  type SchemaVersion,
  type InsertSchemaVersion,
  type ChangeAnalysis,
  type InsertChangeAnalysis,
  type AlertConfig,
  type InsertAlertConfig,
  type DiscoveredSpec,
  type InsertDiscoveredSpec,
  type MonitoringConfig,
  type InsertMonitoringConfig,
  type User,
  type InsertUser,
  type UserNotification,
  type InsertUserNotification,
  type UserProject,
  type InsertUserProject,
  type SlackWorkspace,
  type InsertSlackWorkspace,
  type GitHubAppInstallation,
  type InsertGitHubAppInstallation
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Project methods
  getProjects(userId?: string): Promise<Project[]>;
  getProject(id: string, userId?: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project>;
  updateProjectHealth(id: string, healthStatus: string): Promise<void>;
  deleteProject(id: string): Promise<void>;

  // Spec source methods
  getSpecSources(projectId: string): Promise<SpecSource[]>;
  createSpecSource(specSource: InsertSpecSource): Promise<SpecSource>;
  updateSpecSource(id: string, specSource: Partial<InsertSpecSource>): Promise<SpecSource>;
  updateSpecSourceError(id: string, errorMessage: string): Promise<void>;
  clearSpecSourceError(id: string): Promise<void>;

  // Environment methods
  getEnvironments(projectId: string): Promise<Environment[]>;
  createEnvironment(environment: InsertEnvironment): Promise<Environment>;

  // Schema version methods
  getSchemaVersions(projectId: string): Promise<SchemaVersion[]>;
  getLatestSchemaVersion(specSourceId: string): Promise<SchemaVersion | undefined>;
  createSchemaVersion(schemaVersion: InsertSchemaVersion): Promise<SchemaVersion>;
  createSchemaVersionWithTransaction(schemaVersion: InsertSchemaVersion): Promise<SchemaVersion>;

  // Change analysis methods
  getChangeAnalyses(projectId: string): Promise<ChangeAnalysis[]>;
  getRecentChangeAnalyses(limit?: number, userId?: string): Promise<ChangeAnalysis[]>;
  createChangeAnalysis(analysis: InsertChangeAnalysis): Promise<ChangeAnalysis>;

  // Alert config methods
  getAlertConfigs(projectId: string): Promise<AlertConfig[]>;
  createAlertConfig(alertConfig: InsertAlertConfig): Promise<AlertConfig>;
  updateAlertConfig(id: string, alertConfig: Partial<InsertAlertConfig>): Promise<AlertConfig>;

  // Discovered specs methods
  getDiscoveredSpecs(projectId: string): Promise<DiscoveredSpec[]>;
  createDiscoveredSpec(spec: InsertDiscoveredSpec): Promise<DiscoveredSpec>;
  updateDiscoveredSpec(id: string, spec: Partial<InsertDiscoveredSpec>): Promise<DiscoveredSpec>;

  // Monitoring config methods
  getMonitoringConfig(projectId: string): Promise<MonitoringConfig | undefined>;
  createMonitoringConfig(config: InsertMonitoringConfig): Promise<MonitoringConfig>;
  updateMonitoringConfig(id: string, config: Partial<InsertMonitoringConfig>): Promise<MonitoringConfig>;

  // Dashboard stats
  getDashboardStats(userId?: string): Promise<{
    activeProjects: number;
    breakingChanges: number;
    safeChanges: number;
    last24h: number;
  }>;

  // Project statistics
  getProjectStats(projectId: string): Promise<{
    apiCount: number;
    breakingChanges: number;
    safeChanges: number;
    lastCheck: Date | null;
  }>;

  // User notification methods
  getUserNotifications(projectId: string): Promise<UserNotification[]>;
  createUserNotification(notification: InsertUserNotification): Promise<UserNotification>;
  deleteUserNotification(id: string): Promise<void>;

  // User project methods
  getUserProjects(userId: string): Promise<Project[]>;
  createUserProject(userProject: InsertUserProject): Promise<UserProject>;
  deleteUserProject(userId: string, projectId: string): Promise<void>;

  // GitHub App installation methods
  saveUserGitHubInstallation(userId: string, installationId: number, githubUsername: string): Promise<GitHubAppInstallation>;
  getUserGitHubInstallation(userId: string): Promise<GitHubAppInstallation | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Project methods
  async getProjects(userId?: string): Promise<Project[]> {
    if (userId) {
      return await db.select().from(projects).where(eq(projects.user_id, userId)).orderBy(desc(projects.created_at));
    }
    return await db.select().from(projects).orderBy(desc(projects.created_at));
  }

  async getProject(id: string, userId?: string): Promise<Project | undefined> {
    if (userId) {
      const [project] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.user_id, userId)));
      return project || undefined;
    }
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db
      .insert(projects)
      .values(project)
      .returning();
    return newProject;
  }

  async updateProject(id: string, project: Partial<InsertProject>): Promise<Project> {
    const [updatedProject] = await db
      .update(projects)
      .set({ ...project, updated_at: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  }

  async updateProjectHealth(id: string, healthStatus: string): Promise<void> {
    await db
      .update(projects)
      .set({ health_status: healthStatus, updated_at: new Date() })
      .where(eq(projects.id, id));
  }

  async deleteProject(id: string): Promise<void> {
    // Wrap cascade deletion in a database transaction to ensure data integrity
    await db.transaction(async (tx) => {
      // Delete related records in proper order to avoid foreign key constraint violations
      
      // 1. Delete from alert_configs where project_id matches
      await tx.delete(alert_configs).where(eq(alert_configs.project_id, id));
      
      // 2. Delete from spec_sources where project_id matches
      await tx.delete(spec_sources).where(eq(spec_sources.project_id, id));
      
      // 3. Delete from user_notifications where project_id matches
      await tx.delete(user_notifications).where(eq(user_notifications.project_id, id));
      
      // 4. Delete from environments where project_id matches
      await tx.delete(environments).where(eq(environments.project_id, id));
      
      // 5. Delete from schema_versions where project_id matches
      await tx.delete(schema_versions).where(eq(schema_versions.project_id, id));
      
      // 6. Delete from change_analyses where project_id matches
      await tx.delete(change_analyses).where(eq(change_analyses.project_id, id));
      
      // 7. Delete from discovered_specs where project_id matches
      await tx.delete(discovered_specs).where(eq(discovered_specs.project_id, id));
      
      // 8. Delete from monitoring_configs where project_id matches
      await tx.delete(monitoring_configs).where(eq(monitoring_configs.project_id, id));
      
      // 9. Delete from slack_workspaces where project_id matches
      await tx.delete(slack_workspaces).where(eq(slack_workspaces.project_id, id));
      
      // 10. Finally delete the project record
      await tx.delete(projects).where(eq(projects.id, id));
    });
  }

  // Spec source methods
  async getSpecSources(projectId: string): Promise<SpecSource[]> {
    return await db
      .select()
      .from(spec_sources)
      .where(eq(spec_sources.project_id, projectId))
      .orderBy(desc(spec_sources.created_at));
  }

  async createSpecSource(specSource: InsertSpecSource): Promise<SpecSource> {
    const [newSpecSource] = await db
      .insert(spec_sources)
      .values(specSource)
      .returning();
    return newSpecSource;
  }

  async updateSpecSource(id: string, specSource: Partial<InsertSpecSource>): Promise<SpecSource> {
    const [updatedSpecSource] = await db
      .update(spec_sources)
      .set(specSource)
      .where(eq(spec_sources.id, id))
      .returning();
    return updatedSpecSource;
  }

  async updateSpecSourceError(id: string, errorMessage: string): Promise<void> {
    await db
      .update(spec_sources)
      .set({ 
        last_error: errorMessage, 
        error_timestamp: new Date()
      })
      .where(eq(spec_sources.id, id));
  }

  async clearSpecSourceError(id: string): Promise<void> {
    await db
      .update(spec_sources)
      .set({ 
        last_error: null, 
        error_timestamp: null,
        last_successful_analysis: new Date()
      })
      .where(eq(spec_sources.id, id));
  }

  // Environment methods
  async getEnvironments(projectId: string): Promise<Environment[]> {
    return await db
      .select()
      .from(environments)
      .where(eq(environments.project_id, projectId))
      .orderBy(desc(environments.created_at));
  }

  async createEnvironment(environment: InsertEnvironment): Promise<Environment> {
    const [newEnvironment] = await db
      .insert(environments)
      .values(environment)
      .returning();
    return newEnvironment;
  }

  // Schema version methods
  async getSchemaVersions(projectId: string): Promise<SchemaVersion[]> {
    return await db
      .select()
      .from(schema_versions)
      .where(eq(schema_versions.project_id, projectId))
      .orderBy(desc(schema_versions.created_at));
  }

  async getLatestSchemaVersion(specSourceId: string): Promise<SchemaVersion | undefined> {
    const [version] = await db
      .select()
      .from(schema_versions)
      .where(eq(schema_versions.spec_source_id, specSourceId))
      .orderBy(desc(schema_versions.created_at))
      .limit(1);
    return version || undefined;
  }

  async createSchemaVersion(schemaVersion: InsertSchemaVersion): Promise<SchemaVersion> {
    const [newVersion] = await db
      .insert(schema_versions)
      .values(schemaVersion)
      .returning();
    return newVersion;
  }

  async createSchemaVersionWithTransaction(schemaVersion: InsertSchemaVersion): Promise<SchemaVersion> {
    return await db.transaction(async (tx) => {
      // Check for existing version with same hash
      const existing = await tx
        .select()
        .from(schema_versions)
        .where(and(
          eq(schema_versions.project_id, schemaVersion.project_id),
          eq(schema_versions.spec_source_id, schemaVersion.spec_source_id),
          eq(schema_versions.version_hash, schemaVersion.version_hash)
        ));

      if (existing.length > 0) {
        // Return existing version if found
        return existing[0];
      }

      // Create new version
      const [newSchemaVersion] = await tx
        .insert(schema_versions)
        .values(schemaVersion)
        .returning();
      return newSchemaVersion;
    });
  }

  // Change analysis methods
  async getChangeAnalyses(projectId: string): Promise<ChangeAnalysis[]> {
    return await db
      .select()
      .from(change_analyses)
      .where(eq(change_analyses.project_id, projectId))
      .orderBy(desc(change_analyses.created_at));
  }

  async getRecentChangeAnalyses(limit: number = 10, userId?: string): Promise<ChangeAnalysis[]> {
    if (userId) {
      return await db
        .select({
          id: change_analyses.id,
          project_id: change_analyses.project_id,
          old_version_id: change_analyses.old_version_id,
          new_version_id: change_analyses.new_version_id,
          breaking_changes: change_analyses.breaking_changes,
          non_breaking_changes: change_analyses.non_breaking_changes,
          analysis_summary: change_analyses.analysis_summary,
          severity: change_analyses.severity,
          created_at: change_analyses.created_at,
        })
        .from(change_analyses)
        .innerJoin(projects, eq(change_analyses.project_id, projects.id))
        .where(eq(projects.user_id, userId))
        .orderBy(desc(change_analyses.created_at))
        .limit(limit);
    }
    return await db
      .select()
      .from(change_analyses)
      .orderBy(desc(change_analyses.created_at))
      .limit(limit);
  }

  async createChangeAnalysis(analysis: InsertChangeAnalysis): Promise<ChangeAnalysis> {
    // Allow null version IDs for parsing failures
    const analysisData = {
      ...analysis,
      old_version_id: analysis.old_version_id || null,
      new_version_id: analysis.new_version_id || null
    };
    
    const [newAnalysis] = await db
      .insert(change_analyses)
      .values(analysisData)
      .returning();
    return newAnalysis;
  }

  // Alert config methods
  async getAlertConfigs(projectId: string): Promise<AlertConfig[]> {
    return await db
      .select()
      .from(alert_configs)
      .where(eq(alert_configs.project_id, projectId))
      .orderBy(desc(alert_configs.created_at));
  }

  async createAlertConfig(alertConfig: InsertAlertConfig): Promise<AlertConfig> {
    const [newConfig] = await db
      .insert(alert_configs)
      .values(alertConfig)
      .returning();
    return newConfig;
  }

  async updateAlertConfig(id: string, alertConfig: Partial<InsertAlertConfig>): Promise<AlertConfig> {
    const [updatedConfig] = await db
      .update(alert_configs)
      .set(alertConfig)
      .where(eq(alert_configs.id, id))
      .returning();
    return updatedConfig;
  }

  // Discovered specs methods
  async getDiscoveredSpecs(projectId: string): Promise<DiscoveredSpec[]> {
    return await db
      .select()
      .from(discovered_specs)
      .where(eq(discovered_specs.project_id, projectId))
      .orderBy(desc(discovered_specs.created_at));
  }

  async createDiscoveredSpec(spec: InsertDiscoveredSpec): Promise<DiscoveredSpec> {
    const [newSpec] = await db
      .insert(discovered_specs)
      .values(spec)
      .returning();
    return newSpec;
  }

  async updateDiscoveredSpec(id: string, spec: Partial<InsertDiscoveredSpec>): Promise<DiscoveredSpec> {
    const [updatedSpec] = await db
      .update(discovered_specs)
      .set(spec)
      .where(eq(discovered_specs.id, id))
      .returning();
    return updatedSpec;
  }

  // Monitoring config methods
  async getMonitoringConfig(projectId: string): Promise<MonitoringConfig | undefined> {
    const [config] = await db
      .select()
      .from(monitoring_configs)
      .where(eq(monitoring_configs.project_id, projectId));
    return config || undefined;
  }

  async createMonitoringConfig(config: InsertMonitoringConfig): Promise<MonitoringConfig> {
    const [newConfig] = await db
      .insert(monitoring_configs)
      .values(config)
      .returning();
    return newConfig;
  }

  async updateMonitoringConfig(id: string, config: Partial<InsertMonitoringConfig>): Promise<MonitoringConfig> {
    const [updatedConfig] = await db
      .update(monitoring_configs)
      .set(config)
      .where(eq(monitoring_configs.id, id))
      .returning();
    return updatedConfig;
  }

  // Dashboard stats
  async getDashboardStats(userId?: string): Promise<{
    activeProjects: number;
    breakingChanges: number;
    safeChanges: number;
    last24h: number;
  }> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Build base conditions for user filtering
    const userCondition = userId ? eq(projects.user_id, userId) : sql`true`;
    const projectFilter = userId ? and(
      eq(projects.user_id, userId),
      eq(projects.id, change_analyses.project_id)
    ) : sql`true`;

    const [activeProjectsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(and(eq(projects.is_active, true), userCondition));

    // For change analyses, we need to join with projects to filter by user
    const [breakingChangesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(change_analyses)
      .innerJoin(projects, eq(change_analyses.project_id, projects.id))
      .where(and(
        eq(change_analyses.severity, 'critical'),
        userId ? eq(projects.user_id, userId) : sql`true`
      ));

    const [safeChangesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(change_analyses)
      .innerJoin(projects, eq(change_analyses.project_id, projects.id))
      .where(and(
        eq(change_analyses.severity, 'low'),
        userId ? eq(projects.user_id, userId) : sql`true`
      ));

    const [last24hResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(change_analyses)
      .innerJoin(projects, eq(change_analyses.project_id, projects.id))
      .where(and(
        sql`${change_analyses.created_at} >= ${yesterday}`,
        userId ? eq(projects.user_id, userId) : sql`true`
      ));

    return {
      activeProjects: activeProjectsResult?.count || 0,
      breakingChanges: breakingChangesResult?.count || 0,
      safeChanges: safeChangesResult?.count || 0,
      last24h: last24hResult?.count || 0,
    };
  }

  // Project statistics
  async getProjectStats(projectId: string): Promise<{
    apiCount: number;
    breakingChanges: number;
    safeChanges: number;
    lastCheck: Date | null;
    errorSources?: Array<{
      fileName: string;
      error: string;
      timestamp: string;
    }>;
  }> {
    // Count active spec sources for this project
    const [apiCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(spec_sources)
      .where(and(eq(spec_sources.project_id, projectId), eq(spec_sources.is_active, true)));

    // Count breaking changes for this project
    const [breakingChangesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(change_analyses)
      .where(and(
        eq(change_analyses.project_id, projectId),
        sql`${change_analyses.severity} IN ('critical', 'high')`
      ));

    // Count safe changes for this project
    const [safeChangesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(change_analyses)
      .where(and(
        eq(change_analyses.project_id, projectId),
        sql`${change_analyses.severity} IN ('low', 'medium')`
      ));

    // Get last check time from most recent schema version
    const [lastCheckResult] = await db
      .select({ created_at: schema_versions.created_at })
      .from(schema_versions)
      .where(eq(schema_versions.project_id, projectId))
      .orderBy(desc(schema_versions.created_at))
      .limit(1);

    // Get spec sources with errors
    let errorSourcesFormatted: Array<{
      fileName: string;
      error: string;
      timestamp: string;
    }> = [];

    try {
      const errorSources = await db
        .select()
        .from(spec_sources)
        .where(and(
          eq(spec_sources.project_id, projectId),
          sql`${spec_sources.last_error} IS NOT NULL`
        ));

      errorSourcesFormatted = errorSources.map(source => ({
        fileName: source.source_path?.split('/').pop() || 'Unknown file',
        error: source.last_error || 'Unknown error',
        timestamp: source.error_timestamp?.toISOString() || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error fetching error sources:', error);
      // Continue without error sources if query fails
    }

    return {
      apiCount: apiCountResult?.count || 0,
      breakingChanges: breakingChangesResult?.count || 0,
      safeChanges: safeChangesResult?.count || 0,
      lastCheck: lastCheckResult?.created_at || null,
      errorSources: errorSourcesFormatted,
    };
  }

  // Slack workspace methods
  async getSlackWorkspaces(projectId: string): Promise<SlackWorkspace[]> {
    return await db.select().from(slack_workspaces).where(eq(slack_workspaces.project_id, projectId));
  }

  async createSlackWorkspace(workspace: InsertSlackWorkspace): Promise<SlackWorkspace> {
    const [newWorkspace] = await db
      .insert(slack_workspaces)
      .values({
        ...workspace,
        access_token: this.encryptToken(workspace.access_token)
      })
      .returning();
    return newWorkspace;
  }

  async getSlackToken(workspaceId: string): Promise<string> {
    const [workspace] = await db.select().from(slack_workspaces).where(eq(slack_workspaces.id, workspaceId));
    if (!workspace) {
      throw new Error('Slack workspace not found');
    }
    return this.decryptToken(workspace.access_token);
  }

  // User project methods
  async getUserProjects(userId: string): Promise<Project[]> {
    const result = await db
      .select({ project: projects })
      .from(user_projects)
      .innerJoin(projects, eq(user_projects.project_id, projects.id))
      .where(eq(user_projects.user_id, userId));
    return result.map(r => r.project);
  }

  async createUserProject(userProject: InsertUserProject): Promise<UserProject> {
    const [newUserProject] = await db
      .insert(user_projects)
      .values(userProject)
      .returning();
    return newUserProject;
  }

  async deleteUserProject(userId: string, projectId: string): Promise<void> {
    await db
      .delete(user_projects)
      .where(and(
        eq(user_projects.user_id, userId),
        eq(user_projects.project_id, projectId)
      ));
  }

  private encryptToken(token: string): string {
    const crypto = require('crypto');
    const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipherGCM('aes-256-gcm', key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + encrypted + ':' + authTag.toString('hex');
  }

  private decryptToken(encryptedToken: string): string {
    const crypto = require('crypto');
    const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex');
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const authTag = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipherGCM('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // User notification methods
  async getUserNotifications(projectId: string): Promise<UserNotification[]> {
    return await db
      .select()
      .from(user_notifications)
      .where(and(
        eq(user_notifications.project_id, projectId),
        eq(user_notifications.is_active, true)
      ))
      .orderBy(desc(user_notifications.created_at));
  }

  async createUserNotification(notification: InsertUserNotification): Promise<UserNotification> {
    const [newNotification] = await db
      .insert(user_notifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async deleteUserNotification(id: string): Promise<void> {
    await db.delete(user_notifications).where(eq(user_notifications.id, id));
  }

  // GitHub App installation methods
  async saveUserGitHubInstallation(userId: string, installationId: number, githubUsername: string): Promise<GitHubAppInstallation> {
    const [installation] = await db
      .insert(github_app_installations)
      .values({
        user_id: userId,
        installation_id: installationId,
        github_username: githubUsername,
      })
      .onConflictDoUpdate({
        target: [github_app_installations.user_id, github_app_installations.installation_id],
        set: {
          github_username: githubUsername,
          updated_at: new Date(),
        },
      })
      .returning();
    return installation;
  }

  async getUserGitHubInstallation(userId: string): Promise<GitHubAppInstallation | undefined> {
    const [installation] = await db
      .select()
      .from(github_app_installations)
      .where(eq(github_app_installations.user_id, userId));
    return installation || undefined;
  }
}

export const storage = new DatabaseStorage();
