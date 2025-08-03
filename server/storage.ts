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
  type InsertUser
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Project methods
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
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
  getRecentChangeAnalyses(limit?: number): Promise<ChangeAnalysis[]>;
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
  getDashboardStats(): Promise<{
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
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.created_at));
  }

  async getProject(id: string): Promise<Project | undefined> {
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
    await db.delete(projects).where(eq(projects.id, id));
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

  async getRecentChangeAnalyses(limit: number = 10): Promise<ChangeAnalysis[]> {
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
  async getDashboardStats(): Promise<{
    activeProjects: number;
    breakingChanges: number;
    safeChanges: number;
    last24h: number;
  }> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [activeProjectsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.is_active, true));

    const [breakingChangesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(change_analyses)
      .where(eq(change_analyses.severity, 'critical'));

    const [safeChangesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(change_analyses)
      .where(eq(change_analyses.severity, 'low'));

    const [last24hResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(change_analyses)
      .where(sql`${change_analyses.created_at} >= ${yesterday}`);

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
}

export const storage = new DatabaseStorage();
