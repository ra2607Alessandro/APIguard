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
import { GitHubConnectPage } from "@/pages/github-connect";
import Navigation from "@/components/navigation";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";

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
          {() => <GitHubCallbackHandler />}
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

// GitHub OAuth callback handler with proper loading states and error handling
function GitHubCallbackHandler() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const processCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const errorParam = urlParams.get('error');
        
        if (errorParam) {
          throw new Error(`GitHub authorization failed: ${errorParam}`);
        }
        
        if (!code) {
          throw new Error('No authorization code received from GitHub');
        }
        
        if (!isAuthenticated) {
          throw new Error('User not authenticated');
        }

        const response = await fetch('/api/auth/github/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
          },
          body: JSON.stringify({ code })
        });
        
        if (!response.ok) {
          throw new Error('Failed to connect GitHub account');
        }
        
        setStatus('success');
        setTimeout(() => {
          setLocation('/dashboard');
        }, 1500);
        
      } catch (error: any) {
        setStatus('error');
        setError(error.message || 'Failed to connect GitHub account');
      }
    };

    processCallback();
  }, [isAuthenticated, setLocation]);

  if (status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Connecting your GitHub account...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-green-600 text-4xl mb-4">✓</div>
          <p className="text-gray-900 font-medium">GitHub Connected Successfully!</p>
          <p className="text-gray-600 mt-2">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md">
        <div className="text-red-600 text-4xl mb-4">✗</div>
        <p className="text-gray-900 font-medium mb-2">Connection Failed</p>
        <p className="text-gray-600 mb-4">{error}</p>
        <button 
          onClick={() => setLocation('/dashboard')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Return to Dashboard
        </button>
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
