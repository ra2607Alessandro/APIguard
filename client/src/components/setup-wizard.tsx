import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ArrowRight, ArrowLeft, X, Info } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { SetupWizardData, DiscoveredSpec } from "@/types";

interface SetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const steps = [
  { id: 1, title: "Project & Source", description: "Name your project and add API spec" },
  { id: 2, title: "Notifications", description: "Set up alerts for breaking changes" },
  { id: 3, title: "Complete", description: "Review and finish setup" },
];

export default function SetupWizard({ open, onOpenChange, onComplete }: SetupWizardProps) {
  const { toast } = useToast();
  const [wizardData, setWizardData] = useState<SetupWizardData>({
    step: 1,
    projectName: "",
    githubRepository: "",
    monitoringFrequency: "daily",
    discoveredSpecs: [],
    alertChannels: [],
  });

  const [scanning, setScanning] = useState(false);

  const scanMutation = useMutation({
    mutationFn: (repository: string) => api.scanRepository(repository),
    onSuccess: (data) => {
      console.log('Repository scan result:', data);
      const specs: DiscoveredSpec[] = (data.specs || []).map((spec: any) => ({
        filePath: spec.filePath,
        apiName: spec.apiName,
        version: spec.version,
        selected: true,
      }));
      setWizardData(prev => ({ ...prev, discoveredSpecs: specs }));
      setScanning(false);
      
      if (specs.length > 0) {
        toast({
          title: "Repository scanned successfully",
          description: `Found ${specs.length} OpenAPI specification${specs.length === 1 ? '' : 's'}`,
        });
      } else {
        toast({
          title: "Repository scanned",
          description: data.message || "No OpenAPI specifications found",
          variant: "default",
        });
      }
    },
    onError: (error: any) => {
      setScanning(false);
      console.error('Repository scan error:', error);
      const errorMessage = error?.message || "Failed to scan repository";
      toast({
        title: "Scan failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      return await api.setupProject(data);
    },
    onSuccess: (result) => {
      console.log('Project setup result:', result);
      toast({
        title: "Project created successfully",
        description: result.message || "Your project has been set up successfully",
      });
      onComplete?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Project creation error:', error);
      toast({
        title: "Creation failed",
        description: error?.message || "Failed to create project",
        variant: "destructive",
      });
    },
  });

  const handleScanRepository = async () => {
    if (!wizardData.githubRepository.trim()) {
      toast({
        title: "Repository required",
        description: "Please enter a GitHub repository",
        variant: "destructive",
      });
      return;
    }

    setScanning(true);
    scanMutation.mutate(wizardData.githubRepository);
  };

  const handleSpecToggle = (index: number) => {
    setWizardData(prev => ({
      ...prev,
      discoveredSpecs: prev.discoveredSpecs.map((spec, i) =>
        i === index ? { ...spec, selected: !spec.selected } : spec
      ),
    }));
  };

  const handleNext = () => {
    if (wizardData.step < steps.length) {
      setWizardData(prev => ({ ...prev, step: prev.step + 1 }));
    }
  };

  const handlePrevious = () => {
    if (wizardData.step > 1) {
      setWizardData(prev => ({ ...prev, step: prev.step - 1 }));
    }
  };

  const handleComplete = () => {
    const selectedSpecs = wizardData.discoveredSpecs.filter(spec => spec.selected);
    
    const projectData = {
      name: wizardData.projectName,
      github_repo: wizardData.githubRepository,
      monitoring_frequency: wizardData.monitoringFrequency,
      discovered_specs: selectedSpecs.map(spec => ({
        filePath: spec.filePath,
        apiName: spec.apiName,
        version: spec.version,
      })),
      alert_configs: wizardData.alertChannels.filter(channel => channel.enabled).map(channel => ({
        channel_type: channel.type,
        config_data: channel.config,
      })),
    };
    
    console.log('Creating project with data:', projectData);
    createProjectMutation.mutate(projectData);
  };

  const canProceed = () => {
    switch (wizardData.step) {
      case 1:
        return wizardData.projectName.trim() && 
               wizardData.githubRepository.trim() && 
               wizardData.discoveredSpecs.some(spec => spec.selected);
      case 2:
        return true; // Alerts are optional
      case 3:
        return true;
      default:
        return false;
    }
  };

  const progressPercentage = (wizardData.step / steps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Setup New Project
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Steps */}
          <div className="space-y-4 mt-4">
            <Progress value={progressPercentage} className="w-full" />
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step.id === wizardData.step
                        ? "bg-primary text-white"
                        : step.id < wizardData.step
                        ? "bg-green-500 text-white"
                        : "bg-gray-300 text-gray-600"
                    }`}
                  >
                    {step.id}
                  </div>
                  <div className="ml-2 hidden sm:block">
                    <span
                      className={`text-sm font-medium ${
                        step.id === wizardData.step ? "text-primary" : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="flex-1 h-px bg-gray-300 mx-4 hidden sm:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="mt-6">
          {/* Step 1: Project & Source */}
          {wizardData.step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Your Project</h3>
                <p className="text-gray-600">Set up monitoring for your API specifications</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input
                    id="projectName"
                    placeholder="My API Project"
                    value={wizardData.projectName}
                    onChange={(e) =>
                      setWizardData(prev => ({ ...prev, projectName: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="githubRepo">GitHub Repository</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="githubRepo"
                      placeholder="owner/repo or https://github.com/owner/repo"
                      value={wizardData.githubRepository}
                      onChange={(e) =>
                        setWizardData(prev => ({ ...prev, githubRepository: e.target.value }))
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleScanRepository}
                      disabled={scanning || !wizardData.githubRepository.trim()}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      {scanning ? "Scanning..." : "Scan"}
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Enhanced detection searches 42+ locations and performs recursive scanning to find all OpenAPI specifications
                  </p>
                </div>

                {/* Scanning Status */}
                {scanning && (
                  <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-3"></div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-yellow-900">
                            Scanning repository for OpenAPI specifications...
                          </h4>
                          <p className="text-xs text-yellow-700 mt-1">
                            Checking 42+ common paths and performing recursive directory search
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Repository Scan Results */}
                {wizardData.discoveredSpecs.length > 0 && (
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-4">
                      <div className="flex items-start">
                        <Info className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-green-900">
                            ✅ Found {wizardData.discoveredSpecs.length} OpenAPI specification{wizardData.discoveredSpecs.length === 1 ? '' : 's'}
                          </h4>
                          <p className="text-xs text-green-700 mb-3">
                            Select the specifications you want to monitor for breaking changes
                          </p>
                          <div className="space-y-2">
                            {wizardData.discoveredSpecs.map((spec, index) => (
                              <label key={spec.filePath} className="flex items-center space-x-2 cursor-pointer hover:bg-green-100 p-2 rounded">
                                <Checkbox
                                  checked={spec.selected}
                                  onCheckedChange={() => handleSpecToggle(index)}
                                />
                                <div className="flex-1">
                                  <span className="text-sm font-medium text-gray-800">
                                    {spec.apiName}
                                    {spec.version && ` v${spec.version}`}
                                  </span>
                                  <br />
                                  <span className="text-xs text-gray-600">{spec.filePath}</span>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div>
                  <Label htmlFor="frequency">Monitoring Frequency</Label>
                  <Select
                    value={wizardData.monitoringFrequency}
                    onValueChange={(value) =>
                      setWizardData(prev => ({ ...prev, monitoringFrequency: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="push">Every push (recommended)</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Notifications */}
          {wizardData.step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Configure Notifications</h3>
                <p className="text-gray-600">Set up alerts for breaking changes (optional)</p>
              </div>

              <div className="text-center py-8">
                <p className="text-gray-500">Alert configuration coming soon</p>
                <p className="text-sm text-gray-400 mt-1">You can configure alerts after creating the project</p>
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {wizardData.step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Review & Complete</h3>
                <p className="text-gray-600">Review your project configuration and create the monitoring project</p>
              </div>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Project Name:</span>
                    <p className="text-gray-900 font-medium">{wizardData.projectName}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Repository:</span>
                    <p className="text-gray-900 font-medium">{wizardData.githubRepository}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Monitoring Frequency:</span>
                    <p className="text-gray-900 font-medium capitalize">{wizardData.monitoringFrequency}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Selected API Specifications:</span>
                    <div className="mt-2 space-y-2">
                      {wizardData.discoveredSpecs.filter(spec => spec.selected).map((spec) => (
                        <div key={spec.filePath} className="bg-gray-50 p-2 rounded text-sm">
                          <span className="font-medium text-gray-800">{spec.apiName}</span>
                          {spec.version && <span className="text-gray-600"> v{spec.version}</span>}
                          <br />
                          <span className="text-xs text-gray-500">{spec.filePath}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">What happens next?</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Enhanced monitoring will start automatically using GitHub App authentication</li>
                  <li>• The system will track changes using 42+ detection paths and recursive scanning</li>
                  <li>• Breaking changes will be analyzed and alerts sent based on severity</li>
                  <li>• You can view change history and analysis in the project dashboard</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={wizardData.step === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          {wizardData.step < steps.length ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? "Creating..." : "Complete Setup"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
