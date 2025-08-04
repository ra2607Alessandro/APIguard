import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import Monitoring from "@/pages/monitoring";
import Alerts from "@/pages/alerts";
import Integrations from "@/pages/integrations";
import SlackIntegration from "@/pages/slack-integration";
import EmailNotifications from "@/pages/email-notifications";
import LLMDetectionTest from "@/pages/llm-detection-test";
import Navigation from "@/components/navigation";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/projects" component={Projects} />
        <Route path="/monitoring" component={Monitoring} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/integrations" component={Integrations} />
        <Route path="/settings/integrations/slack" component={SlackIntegration} />
        <Route path="/settings/notifications/email" component={EmailNotifications} />
        <Route path="/llm-test" component={LLMDetectionTest} />
        <Route component={NotFound} />
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
