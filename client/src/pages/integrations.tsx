import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Github, MessageSquare, Code, ExternalLink, Copy, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Integrations() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const integrationStatus = {
    github: true,
    slack: false,
    ci: false,
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast({
      title: "Copied to clipboard",
      description: "The code has been copied to your clipboard",
    });
    setTimeout(() => setCopied(null), 2000);
  };

  const webhookUrl = `${window.location.origin}/api/integrations/github`;
  const ciValidationUrl = `${window.location.origin}/api/ci/validate`;

  return (
    <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Integrations</h2>
            <p className="mt-1 text-sm text-gray-500">
              Connect API Sentinel with your development workflow
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="github" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="github" className="flex items-center space-x-2">
            <Github className="h-4 w-4" />
            <span>GitHub</span>
          </TabsTrigger>
          <TabsTrigger value="slack" className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4" />
            <span>Slack</span>
          </TabsTrigger>
          <TabsTrigger value="ci" className="flex items-center space-x-2">
            <Code className="h-4 w-4" />
            <span>CI/CD</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="github">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Github className="h-5 w-5" />
                    <CardTitle>GitHub Integration</CardTitle>
                  </div>
                  <Badge className={integrationStatus.github ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {integrationStatus.github ? "Connected" : "Not Connected"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600">
                  Monitor repository changes automatically with GitHub webhooks.
                </p>
                
                <div>
                  <Label htmlFor="github-token">GitHub Token</Label>
                  <Input
                    id="github-token"
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    defaultValue={integrationStatus.github ? "••••••••••••••••••••" : ""}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Personal access token with repo permissions
                  </p>
                </div>

                <div>
                  <Label>Webhook URL</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      value={webhookUrl}
                      readOnly
                      className="bg-gray-50"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopy(webhookUrl, "webhook")}
                    >
                      {copied === "webhook" ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Add this URL as a webhook in your GitHub repository settings
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch checked={integrationStatus.github} />
                  <Label>Enable GitHub monitoring</Label>
                </div>

                <Button className="w-full">
                  {integrationStatus.github ? "Update Configuration" : "Connect GitHub"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Setup Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Create GitHub Token</p>
                      <p className="text-sm text-gray-600">
                        Go to GitHub Settings → Developer Settings → Personal Access Tokens
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Configure Webhook</p>
                      <p className="text-sm text-gray-600">
                        Add webhook URL to your repository settings with push and pull_request events
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Test Integration</p>
                      <p className="text-sm text-gray-600">
                        Make a commit to trigger API Sentinel monitoring
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  GitHub Documentation
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="slack">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5" />
                    <CardTitle>Slack Integration</CardTitle>
                  </div>
                  <Badge className={integrationStatus.slack ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {integrationStatus.slack ? "Connected" : "Not Connected"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600">
                  Get breaking change alerts directly in your Slack channels.
                </p>
                
                <div>
                  <Label htmlFor="slack-token">Bot Token</Label>
                  <Input
                    id="slack-token"
                    type="password"
                    placeholder="xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx"
                    defaultValue={integrationStatus.slack ? "••••••••••••••••••••" : ""}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Slack Bot User OAuth Token
                  </p>
                </div>

                <div>
                  <Label htmlFor="slack-channel">Default Channel</Label>
                  <Input
                    id="slack-channel"
                    placeholder="#api-alerts or C1234567890"
                    defaultValue="#api-alerts"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Channel name or ID for alerts
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch checked={integrationStatus.slack} />
                  <Label>Enable Slack notifications</Label>
                </div>

                <Button className="w-full">
                  {integrationStatus.slack ? "Update Configuration" : "Connect Slack"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Slack App Setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You'll need to create a Slack app and install it to your workspace first.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Create Slack App</p>
                      <p className="text-sm text-gray-600">
                        Go to api.slack.com/apps and create a new app
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Add Bot Permissions</p>
                      <p className="text-sm text-gray-600">
                        Add chat:write and channels:read scopes
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Install to Workspace</p>
                      <p className="text-sm text-gray-600">
                        Install the app and copy the Bot User OAuth Token
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Slack API Documentation
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ci">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Code className="h-5 w-5" />
                    <CardTitle>CI/CD Integration</CardTitle>
                  </div>
                  <Badge className={integrationStatus.ci ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {integrationStatus.ci ? "Active" : "Setup Required"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600">
                  Block deployments with breaking changes by integrating with your CI/CD pipeline.
                </p>

                <div>
                  <Label>Validation Endpoint</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      value={ciValidationUrl}
                      readOnly
                      className="bg-gray-50"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopy(ciValidationUrl, "ci")}
                    >
                      {copied === "ci" ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="sk-xxxxxxxxxxxxxxxxxxxx"
                    defaultValue={integrationStatus.ci ? "••••••••••••••••••••" : ""}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    API key for CI/CD authentication
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch checked={integrationStatus.ci} />
                  <Label>Enable deployment validation</Label>
                </div>

                <Button className="w-full">
                  Generate API Key
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Example CI/CD Scripts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>GitHub Actions</Label>
                  <div className="relative">
                    <Textarea
                      readOnly
                      className="bg-gray-50 font-mono text-sm"
                      value={`- name: Validate API Changes
  run: |
    curl -X POST "${ciValidationUrl}" \\
      -H "Authorization: Bearer $API_KEY" \\
      -H "Content-Type: application/json" \\
      -d '{"projectId": "$PROJECT_ID", "newSchema": @openapi.yaml}'`}
                      rows={6}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="absolute top-2 right-2"
                      onClick={() => handleCopy(`- name: Validate API Changes
  run: |
    curl -X POST "${ciValidationUrl}" \\
      -H "Authorization: Bearer $API_KEY" \\
      -H "Content-Type: application/json" \\
      -d '{"projectId": "$PROJECT_ID", "newSchema": @openapi.yaml}'`, "github-actions")}
                    >
                      {copied === "github-actions" ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Jenkins Pipeline</Label>
                  <div className="relative">
                    <Textarea
                      readOnly
                      className="bg-gray-50 font-mono text-sm"
                      value={`stage('API Validation') {
  steps {
    sh '''
      curl -X POST "${ciValidationUrl}" \\
        -H "Authorization: Bearer ${API_KEY}" \\
        -H "Content-Type: application/json" \\
        -d "@openapi.yaml"
    '''
  }
}`}
                      rows={8}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="absolute top-2 right-2"
                      onClick={() => handleCopy(`stage('API Validation') {
  steps {
    sh '''
      curl -X POST "${ciValidationUrl}" \\
        -H "Authorization: Bearer ${API_KEY}" \\
        -H "Content-Type: application/json" \\
        -d "@openapi.yaml"
    '''
  }
}`, "jenkins")}
                    >
                      {copied === "jenkins" ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Integration Documentation
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
