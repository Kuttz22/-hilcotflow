import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import TasksPage from "./pages/TasksPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import ActivityPage from "./pages/ActivityPage";
import TeamPage from "./pages/TeamPage";
import DirectoryPage from "./pages/DirectoryPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import NotificationPreferencesPage from "./pages/NotificationPreferencesPage";
import LoginPage from "./pages/LoginPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/tasks">{() => <TasksPage />}</Route>
      <Route path="/tasks/assigned-to-me">{() => <TasksPage view="assigned_to_me" />}</Route>
      <Route path="/tasks/assigned-by-me">{() => <TasksPage view="assigned_by_me" />}</Route>
      <Route path="/tasks/shared-with-me">{() => <TasksPage view="shared_with_me" />}</Route>
      <Route path="/tasks/overdue">{() => <TasksPage view="all" statusFilter="overdue" />}</Route>
      <Route path="/tasks/waiting-on-others">{() => <TasksPage view="waiting_on_others" />}</Route>
      <Route path="/tasks/escalated">{() => <TasksPage view="all" statusFilter="escalated" />}</Route>
      <Route path="/tasks/:id" component={TaskDetailPage} />
      <Route path="/activity" component={ActivityPage} />
      <Route path="/directory" component={DirectoryPage} />
      <Route path="/team" component={TeamPage} />
      <Route path="/settings/notifications" component={NotificationPreferencesPage} />
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path="/terms" component={TermsOfServicePage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
