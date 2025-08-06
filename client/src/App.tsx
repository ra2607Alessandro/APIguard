import React, { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
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
import { AuthProvider, useAuth } from "@/contexts/auth-context";

function Router() {
  const { isAuthenticated, token, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  
  // Add loading state while auth is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div>Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {isAuthenticated && <Navigation />}
      <Switch>
        <Route path="/login">
          {() => isAuthenticated ? <AuthenticatedRedirect to="/dashboard" /> : <LoginPage />}
        </Route>
        <Route path="/signup">
          {() => isAuthenticated ? <AuthenticatedRedirect to="/dashboard" /> : <SignupPage />}
        </Route>
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
                  'Authorization': `Bearer ${token}`
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
            <Route path="/">
              {() => <AuthenticatedRedirect to="/dashboard" />}
            </Route>
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
          <>
            <Route path="/" component={LoginPage} />
            <Route path="/signup" component={SignupPage} />
            <Route component={LoginPage} />
          </>
        )}
      </Switch>
    </div>
  );
}

// Proper redirect component using useEffect
function AuthenticatedRedirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);
  
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
