import { apiRequest } from "./queryClient";

export const api = {
  // Projects
  getProjects: () => fetch("/api/projects").then(res => res.json()),
  createProject: (data: any) => apiRequest("POST", "/api/projects", data),
  updateProject: (id: string, data: any) => apiRequest("PUT", `/api/projects/${id}`, data),
  deleteProject: (id: string) => apiRequest("DELETE", `/api/projects/${id}`),

  // Discovery
  scanRepository: (repository: string) => 
    apiRequest("POST", "/api/discovery/repository", { repository }).then(res => res.json()),
  getDiscoveryReport: (owner: string, repo: string) => 
    fetch(`/api/discovery/report/${owner}/${repo}`).then(res => res.json()),

  // Spec sources
  getSpecSources: (projectId: string) => 
    fetch(`/api/projects/${projectId}/specs`).then(res => res.json()),
  createSpecSource: (projectId: string, data: any) => 
    apiRequest("POST", `/api/projects/${projectId}/specs`, data),

  // Change history
  getChangeHistory: (projectId: string) => 
    fetch(`/api/projects/${projectId}/history`).then(res => res.json()),

  // Schema comparison
  compareSchemas: (oldSchema: any, newSchema: any) => 
    apiRequest("POST", "/api/schemas/compare", { oldSchema, newSchema }).then(res => res.json()),

  // Alerts
  getAlertConfigs: (projectId: string) => 
    fetch(`/api/projects/${projectId}/alerts`).then(res => res.json()),
  createAlertConfig: (projectId: string, data: any) => 
    apiRequest("POST", `/api/projects/${projectId}/alerts`, data),
  testAlert: (channelType: string, configData: any) => 
    apiRequest("POST", "/api/alerts/test", { channelType, configData }).then(res => res.json()),

  // Dashboard
  getDashboardStats: () => 
    fetch("/api/dashboard/stats").then(res => res.json()),

  // Monitoring
  triggerManualCheck: (projectId: string) => 
    apiRequest("POST", `/api/projects/${projectId}/monitoring/trigger`),

  // CI/CD
  validateDeployment: (projectId: string, newSchema: any, environment?: string) => 
    apiRequest("POST", "/api/ci/validate", { projectId, newSchema, environment }).then(res => res.json()),
};
