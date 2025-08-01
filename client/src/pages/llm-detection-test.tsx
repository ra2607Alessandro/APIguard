import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Zap, Clock, GitBranch } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface DetectionResult {
  filePath: string;
  apiName: string;
  version?: string;
  confidence?: number;
  specType?: string;
}

interface ComparisonReport {
  repository: string;
  timestamp: string;
  comparison: {
    patternMatchingResults: DetectionResult[];
    llmDetectionResults: DetectionResult[];
    improvementMetrics: {
      additionalSpecsFound: number;
      falsePositivesReduced: number;
      processingTimeComparison: number;
    };
  };
  summary: {
    llmFound: number;
    patternFound: number;
    improvement: {
      additionalSpecs: number;
      processingTime: number;
    };
  };
}

export default function LLMDetectionTest() {
  const [repository, setRepository] = useState('ra2607Alessandro/success');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompareDetection = async () => {
    if (!repository.trim()) {
      setError('Please enter a repository name');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/discovery/compare-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repository: repository.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to compare detection methods');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to compare detection methods');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">LLM-Based API Spec Detection</h1>
          <p className="text-muted-foreground">
            Compare LLM-powered intelligent detection vs traditional pattern matching
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Detection Method Comparison
            </CardTitle>
            <CardDescription>
              Test the new LLM-based detection system against the old pattern-matching approach
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Enter repository (e.g., owner/repo or GitHub URL)"
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button onClick={handleCompareDetection} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <GitBranch className="h-4 w-4 mr-2" />
                    Compare Methods
                  </>
                )}
              </Button>
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">LLM Detection</p>
                      <p className="text-2xl font-bold">{result.summary.llmFound}</p>
                    </div>
                    <Zap className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Pattern Matching</p>
                      <p className="text-2xl font-bold">{result.summary.patternFound}</p>
                    </div>
                    <GitBranch className="h-8 w-8 text-gray-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Improvement</p>
                      <p className="text-2xl font-bold text-green-600">
                        +{result.summary.improvement.additionalSpecs}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Results */}
            <Card>
              <CardHeader>
                <CardTitle>Detection Results for {result.repository}</CardTitle>
                <CardDescription>
                  Tested on {new Date(result.timestamp).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="llm" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="llm" className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      LLM Detection ({result.summary.llmFound})
                    </TabsTrigger>
                    <TabsTrigger value="pattern" className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      Pattern Matching ({result.summary.patternFound})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="llm" className="space-y-4">
                    {result.comparison.llmDetectionResults.length > 0 ? (
                      <div className="space-y-3">
                        {result.comparison.llmDetectionResults.map((spec, index) => (
                          <Card key={index} className="border-blue-200">
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <h4 className="font-semibold">{spec.apiName}</h4>
                                  <p className="text-sm text-muted-foreground">{spec.filePath}</p>
                                  {spec.version && (
                                    <Badge variant="secondary">v{spec.version}</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {spec.confidence && (
                                    <Badge variant="outline">
                                      {spec.confidence}/10 confidence
                                    </Badge>
                                  )}
                                  {spec.specType && (
                                    <Badge variant="outline">{spec.specType}</Badge>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Alert>
                        <AlertDescription>No API specs detected by LLM analysis</AlertDescription>
                      </Alert>
                    )}
                  </TabsContent>

                  <TabsContent value="pattern" className="space-y-4">
                    {result.comparison.patternMatchingResults.length > 0 ? (
                      <div className="space-y-3">
                        {result.comparison.patternMatchingResults.map((spec, index) => (
                          <Card key={index} className="border-gray-200">
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <h4 className="font-semibold">{spec.apiName}</h4>
                                  <p className="text-sm text-muted-foreground">{spec.filePath}</p>
                                  {spec.version && (
                                    <Badge variant="secondary">v{spec.version}</Badge>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Alert>
                        <AlertDescription>No API specs detected by pattern matching</AlertDescription>
                      </Alert>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Additional Specs Found</p>
                    <p className="text-xl font-bold text-green-600">
                      +{result.comparison.improvementMetrics.additionalSpecsFound}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Processing Time</p>
                    <p className="text-xl font-bold">
                      {result.comparison.improvementMetrics.processingTimeComparison}ms
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}