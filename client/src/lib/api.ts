// client/src/lib/api.ts
const API_BASE = '/api';

class ApiClient {
  private async request(method: string, url: string, data?: any) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(`${API_BASE}${url}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
    });

    if (!response.ok) {
      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || `${response.status} ${response.statusText}`;
      } catch {
        errorMessage = await response.text() || `${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null;
    }
    return response.json();
  }

  // Projects
  async getProjects() {
    return this.request('GET', '/projects');
  }

  async createProject(project: any) {
    return this.request('POST', '/projects', project);
  }

  async getProject(id: string) {
    return this.request('GET', `/projects/${id}`);
  }

  async updateProject(id: string, project: any) {
    return this.request('PUT', `/projects/${id}`, project);
  }

  async deleteProject(id: string) {
    return this.request('DELETE', `/projects/${id}`);
  }

  // Enhanced project setup with spec sources
  async setupProject(projectData: any) {
    return this.request('POST', '/projects/setup', projectData);
  }

  // Spec Sources
  async getSpecSources(projectId: string) {
    return this.request('GET', `/projects/${projectId}/specs`);
  }

  async createSpecSource(projectId: string, specSource: any) {
    return this.request('POST', `/projects/${projectId}/specs`, specSource);
  }

  // Repository Scanning
  async scanRepository(repository: string) {
    return this.request('POST', '/discovery/repository', { repository });
  }

  async getDiscoveryReport(owner: string, repo: string) {
    return this.request('GET', `/discovery/report/${owner}/${repo}`);
  }

  // Alert Configs
  async getAlertConfigs(projectId: string) {
    return this.request('GET', `/projects/${projectId}/alerts`);
  }

  async createAlertConfig(projectId: string, alertConfig: any) {
    return this.request('POST', `/projects/${projectId}/alerts`, alertConfig);
  }

  async testAlert(channelType: string, configData: any) {
    return this.request('POST', '/alerts/test', { channelType, configData });
  }

  // Dashboard
  async getDashboardStats() {
    return this.request('GET', '/dashboard/stats');
  }

  // Schema Comparison
  async compareSchemas(oldSchema: any, newSchema: any) {
    return this.request('POST', '/schemas/compare', { oldSchema, newSchema });
  }

  // Change History
  async getChangeHistory(projectId: string) {
    return this.request('GET', `/projects/${projectId}/history`);
  }

  // Manual Monitoring
  async triggerManualCheck(projectId: string) {
    return this.request('POST', `/projects/${projectId}/monitoring/trigger`);
  }

  // Debug endpoint
  async getMonitoringDebugInfo() {
    return this.request('GET', '/debug/monitoring');
  }
}

export const api = new ApiClient();