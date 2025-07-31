import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, TestTube, Mail, MessageSquare, Webhook, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

interface AlertConfig {
  id: string;
  project_id: string;
  channel_type: string;
  config_data: any;
  is_active: boolean;
  created_at: string;
}

export default function Alerts() {
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [newAlert, setNewAlert] = useState({
    channel_type: "email",
    config_data: {},
    is_active: true,
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: () => api.getProjects(),
  });

  const { data: alerts = [], isLoading: alertsLoading, error } = useQuery({
    queryKey: ["/api/projects", selectedProject, "alerts"],
    queryFn: () => selectedProject ? api.getAlertConfigs(selectedProject) : Promise.resolve([]),
    enabled: !!selectedProject,
  });

  const createAlertMutation = useMutation({
    mutationFn: (data: any) => api.createAlertConfig(selectedProject, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProject, "alerts"] });
      setNewAlert({ channel_type: "email", config_data: {}, is_active: true });
      toast({
        title: "Alert created",
        description: "Your alert configuration has been saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create alert",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const testAlertMutation = useMutation({
    mutationFn: (data: { channelType: string; configData: any }) => 
      api.testAlert(data.channelType, data.configData),
    onSuccess: (result) => {
      toast({
        title: result.success ? "Test successful" : "Test failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    },
    onError: (error) => {
      toast({
        title: "Test failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const handleCreateAlert = () => {
    if (!selectedProject) {
      toast({
        title: "Project required",
        description: "Please select a project first",
        variant: "destructive",
      });
      return;
    }

    createAlertMutation.mutate(newAlert);
  };

  const handleTestAlert = (alert: AlertConfig) => {
    testAlertMutation.mutate({
      channelType: alert.channel_type,
      configData: alert.config_data,
    });
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "email": return Mail;
      case "slack": return MessageSquare;
      case "webhook": return Webhook;
      default: return AlertCircle;
    }
  };

  const getChannelColor = (type: string) => {
    switch (type) {
      case "email": return "bg-blue-100 text-blue-800";
      case "slack": return "bg-purple-100 text-purple-800";
      case "webhook": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Alert Configuration</h2>
            <p className="mt-1 text-sm text-gray-500">
              Set up notifications for breaking changes and important events
            </p>
          </div>
        </div>
      </div>

      {/* Project Selection */}
      <div className="mb-6">
        <Label htmlFor="project-select">Select Project</Label>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue placeholder="Choose a project..." />
          </SelectTrigger>
          <SelectContent>
            {projectsLoading ? (
              <SelectItem value="loading">Loading projects...</SelectItem>
            ) : projects.length === 0 ? (
              <SelectItem value="none">No projects available</SelectItem>
            ) : (
              projects.map((project: any) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {selectedProject && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Existing Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Configured Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to load alerts. Please try again later.
                  </AlertDescription>
                </Alert>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts configured</h3>
                  <p className="text-gray-500">Set up your first alert to get notified of API changes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert: AlertConfig) => {
                    const Icon = getChannelIcon(alert.channel_type);
                    return (
                      <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Icon className="h-5 w-5 text-gray-500" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <Badge className={getChannelColor(alert.channel_type)}>
                                {alert.channel_type}
                              </Badge>
                              <span className={`text-sm ${alert.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                                {alert.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {alert.channel_type === 'email' && `Email: ${alert.config_data.to || 'Not configured'}`}
                              {alert.channel_type === 'slack' && `Channel: ${alert.config_data.channel || 'Not configured'}`}
                              {alert.channel_type === 'webhook' && `URL: ${alert.config_data.url || 'Not configured'}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestAlert(alert)}
                            disabled={testAlertMutation.isPending}
                          >
                            <TestTube className="h-4 w-4 mr-2" />
                            Test
                          </Button>
                          <Switch checked={alert.is_active} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add New Alert */}
          <Card>
            <CardHeader>
              <CardTitle>Add New Alert</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={newAlert.channel_type} onValueChange={(value) => 
                setNewAlert(prev => ({ ...prev, channel_type: value, config_data: {} }))
              }>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="email">Email</TabsTrigger>
                  <TabsTrigger value="slack">Slack</TabsTrigger>
                  <TabsTrigger value="webhook">Webhook</TabsTrigger>
                </TabsList>

                <TabsContent value="email" className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="alerts@company.com"
                      value={newAlert.config_data.to || ""}
                      onChange={(e) => setNewAlert(prev => ({
                        ...prev,
                        config_data: { ...prev.config_data, to: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      placeholder="API Sentinel Alert"
                      value={newAlert.config_data.subject || ""}
                      onChange={(e) => setNewAlert(prev => ({
                        ...prev,
                        config_data: { ...prev.config_data, subject: e.target.value }
                      }))}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="slack" className="space-y-4">
                  <div>
                    <Label htmlFor="slack-channel">Channel ID</Label>
                    <Input
                      id="slack-channel"
                      placeholder="C1234567890"
                      value={newAlert.config_data.channel || ""}
                      onChange={(e) => setNewAlert(prev => ({
                        ...prev,
                        config_data: { ...prev.config_data, channel: e.target.value }
                      }))}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Use Channel ID (preferred) or channel name like #alerts
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="webhook" className="space-y-4">
                  <div>
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input
                      id="webhook-url"
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={newAlert.config_data.url || ""}
                      onChange={(e) => setNewAlert(prev => ({
                        ...prev,
                        config_data: { ...prev.config_data, url: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="webhook-method">HTTP Method</Label>
                    <Select
                      value={newAlert.config_data.method || "POST"}
                      onValueChange={(value) => setNewAlert(prev => ({
                        ...prev,
                        config_data: { ...prev.config_data, method: value }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex items-center space-x-2 mt-6">
                <Switch
                  checked={newAlert.is_active}
                  onCheckedChange={(checked) => setNewAlert(prev => ({ ...prev, is_active: checked }))}
                />
                <Label>Active</Label>
              </div>

              <Button
                onClick={handleCreateAlert}
                disabled={createAlertMutation.isPending}
                className="w-full mt-6"
              >
                <Plus className="h-4 w-4 mr-2" />
                {createAlertMutation.isPending ? "Creating..." : "Create Alert"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedProject && (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a project</h3>
          <p className="text-gray-500">
            Choose a project above to view and configure its alert settings
          </p>
        </div>
      )}
    </main>
  );
}
