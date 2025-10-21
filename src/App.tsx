import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import FlowsPage from "./pages/FlowsPage";
import FlowEditor from "./pages/FlowEditor";
import Inbox from "./pages/Inbox";
import ConnectAccount from "./pages/ConnectAccount";
import ChatbotRulesPage from "./pages/ChatbotRulesPage"; // Import the new page
import { SessionContextProvider, useSession } from "./integrations/supabase/auth";
import DashboardLayout from "./layouts/DashboardLayout";

const queryClient = new QueryClient();

// A wrapper component to protect routes
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading authentication...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppContent = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/flows"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <FlowsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/flows/edit/:flowId"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <FlowEditor />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Inbox />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/connect-account"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ConnectAccount />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chatbot-rules" // New route for ChatbotRulesPage
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ChatbotRulesPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

const App = () => (
  <SessionContextProvider>
    <AppContent />
  </SessionContextProvider>
);

export default App;