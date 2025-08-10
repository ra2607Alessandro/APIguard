import React, { useEffect, useState } from "react";
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
import Navigation from "@/components/navigation";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
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
        {/* Add this route BEFORE other routes */}
        <Route path="/auth/github/callback">
          {() => <GitHubCallbackHandler />}
        </Route>
        
        <Route path="/login">
          {() => isAuthenticated ? <AuthenticatedRedirect to="/dashboard" /> : <LoginPage />}
        </Route>
        <Route path="/signup">
          {() => isAuthenticated ? <AuthenticatedRedirect to="/dashboard" /> : <SignupPage />}
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

// Add this component back
function GitHubCallbackHandler() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    console.log('GitHubCallbackHandler: Component mounted');
    console.log('Current URL:', window.location.href);
    console.log('Query params:', window.location.search);
    
    // Get the full URL with query params
    const fullUrl = window.location.href;
    const backendPath = fullUrl.replace(window.location.origin, '');
    
    console.log('Redirecting to backend path:', backendPath);
    
    // Redirect to backend with all params preserved
    window.location.href = backendPath;
  }, []);
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4">Processing GitHub authorization...</p>
      </div>
    </div>
  );
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
