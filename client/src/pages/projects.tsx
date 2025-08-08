import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Search, Github, ArrowRight } from "lucide-react";
import ProjectsTable from "@/components/projects-table";
import SetupWizard from "@/components/setup-wizard";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { Link } from "wouter";

export default function Projects() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Check GitHub connection status
  const { data: githubStatus, isLoading: githubStatusLoading } = useQuery({
    queryKey: ["/api/auth/github"],
    enabled: isAuthenticated && !authLoading,
  });

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: () => api.getProjects(),
    enabled: isAuthenticated && !authLoading,
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  // Show loading while auth is being determined
  if (authLoading) {
    return (
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div>Loading projects...</div>
      </main>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load projects. Please try again later.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const filteredProjects = projects.filter((project: any) => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (project.github_repo && project.github_repo.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && project.is_active) ||
                         (statusFilter === "paused" && !project.is_active);
    return matchesSearch && matchesStatus;
  });

  return (
    <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage your API monitoring projects and configurations
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-3">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            {githubStatus?.connected ? (
              <Button onClick={() => setShowSetupWizard(true)} data-testid="button-new-project">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            ) : (
              <Link href="/integrations">
                <Button data-testid="button-connect-github">
                  <Github className="h-4 w-4 mr-2" />
                  Connect GitHub First
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* GitHub Connection Alert */}
      {!githubStatusLoading && !githubStatus?.connected && (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Github className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <div className="flex items-center justify-between">
              <span>
                Connect your GitHub account to start creating projects and monitoring your repositories.
              </span>
              <Link href="/integrations">
                <Button size="sm" className="ml-4" data-testid="button-setup-github">
                  Setup GitHub
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters Section */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">All Projects</h3>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Projects Table */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <Skeleton className="h-8 w-full mb-4" />
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full mb-2" />
            ))}
          </div>
        </div>
      ) : (
        <ProjectsTable 
          projects={filteredProjects} 
          onDeleteProject={(id) => deleteProjectMutation.mutate(id)}
          isDeleting={deleteProjectMutation.isPending}
        />
      )}

      {/* Setup Wizard */}
      <SetupWizard
        open={showSetupWizard}
        onOpenChange={setShowSetupWizard}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        }}
      />
    </main>
  );
}
