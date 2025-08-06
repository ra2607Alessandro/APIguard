import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import Monitoring from "@/pages/monitoring";
import Integrations from "@/pages/integrations";
import SlackIntegration from "@/pages/slack-integration";
import EmailNotifications from "@/pages/email-notifications";
import { LoginPage } from "@/pages/login";
import { SignupPage } from "@/pages/signup";
import { GitHubConnectPage } from "@/pages/github-connect";
import Navigation from "@/components/navigation";
import NotFound from "@/pages/not-found";

function Router() {
  const isAuthenticated = !!localStorage.getItem("auth-token");
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/auth/github/callback">
          {() => {
            // Handle GitHub OAuth callback
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            if (code && isAuthenticated) {
              // Process the code
              fetch('/api/auth/github/callback', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem("auth-token")}`
                },
                body: JSON.stringify({ code })
              }).then(() => {
                window.location.href = '/dashboard';
              });
            }
            return <div>Processing GitHub connection...</div>;
          }}
        </Route>
        {isAuthenticated ? (
          <>
            <Navigation />
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/projects" component={Projects} />
            <Route path="/monitoring" component={Monitoring} />
            <Route path="/integrations" component={Integrations} />
            <Route path="/settings/integrations/slack" component={SlackIntegration} />
            <Route path="/settings/notifications/email" component={EmailNotifications} />
            <Route path="/github/connect" component={GitHubConnectPage} />
            <Route component={NotFound} />
          </>
        ) : (
          <Route>
            {() => {
              // Redirect to login if not authenticated
              window.location.href = '/login';
              return <div>Redirecting to login...</div>;
            }}
          </Route>
        )}
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
