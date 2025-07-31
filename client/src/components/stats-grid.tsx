import { Card, CardContent } from "@/components/ui/card";
import { FolderOpen, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import type { DashboardStats } from "@/types";

interface StatsGridProps {
  stats: DashboardStats;
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const statItems = [
    {
      label: "Active Projects",
      value: stats.activeProjects,
      icon: FolderOpen,
      bgColor: "bg-blue-100",
      iconColor: "text-primary",
    },
    {
      label: "Breaking Changes",
      value: stats.breakingChanges,
      icon: AlertTriangle,
      bgColor: "bg-red-100",
      iconColor: "text-red-600",
    },
    {
      label: "Safe Changes",
      value: stats.safeChanges,
      icon: CheckCircle,
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      label: "Last 24h",
      value: stats.last24h,
      icon: Clock,
      bgColor: "bg-yellow-100",
      iconColor: "text-yellow-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 ${item.bgColor} rounded-lg flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${item.iconColor}`} />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">{item.label}</p>
                  <p className="text-2xl font-semibold text-gray-900">{item.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
