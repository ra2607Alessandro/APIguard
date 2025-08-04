import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Slack, Plus, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SlackWorkspace {
  id: string;
  team_id: string;
  team_name: string;
  bot_user_id: string;
  created_at: string;
}

interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
}

export default function SlackIntegrationPage() {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get URL parameters for OAuth callback handling
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    const error = urlParams.get('error');
    const workspaceId = urlParams.get('workspace');

    if (connected && workspaceId) {
      toast({
        title: "Slack Workspace Connected",
        description: "Your Slack workspace has been successfully connected to API Sentinel.",
      });
      // Clear URL parameters
      window.history.replaceState({}, '', '/settings/integrations/slack');
    } else if (error) {
      toast({
        title: "Connection Failed",
        description: `Failed to connect Slack workspace: ${error}`,
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/settings/integrations/slack');
    }
  }, [toast]);

  // Fetch projects
  const { data: projects } = useQuery({
    queryKey: ["/api/projects"],
  });

  // Fetch Slack workspaces for selected project
  const { data: workspaces, isLoading: workspacesLoading } = useQuery({
    queryKey: ["/api/projects", selectedProject, "slack/workspaces"],
    enabled: !!selectedProject,
  });

  // Fetch channels for selected workspace
  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ["/api/slack/workspaces", selectedWorkspace, "channels"],
    enabled: !!selectedWorkspace,
  });

  // Connect new workspace mutation
  const connectWorkspace = useMutation({
    mutationFn: async () => {
      if (!selectedProject) throw new Error("No project selected");
      window.location.href = `/api/slack/oauth/start?projectId=${selectedProject}`;
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test notification mutation
  const testNotification = useMutation({
    mutationFn: async () => {
      if (!selectedWorkspace || !selectedChannel) {
        throw new Error("Please select a workspace and channel first");
      }

      return apiRequest("/api/slack/test", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: selectedWorkspace,
          channelId: selectedChannel,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Test Successful",
        description: "Test notification sent to Slack channel successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test notification",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-8" data-testid="slack-integration-page">
      <div className="flex items-center gap-3">
        <Slack className="h-8 w-8 text-purple-600" />
        <div>
          <h1 className="text-3xl font-bold">Slack Integration</h1>
          <p className="text-muted-foreground">
            Connect your Slack workspaces to receive API change notifications
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Project Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              Step 1: Select Project
            </CardTitle>
            <CardDescription>
              Choose which project you want to set up Slack notifications for
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger data-testid="select-project">
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                {(projects as any[])?.map((project: any) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Workspace Management */}
        {selectedProject && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                Step 2: Connect Slack Workspace
              </CardTitle>
              <CardDescription>
                Connect a Slack workspace to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {workspacesLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                  <span>Loading workspaces...</span>
                </div>
              ) : (
                <>
                  {(workspaces as SlackWorkspace[])?.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Connected Workspaces:</h4>
                      {(workspaces as SlackWorkspace[]).map((workspace: SlackWorkspace) => (
                        <div
                          key={workspace.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <div>
                              <div className="font-medium">{workspace.team_name}</div>
                              <div className="text-sm text-muted-foreground">
                                Connected {new Date(workspace.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary">Connected</Badge>
                        </div>
                      ))}
                      <Separator />
                    </div>
                  )}

                  <Button
                    onClick={() => connectWorkspace.mutate()}
                    disabled={connectWorkspace.isPending}
                    className="w-full"
                    data-testid="button-connect-workspace"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {connectWorkspace.isPending ? "Connecting..." : "Connect New Workspace"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Channel Selection */}
        {(workspaces as SlackWorkspace[])?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                Step 3: Configure Notifications
              </CardTitle>
              <CardDescription>
                Select a workspace and channel for receiving notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-2 block">Workspace</label>
                  <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                    <SelectTrigger data-testid="select-workspace">
                      <SelectValue placeholder="Select workspace..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(workspaces as SlackWorkspace[]).map((workspace: SlackWorkspace) => (
                        <SelectItem key={workspace.id} value={workspace.id}>
                          {workspace.team_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Channel</label>
                  <Select
                    value={selectedChannel}
                    onValueChange={setSelectedChannel}
                    disabled={!selectedWorkspace}
                  >
                    <SelectTrigger data-testid="select-channel">
                      <SelectValue placeholder="Select channel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {channelsLoading ? (
                        <div className="p-2">Loading channels...</div>
                      ) : (
                        (channels as SlackChannel[])?.map((channel: SlackChannel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            #{channel.name}
                            {channel.isPrivate && (
                              <Badge variant="outline" className="ml-2">Private</Badge>
                            )}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedWorkspace && selectedChannel && (
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => testNotification.mutate()}
                    disabled={testNotification.isPending}
                    variant="outline"
                    data-testid="button-test-notification"
                  >
                    {testNotification.isPending ? "Sending..." : "Send Test Notification"}
                  </Button>
                  <Button data-testid="button-save-config">
                    Save Configuration
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Integration Status */}
        <Card>
          <CardHeader>
            <CardTitle>Integration Status</CardTitle>
            <CardDescription>
              Current status of your Slack integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Project Selected</span>
                {selectedProject ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>Workspace Connected</span>
                {(workspaces as SlackWorkspace[])?.length > 0 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>Channel Configured</span>
                {selectedChannel ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}