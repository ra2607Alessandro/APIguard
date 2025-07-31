import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Lightbulb, Target, Code } from "lucide-react";
import type { ImpactAnalysis } from "@/types";

interface ImpactAnalysisProps {
  analysis: ImpactAnalysis;
}

const severityConfig = {
  critical: {
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    icon: AlertTriangle,
  },
  high: {
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    icon: AlertTriangle,
  },
  medium: {
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    icon: AlertTriangle,
  },
  low: {
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: Target,
  },
};

export default function ImpactAnalysis({ analysis }: ImpactAnalysisProps) {
  const config = severityConfig[analysis.severity];
  const ImpactIcon = config.icon;

  return (
    <>
      {/* Impact Analysis Card */}
      <Card>
        <CardHeader>
          <CardTitle>Impact Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`${config.borderColor} ${config.bgColor} border-l-4 pl-4 py-3`}>
            <div className="flex items-center space-x-2 mb-2">
              <ImpactIcon className={`h-5 w-5 ${config.color}`} />
              <h4 className="font-medium text-gray-900">
                {analysis.severity.charAt(0).toUpperCase() + analysis.severity.slice(1)} Impact
              </h4>
            </div>
            <p className="text-sm text-gray-600">{analysis.impact}</p>
          </div>

          <div className="border-l-4 border-yellow-500 bg-yellow-50 pl-4 py-3">
            <div className="flex items-center space-x-2 mb-2">
              <Lightbulb className="h-5 w-5 text-yellow-600" />
              <h4 className="font-medium text-gray-900">Recommended Action</h4>
            </div>
            <p className="text-sm text-gray-600">{analysis.recommendation}</p>
          </div>

          {analysis.affectedEndpoints.length > 0 && (
            <div className="border-l-4 border-blue-500 bg-blue-50 pl-4 py-3">
              <div className="flex items-center space-x-2 mb-2">
                <Target className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-gray-900">Affected Endpoints</h4>
              </div>
              <div className="space-y-1">
                {analysis.affectedEndpoints.map((endpoint, index) => (
                  <div key={index} className="font-mono text-sm bg-white px-2 py-1 rounded border">
                    {endpoint}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Level Badge */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Risk Level</span>
              <Badge
                className={
                  analysis.severity === 'critical'
                    ? 'bg-red-100 text-red-800'
                    : analysis.severity === 'high'
                    ? 'bg-orange-100 text-orange-800'
                    : analysis.severity === 'medium'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }
              >
                {analysis.severity.toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Diff Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Code className="h-5 w-5" />
            <span>Change Diff</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-gray-100 font-mono whitespace-pre-wrap">
              {analysis.changeDiff}
            </pre>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            <p>
              <span className="text-red-400">Red lines</span> show removed content,{" "}
              <span className="text-green-400">green lines</span> show added content.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
