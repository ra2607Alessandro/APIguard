import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import StatsGrid from "@/components/stats-grid";
import RecentActivity from "@/components/recent-activity";
import ProjectHealthPanel from "@/components/project-health";
import SetupWizard from "@/components/setup-wizard";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { DashboardStats, RecentChange, ProjectHealth } from "@/types";

export default function Dashboard() {
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    queryFn: () => api.getDashboardStats(),
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: () => api.getProjects(),
  });

  if (error) {
    return (
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load dashboard data. Please try again later.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const stats: DashboardStats = dashboardData?.stats || {
    activeProjects: 0,
    breakingChanges: 0,
    safeChanges: 0,
    last24h: 0,
  };

  const recentChanges: RecentChange[] = dashboardData?.recentChanges?.map((change: any) => ({
    id: change.id,
    project_id: change.project_id,
    api_name: `API Change`, // Simplified for now
    description: change.analysis_summary || "API change detected",
    severity: change.severity,
    repository: "Unknown", // Would need project join
    commit_sha: change.new_version?.commit_sha,
    created_at: change.created_at,
  })) || [];

  const projectHealth: ProjectHealth[] = projects.map((project: any) => ({
    id: project.id,
    name: project.name,
    status: project.is_active ? 'healthy' : 'error',
    last_check: project.updated_at,
    breaking_changes_count: 0, // Would need analysis join
    safe_changes_count: 0,
  }));

  return (
    <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
            <p className="mt-1 text-sm text-gray-500">
              Monitor your API changes and track breaking changes across projects
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <Button
              onClick={() => setShowSetupWizard(true)}
              className="bg-primary text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Project
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <StatsGrid stats={stats} />
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <RecentActivity changes={recentChanges} />
          )}
        </div>

        <div>
          {projectsLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <ProjectHealthPanel projects={projectHealth} />
          )}
        </div>
      </div>

      {/* Setup Wizard */}
      <SetupWizard
        open={showSetupWizard}
        onOpenChange={setShowSetupWizard}
        onComplete={() => {
          refetch();
        }}
      />
    </main>
  );
}
