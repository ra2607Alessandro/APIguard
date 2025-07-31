import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github } from "lucide-react";
import { Link } from "wouter";
import type { RecentChange } from "@/types";

interface RecentActivityProps {
  changes: RecentChange[];
}

const severityConfig = {
  critical: { color: "bg-red-100 text-red-800", dot: "bg-red-500" },
  high: { color: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
  medium: { color: "bg-yellow-100 text-yellow-800", dot: "bg-yellow-500" },
  low: { color: "bg-green-100 text-green-800", dot: "bg-green-500" },
};

export default function RecentActivity({ changes }: RecentActivityProps) {
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Less than 1 hour ago";
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical': return 'Breaking';
      case 'high': return 'High Risk';
      case 'medium': return 'Medium Risk';
      case 'low': return 'Safe';
      default: return severity;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">Recent Changes</CardTitle>
        <p className="text-sm text-gray-500">Latest API changes detected across your projects</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-200">
          {changes.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-gray-500">No recent changes detected</p>
              <p className="text-sm text-gray-400 mt-1">Changes will appear here when your APIs are modified</p>
            </div>
          ) : (
            changes.map((change) => {
              const config = severityConfig[change.severity] || severityConfig.low;
              return (
                <div key={change.id} className="px-6 py-4">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className={`w-2 h-2 ${config.dot} rounded-full mt-2`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">{change.api_name}</p>
                        <Badge className={config.color}>
                          {getSeverityLabel(change.severity)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mb-2">{change.description}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Github className="h-3 w-3 mr-1" />
                          {change.repository}
                        </span>
                        <span>{formatTimeAgo(change.created_at)}</span>
                        {change.commit_sha && (
                          <span>commit {change.commit_sha.substring(0, 7)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <Link href="/monitoring">
            <Button variant="ghost" className="text-sm font-medium text-primary hover:text-blue-700">
              View all changes <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
