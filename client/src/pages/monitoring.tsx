import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import ChangeTimeline from "@/components/change-timeline";
import ImpactAnalysis from "@/components/impact-analysis";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChangeTimeline as ChangeTimelineType, ImpactAnalysis as ImpactAnalysisType } from "@/types";

export default function Monitoring() {
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedChange, setSelectedChange] = useState<string | null>(null);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: () => api.getProjects(),
  });

  const { data: allChanges = [], isLoading: changesLoading, error } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    queryFn: () => api.getDashboardStats(),
  });

  if (error) {
    return (
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load monitoring data. Please try again later.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  // Transform API data to timeline format
  const timelineChanges: ChangeTimelineType[] = allChanges.recentChanges?.map((change: any) => ({
    id: change.id,
    type: change.severity === 'critical' ? 'breaking' : change.severity === 'medium' ? 'medium' : 'safe',
    title: change.analysis_summary || "API change detected",
    description: `Changes detected in API specification`,
    project: "Unknown Project", // Would need project name from join
    repository: "github.com/repo", // Would need from project
    commit: change.new_version?.commit_sha?.substring(0, 7) || "unknown",
    timestamp: change.created_at,
    details: {
      impact: change.severity === 'critical' 
        ? "Critical impact - may break existing clients"
        : "Safe change - backward compatible",
      recommendation: change.severity === 'critical'
        ? "Review changes before deployment"
        : "Safe to deploy",
      affectedEndpoints: [], // Would parse from breaking_changes
    }
  })) || [];

  const filteredChanges = selectedProject === "all" 
    ? timelineChanges 
    : timelineChanges.filter(change => change.project === selectedProject);

  const selectedChangeData = selectedChange 
    ? timelineChanges.find(change => change.id === selectedChange)
    : timelineChanges[0]; // Default to first change

  const impactAnalysis: ImpactAnalysisType | null = selectedChangeData ? {
    severity: selectedChangeData.type === 'breaking' ? 'critical' : 
              selectedChangeData.type === 'medium' ? 'medium' : 'low',
    impact: selectedChangeData.details?.impact || "No impact analysis available",
    recommendation: selectedChangeData.details?.recommendation || "No recommendation available",
    affectedEndpoints: selectedChangeData.details?.affectedEndpoints || [],
    changeDiff: `// Example diff for ${selectedChangeData.title}\n- old parameter\n+ new parameter`,
  } : null;

  return (
    <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Live Monitoring</h2>
            <p className="mt-1 text-sm text-gray-500">
              Real-time analysis of API changes and their impact
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-3">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project: any) => (
                  <SelectItem key={project.id} value={project.name}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>
      </div>

      {/* Change Timeline */}
      <div className="mb-8">
        {changesLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <ChangeTimeline 
            changes={filteredChanges} 
            onChangeSelect={setSelectedChange}
            selectedChange={selectedChange}
          />
        )}
      </div>

      {/* Impact Analysis */}
      {impactAnalysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {changesLoading ? (
            <>
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </>
          ) : (
            <ImpactAnalysis analysis={impactAnalysis} />
          )}
        </div>
      )}

      {/* Empty State */}
      {!changesLoading && filteredChanges.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No changes detected</h3>
          <p className="text-gray-500">
            {selectedProject === "all" 
              ? "No API changes have been detected across any projects"
              : `No changes detected for ${selectedProject}`
            }
          </p>
        </div>
      )}
    </main>
  );
}
