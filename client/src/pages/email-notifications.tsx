import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mail, Plus, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface UserNotification {
  id: string;
  project_id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export default function EmailNotificationsPage() {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/projects"],
  });

  // Fetch notifications for selected project
  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ["/api/projects", selectedProject, "notifications"],
    enabled: !!selectedProject,
  });

  // Add email notification mutation
  const addNotification = useMutation({
    mutationFn: async () => {
      if (!selectedProject || !email) {
        throw new Error("Please select a project and enter an email address");
      }

      return apiRequest(`/api/projects/${selectedProject}/notifications`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Email Notification Added",
        description: "You will receive email alerts for breaking changes in this project.",
      });
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProject, "notifications"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Notification",
        description: error.message || "Failed to add email notification",
        variant: "destructive",
      });
    },
  });

  // Remove email notification mutation
  const removeNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Email Notification Removed",
        description: "Email alerts have been disabled for this project.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProject, "notifications"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Remove Notification",
        description: error.message || "Failed to remove email notification",
        variant: "destructive",
      });
    },
  });

  // Test email notification mutation
  const testNotification = useMutation({
    mutationFn: async () => {
      if (!selectedProject || !email) {
        throw new Error("Please select a project and enter an email address");
      }

      return apiRequest(`/api/projects/${selectedProject}/notifications/test`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Test Email Sent",
        description: "Check your inbox for a test notification from API Sentinel.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-8" data-testid="email-notifications-page">
      <div className="flex items-center gap-3">
        <Mail className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Email Notifications</h1>
          <p className="text-muted-foreground">
            Receive email alerts when breaking changes are detected in your API specifications
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
              Choose which project you want to receive email notifications for
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

        {/* Email Configuration */}
        {selectedProject && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                Step 2: Configure Email Alerts
              </CardTitle>
              <CardDescription>
                Add email addresses to receive breaking change notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter email address..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-email"
                />
                <Button
                  onClick={() => testNotification.mutate()}
                  disabled={testNotification.isPending || !email}
                  variant="outline"
                  data-testid="button-test-email"
                >
                  {testNotification.isPending ? "Sending..." : "Test"}
                </Button>
                <Button
                  onClick={() => addNotification.mutate()}
                  disabled={addNotification.isPending || !email}
                  data-testid="button-add-email"
                >
                  {addNotification.isPending ? "Adding..." : "Add Email"}
                </Button>
              </div>

              {/* Current Notifications */}
              {notifications && (notifications as UserNotification[]).length > 0 && (
                <div className="space-y-3">
                  <Separator />
                  <h4 className="font-medium">Active Email Notifications</h4>
                  <div className="space-y-2">
                    {(notifications as UserNotification[]).map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`notification-${notification.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <div>
                            <span className="font-medium">{notification.email}</span>
                            <Badge variant="secondary" className="ml-2">
                              Active
                            </Badge>
                          </div>
                        </div>
                        <Button
                          onClick={() => removeNotification.mutate(notification.id)}
                          disabled={removeNotification.isPending}
                          variant="ghost"
                          size="sm"
                          data-testid={`button-remove-${notification.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {notifications && (notifications as UserNotification[]).length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No email notifications configured for this project</p>
                  <p className="text-sm">Add an email address above to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full" />
              How Email Notifications Work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-blue-600">1</span>
              </div>
              <div>
                <p className="font-medium">Automatic Monitoring</p>
                <p className="text-sm text-muted-foreground">
                  API Sentinel continuously monitors your GitHub repositories for changes to OpenAPI specifications
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-blue-600">2</span>
              </div>
              <div>
                <p className="font-medium">Breaking Change Detection</p>
                <p className="text-sm text-muted-foreground">
                  When breaking changes are detected, the system analyzes their severity and impact
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-medium text-blue-600">3</span>
              </div>
              <div>
                <p className="font-medium">Email Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Detailed email notifications are sent to all configured addresses with recommended actions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}