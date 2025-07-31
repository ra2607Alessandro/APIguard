import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Github, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ChangeTimeline } from "@/types";

interface ChangeTimelineProps {
  changes: ChangeTimeline[];
  onChangeSelect?: (changeId: string) => void;
  selectedChange?: string | null;
}

const typeConfig = {
  breaking: {
    color: "bg-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    badgeColor: "bg-red-100 text-red-800",
    label: "Breaking Change"
  },
  medium: {
    color: "bg-yellow-500",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    badgeColor: "bg-yellow-100 text-yellow-800",
    label: "Medium Risk"
  },
  safe: {
    color: "bg-green-500",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    badgeColor: "bg-green-100 text-green-800",
    label: "Safe Change"
  }
};

export default function ChangeTimeline({ changes, onChangeSelect, selectedChange }: ChangeTimelineProps) {
  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Timeline</CardTitle>
        <p className="text-sm text-gray-500">Recent API changes across all monitored projects</p>
      </CardHeader>
      <CardContent>
        {changes.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No changes detected</h3>
            <p className="text-gray-500">
              API changes will appear here when detected in your monitored repositories
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {changes.map((change, index) => {
              const config = typeConfig[change.type];
              const isSelected = selectedChange === change.id;
              const isLast = index === changes.length - 1;
              
              return (
                <div key={change.id} className="flex items-start space-x-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-4 h-4 ${config.color} rounded-full border-2 border-white shadow`} />
                    {!isLast && <div className="w-px h-16 bg-gray-200 mt-2" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div
                      className={`${config.bgColor} ${config.borderColor} rounded-lg p-4 border cursor-pointer transition-all hover:shadow-sm ${
                        isSelected ? 'ring-2 ring-primary ring-opacity-50' : ''
                      }`}
                      onClick={() => onChangeSelect?.(change.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge className={config.badgeColor}>
                              {config.label}
                            </Badge>
                            <span className="text-sm text-gray-500">{change.project}</span>
                          </div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">
                            {change.title}
                          </h4>
                          <p className="text-sm text-gray-600 mb-3">
                            {change.description}
                          </p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Github className="h-3 w-3 mr-1" />
                              {change.repository}
                            </span>
                            <span className="flex items-center">
                              <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                              commit {change.commit}
                            </span>
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatTimeAgo(change.timestamp)}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          className={`ml-4 ${
                            change.type === 'breaking' 
                              ? 'border-red-300 text-red-700 hover:bg-red-50' 
                              : change.type === 'medium'
                              ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                              : 'border-green-300 text-green-700 hover:bg-green-50'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onChangeSelect?.(change.id);
                          }}
                        >
                          {isSelected ? "Selected" : "View Details"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
