export interface DashboardStats {
  activeProjects: number;
  breakingChanges: number;
  safeChanges: number;
  last24h: number;
}

export interface RecentChange {
  id: string;
  project_id: string;
  api_name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  repository: string;
  commit_sha?: string;
  created_at: string;
}

export interface ProjectHealth {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'error';
  last_check?: string;
  breaking_changes_count: number;
  safe_changes_count: number;
}

export interface DiscoveredSpec {
  filePath: string;
  apiName: string;
  version?: string;
  selected: boolean;
}

export interface SetupWizardData {
  step: number;
  projectName: string;
  githubRepository: string;
  monitoringFrequency: string;
  discoveredSpecs: DiscoveredSpec[];
  alertChannels: AlertChannelConfig[];
}

export interface AlertChannelConfig {
  type: 'slack' | 'email' | 'github' | 'webhook';
  name: string;
  config: Record<string, any>;
  enabled: boolean;
}

export interface ChangeTimeline {
  id: string;
  type: 'breaking' | 'safe' | 'medium';
  title: string;
  description: string;
  project: string;
  repository: string;
  commit: string;
  timestamp: string;
  details?: {
    impact?: string;
    recommendation?: string;
    affectedEndpoints?: string[];
  };
}

export interface ImpactAnalysis {
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  recommendation: string;
  affectedEndpoints: string[];
  changeDiff: string;
}
