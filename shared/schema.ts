import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, boolean, integer, serial, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  github_repo: text("github_repo"),
  monitoring_frequency: text("monitoring_frequency").default('daily'),
  discovery_status: text("discovery_status").default('not_started'),
  health_status: text("health_status").default('healthy'), // 'healthy', 'degraded', 'error'
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const spec_sources = pgTable("spec_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: varchar("project_id").references(() => projects.id).notNull(),
  type: text("type").notNull(), // 'github', 'url', 'file'
  source_path: text("source_path").notNull(),
  name: text("name").notNull(),
  last_error: text("last_error"),
  error_timestamp: timestamp("error_timestamp"),
  last_successful_analysis: timestamp("last_successful_analysis"),
  processing_status: text("processing_status").default('idle'), // 'idle', 'processing', 'error'
  processing_started_at: timestamp("processing_started_at"),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
});

export const environments = pgTable("environments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: varchar("project_id").references(() => projects.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow(),
});

export const schema_versions = pgTable("schema_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: varchar("project_id").references(() => projects.id).notNull(),
  version_hash: text("version_hash").notNull(),
  content: json("content").notNull(),
  commit_sha: text("commit_sha"),
  spec_source_id: varchar("spec_source_id").references(() => spec_sources.id).notNull(),
  environment_id: varchar("environment_id").references(() => environments.id),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Add compound unique constraint in table definition
  projectSourceHashUnique: unique("schema_versions_project_source_hash_unique").on(
    table.project_id,
    table.spec_source_id,
    table.version_hash
  ),
}));

export const change_analyses = pgTable("change_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: varchar("project_id").references(() => projects.id).notNull(),
  old_version_id: varchar("old_version_id").references(() => schema_versions.id),
  new_version_id: varchar("new_version_id").references(() => schema_versions.id).notNull(),
  breaking_changes: json("breaking_changes").notNull(),
  non_breaking_changes: json("non_breaking_changes").notNull(),
  analysis_summary: text("analysis_summary"),
  severity: text("severity").notNull(), // 'critical', 'high', 'medium', 'low'
  created_at: timestamp("created_at").defaultNow(),
});

export const alert_configs = pgTable("alert_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: varchar("project_id").references(() => projects.id).notNull(),
  channel_type: text("channel_type").notNull(), // 'slack', 'email', 'github', 'webhook'
  config_data: json("config_data").notNull(),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
});

export const discovered_specs = pgTable("discovered_specs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: varchar("project_id").references(() => projects.id).notNull(),
  file_path: text("file_path").notNull(),
  api_name: text("api_name"),
  version: text("version"),
  is_selected: boolean("is_selected").default(false),
  created_at: timestamp("created_at").defaultNow(),
});

export const monitoring_configs = pgTable("monitoring_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  project_id: varchar("project_id").references(() => projects.id).notNull(),
  webhook_url: text("webhook_url"),
  cron_schedule: text("cron_schedule"),
  last_check: timestamp("last_check"),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
});

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  specSources: many(spec_sources),
  environments: many(environments),
  schemaVersions: many(schema_versions),
  changeAnalyses: many(change_analyses),
  alertConfigs: many(alert_configs),
  discoveredSpecs: many(discovered_specs),
  monitoringConfigs: many(monitoring_configs),
}));

export const specSourcesRelations = relations(spec_sources, ({ one, many }) => ({
  project: one(projects, {
    fields: [spec_sources.project_id],
    references: [projects.id],
  }),
  schemaVersions: many(schema_versions),
}));

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  project: one(projects, {
    fields: [environments.project_id],
    references: [projects.id],
  }),
  schemaVersions: many(schema_versions),
}));

export const schemaVersionsRelations = relations(schema_versions, ({ one, many }) => ({
  project: one(projects, {
    fields: [schema_versions.project_id],
    references: [projects.id],
  }),
  specSource: one(spec_sources, {
    fields: [schema_versions.spec_source_id],
    references: [spec_sources.id],
  }),
  environment: one(environments, {
    fields: [schema_versions.environment_id],
    references: [environments.id],
  }),
  newVersionAnalyses: many(change_analyses, {
    relationName: "new_version",
  }),
  oldVersionAnalyses: many(change_analyses, {
    relationName: "old_version",
  }),
}));

export const changeAnalysesRelations = relations(change_analyses, ({ one }) => ({
  project: one(projects, {
    fields: [change_analyses.project_id],
    references: [projects.id],
  }),
  oldVersion: one(schema_versions, {
    fields: [change_analyses.old_version_id],
    references: [schema_versions.id],
    relationName: "old_version",
  }),
  newVersion: one(schema_versions, {
    fields: [change_analyses.new_version_id],
    references: [schema_versions.id],
    relationName: "new_version",
  }),
}));

export const alertConfigsRelations = relations(alert_configs, ({ one }) => ({
  project: one(projects, {
    fields: [alert_configs.project_id],
    references: [projects.id],
  }),
}));

export const discoveredSpecsRelations = relations(discovered_specs, ({ one }) => ({
  project: one(projects, {
    fields: [discovered_specs.project_id],
    references: [projects.id],
  }),
}));

export const monitoringConfigsRelations = relations(monitoring_configs, ({ one }) => ({
  project: one(projects, {
    fields: [monitoring_configs.project_id],
    references: [projects.id],
  }),
}));

// Insert schemas
export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertSpecSourceSchema = createInsertSchema(spec_sources).omit({
  id: true,
  created_at: true,
});

export const insertEnvironmentSchema = createInsertSchema(environments).omit({
  id: true,
  created_at: true,
});

export const insertSchemaVersionSchema = createInsertSchema(schema_versions).omit({
  id: true,
  created_at: true,
});

export const insertChangeAnalysisSchema = createInsertSchema(change_analyses).omit({
  id: true,
  created_at: true,
});

export const insertAlertConfigSchema = createInsertSchema(alert_configs).omit({
  id: true,
  created_at: true,
});

export const insertDiscoveredSpecSchema = createInsertSchema(discovered_specs).omit({
  id: true,
  created_at: true,
});

export const insertMonitoringConfigSchema = createInsertSchema(monitoring_configs).omit({
  id: true,
  created_at: true,
});

// Types
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertSpecSource = z.infer<typeof insertSpecSourceSchema>;
export type SpecSource = typeof spec_sources.$inferSelect;

export type InsertEnvironment = z.infer<typeof insertEnvironmentSchema>;
export type Environment = typeof environments.$inferSelect;

export type InsertSchemaVersion = z.infer<typeof insertSchemaVersionSchema>;
export type SchemaVersion = typeof schema_versions.$inferSelect;

export type InsertChangeAnalysis = z.infer<typeof insertChangeAnalysisSchema>;
export type ChangeAnalysis = typeof change_analyses.$inferSelect;

export type InsertAlertConfig = z.infer<typeof insertAlertConfigSchema>;
export type AlertConfig = typeof alert_configs.$inferSelect;

export type InsertDiscoveredSpec = z.infer<typeof insertDiscoveredSpecSchema>;
export type DiscoveredSpec = typeof discovered_specs.$inferSelect;

export type InsertMonitoringConfig = z.infer<typeof insertMonitoringConfigSchema>;
export type MonitoringConfig = typeof monitoring_configs.$inferSelect;

// User schema (keeping existing for auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// GitHub installations table
export const github_installations = pgTable("github_installations", {
  id: serial("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id).notNull(),
  installation_id: integer("installation_id").notNull(),
  account_login: varchar("account_login", { length: 255 }),
  account_type: varchar("account_type", { length: 50 }), // 'User' or 'Organization'
  permissions: json("permissions"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Relations for users and installations
export const usersRelations = relations(users, ({ many }) => ({
  githubInstallations: many(github_installations),
}));

export const githubInstallationsRelations = relations(github_installations, ({ one }) => ({
  user: one(users, {
    fields: [github_installations.user_id],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertGithubInstallationSchema = createInsertSchema(github_installations).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertGithubInstallation = z.infer<typeof insertGithubInstallationSchema>;
export type GithubInstallation = typeof github_installations.$inferSelect;
