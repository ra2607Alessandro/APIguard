import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Search, Bell, GitBranch } from "lucide-react";
import { Link } from "wouter";
import type { ProjectHealth } from "@/types";

interface ProjectHealthProps {
  projects: ProjectHealth[];
}

const statusConfig = {
  healthy: { color: "bg-green-500", label: "Last check: 2 min ago" },
  warning: { color: "bg-yellow-500", label: "Medium risk changes" },
  error: { color: "bg-red-500", label: "Breaking changes detected" },
};

export default function ProjectHealthPanel({ projects }: ProjectHealthProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900">Project Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {projects.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500">No projects configured</p>
              <p className="text-sm text-gray-400 mt-1">Add your first project to start monitoring</p>
            </div>
          ) : (
            projects.map((project) => {
              const config = statusConfig[project.status] || statusConfig.healthy;
              return (
                <div key={project.id} className="flex items-center justify-between group hover:bg-gray-50 p-2 rounded-lg transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 ${config.color} rounded-full`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{project.name}</p>
                      <p className="text-xs text-gray-500">
                        {project.last_check ? formatTimeAgo(project.last_check) : "Never checked"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href="/projects">
            <Button variant="outline" className="w-full justify-start">
              <Search className="h-4 w-4 mr-3 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">Scan Repository</p>
                <p className="text-xs text-gray-500">Discover new API specs</p>
              </div>
            </Button>
          </Link>
          
          <Link href="/alerts">
            <Button variant="outline" className="w-full justify-start">
              <Bell className="h-4 w-4 mr-3 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">Configure Alerts</p>
                <p className="text-xs text-gray-500">Set up notifications</p>
              </div>
            </Button>
          </Link>
          
          <Link href="/integrations">
            <Button variant="outline" className="w-full justify-start">
              <GitBranch className="h-4 w-4 mr-3 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">CI/CD Integration</p>
                <p className="text-xs text-gray-500">Block risky deployments</p>
              </div>
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}
