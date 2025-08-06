import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Github, ExternalLink, Trash2, Settings, Slack, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface GitHubInstallation {
  id: number;
  user_id: string;
  installation_id: number;
  account_login: string;
  account_type: 'User' | 'Organization';
  permissions: any;
  created_at: string;
  updated_at: string;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string;
  url: string;
}

export default function Integrations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedInstallation, setSelectedInstallation] = useState<number | null>(null);

  // Handle OAuth callback success/error
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connected') === 'true') {
      toast({
        title: "GitHub Connected",
        description: "Successfully connected your GitHub account!",
      });
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('error') === 'connection_failed') {
      toast({
        title: "Connection Failed",
        description: "Failed to connect your GitHub account. Please try again.",
        variant: "destructive",
      });
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  // Check GitHub connection status
  const { data: githubStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/auth/github'],
  });

  // Fetch GitHub installations
  const { data: installations, isLoading: installationsLoading } = useQuery({
    queryKey: ['/api/github/installations'],
  });

  // Fetch repositories for selected installation
  const { data: repositories, isLoading: repositoriesLoading } = useQuery({
    queryKey: ['/api/github/installation', selectedInstallation, 'repositories'],
    enabled: !!selectedInstallation,
  });

  // Remove installation mutation
  const removeInstallationMutation = useMutation({
    mutationFn: (installationId: number) => 
      apiRequest(`/api/github/installation/${installationId}?userId=default-user`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/github/installations'] });
      toast({
        title: "Installation removed",
        description: "GitHub App installation has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove GitHub App installation.",
        variant: "destructive",
      });
    },
  });

  // Test repository scanning with installation
  const testScanMutation = useMutation({
    mutationFn: ({ repository, installationId }: { repository: string; installationId: number }) =>
      apiRequest('/api/discovery/repository-with-installation', {
        method: 'POST',
        body: { repository, installationId },
      }),
    onSuccess: (data) => {
      toast({
        title: "Repository scanned successfully",
        description: `Found ${(data as any).specsFound} OpenAPI specifications.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Scan failed",
        description: error.message || "Failed to scan repository.",
        variant: "destructive",
      });
    },
  });

  const handleInstallGitHubApp = async () => {
    try {
      // Get GitHub OAuth authorization URL from backend
      const response = await fetch('/api/auth/github/authorize', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Authorization failed: ${response.status}`);
      }
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();
      // Redirect to GitHub OAuth authorization
      window.location.href = data.authUrl;
    } catch (error: any) {
      console.error('GitHub OAuth error:', error);
      toast({
        title: "Connection Error", 
        description: error.message || "Failed to initiate GitHub connection.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveInstallation = (installationId: number) => {
    if (confirm('Are you sure you want to remove this GitHub App installation?')) {
      removeInstallationMutation.mutate(installationId);
    }
  };

  const handleTestScan = (repository: string, installationId: number) => {
    testScanMutation.mutate({ repository, installationId });
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Manage your GitHub App installations and repository access.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* GitHub App Installation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              GitHub Integration
            </CardTitle>
            <CardDescription>
              Connect your GitHub account to access your repositories and enable automatic monitoring.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {installationsLoading ? (
              <div className="text-center text-muted-foreground">Loading installations...</div>
            ) : (
              <>
                {installations && (installations as GitHubInstallation[]).length > 0 ? (
                  <div className="space-y-4">
                    <h4 className="font-medium">Connected Installations</h4>
                    {(installations as GitHubInstallation[]).map((installation: GitHubInstallation) => (
                      <div key={installation.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Github className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{installation.account_login}</div>
                            <Badge variant="secondary" className="text-xs">
                              {installation.account_type}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedInstallation(installation.installation_id)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveInstallation(installation.installation_id)}
                            disabled={removeInstallationMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No GitHub App installations found.
                  </div>
                )}
                
                <Button 
                  onClick={handleInstallGitHubApp}
                  className="w-full"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Connect GitHub Account
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Repository Access */}
        <Card>
          <CardHeader>
            <CardTitle>Repository Access</CardTitle>
            <CardDescription>
              {selectedInstallation 
                ? "Repositories accessible by the selected installation."
                : "Select an installation to view accessible repositories."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedInstallation ? (
              <div className="text-center text-muted-foreground py-8">
                Select a GitHub installation to view repositories.
              </div>
            ) : repositoriesLoading ? (
              <div className="text-center text-muted-foreground">Loading repositories...</div>
            ) : repositories && (repositories as Repository[]).length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {(repositories as Repository[]).map((repo: Repository) => (
                  <div key={repo.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <img
                        src={repo.owner.avatar_url}
                        alt={repo.owner.login}
                        className="w-6 h-6 rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{repo.full_name}</div>
                        {repo.description && (
                          <div className="text-sm text-muted-foreground truncate">
                            {repo.description}
                          </div>
                        )}
                        <Badge variant={repo.private ? "secondary" : "outline"} className="text-xs mt-1">
                          {repo.private ? "Private" : "Public"}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestScan(repo.full_name, selectedInstallation)}
                      disabled={testScanMutation.isPending}
                    >
                      Test Scan
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No repositories found for this installation.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Slack Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Slack className="h-5 w-5 text-purple-600" />
              Slack Integration
            </CardTitle>
            <CardDescription>
              Connect your Slack workspaces to receive API change notifications in real-time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Set up Slack notifications to get instant alerts when breaking changes are detected in your APIs.
            </div>
            <Link href="/settings/integrations/slack">
              <Button className="w-full">
                <ArrowRight className="mr-2 h-4 w-4" />
                Configure Slack Integration
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* GitHub App Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
          <CardDescription>
            Follow these steps to set up GitHub App integration for private repository access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <div className="font-medium">Install the GitHub App</div>
                <div className="text-sm text-muted-foreground">
                  Click "Install GitHub App" to authorize the app on your repositories.
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div>
                <div className="font-medium">Select Repositories</div>
                <div className="text-sm text-muted-foreground">
                  Choose which repositories the app can access during installation.
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div>
                <div className="font-medium">Connect Installation</div>
                <div className="text-sm text-muted-foreground">
                  The installation will automatically appear here once connected.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}