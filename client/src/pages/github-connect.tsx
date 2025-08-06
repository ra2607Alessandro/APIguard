import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Github, GitBranch, Star, Users } from "lucide-react";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  language: string;
  private: boolean;
  default_branch: string;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export function GitHubConnectPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connectingRepo, setConnectingRepo] = useState<number | null>(null);

  const { data: repositories, isLoading } = useQuery<GitHubRepo[]>({
    queryKey: ["/api/auth/github/repositories"],
    enabled: !!localStorage.getItem("auth-token"),
    retry: false,
  });

  const connectGitHubMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/github", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth-token")}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "GitHub connection failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      window.location.href = data.authURL;
    },
    onError: (error: any) => {
      toast({
        title: "GitHub connection failed",
        description: error.message || "Failed to connect to GitHub",
        variant: "destructive",
      });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (repoData: GitHubRepo) => {
      const response = await fetch("/api/projects/from-repo", {
        method: "POST",
        body: JSON.stringify({ repoData }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth-token")}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create project");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Project created successfully",
        description: "Your repository has been added to API Sentinel",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setConnectingRepo(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create project",
        description: error.message || "Failed to create project from repository",
        variant: "destructive",
      });
      setConnectingRepo(null);
    },
  });

  const handleConnectRepo = (repo: GitHubRepo) => {
    setConnectingRepo(repo.id);
    createProjectMutation.mutate(repo);
  };

  if (!localStorage.getItem("auth-token")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to connect your GitHub repositories</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-6 w-6" />
            Connect GitHub Repositories
          </CardTitle>
          <CardDescription>
            Connect your GitHub repositories to start monitoring API changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!repositories && !isLoading && (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Connect your GitHub account to access your repositories
              </p>
              <Button
                onClick={() => connectGitHubMutation.mutate()}
                disabled={connectGitHubMutation.isPending}
                data-testid="button-connect-github"
              >
                <Github className="mr-2 h-4 w-4" />
                {connectGitHubMutation.isPending ? "Connecting..." : "Connect GitHub"}
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading repositories...</p>
            </div>
          )}

          {repositories && repositories.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Your Repositories</h3>
                <Badge variant="secondary">
                  {repositories.length} repositories
                </Badge>
              </div>
              <Separator />
              <div className="grid gap-4">
                {repositories.map((repo: GitHubRepo) => (
                  <Card key={repo.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">{repo.full_name}</h4>
                          {repo.private && (
                            <Badge variant="outline" className="text-xs">
                              Private
                            </Badge>
                          )}
                          {repo.language && (
                            <Badge variant="secondary" className="text-xs">
                              {repo.language}
                            </Badge>
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-sm text-muted-foreground">
                            {repo.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {repo.stargazers_count}
                          </div>
                          <div className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            {repo.default_branch}
                          </div>
                          <div>
                            Updated: {new Date(repo.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleConnectRepo(repo)}
                        disabled={connectingRepo === repo.id}
                        size="sm"
                        data-testid={`button-connect-repo-${repo.id}`}
                      >
                        {connectingRepo === repo.id ? "Adding..." : "Add to Sentinel"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {repositories && repositories.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No repositories found. Make sure you have repositories in your GitHub account.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}