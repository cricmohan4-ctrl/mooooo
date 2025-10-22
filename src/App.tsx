import React from "react";
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
import ChatbotRulesPage from "./pages/ChatbotRulesPage";
import UserManagementPage from "./pages/UserManagementPage";
import { SessionContextProvider, useSession } from "./integrations/supabase/auth";
import DashboardLayout from "./layouts/DashboardLayout";

const queryClient = new QueryClient();

// A wrapper component to protect routes
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading, hasAuthError } = useSession();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading authentication...</div>;
  }

  if (hasAuthError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-600 dark:text-red-400">
        <h2 className="text-2xl font-bold mb-2">Authentication Error</h2>
        <p className="text-lg mb-4">Could not load user session. Please check your Supabase configuration or try logging in again.</p>
        <Navigate to="/login" replace /> {/* Redirect to login on error */}
      </div>
    );
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
                <DashboardLayout hideHeader={true}>
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
            path="/chatbot-rules"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ChatbotRulesPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-management"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <UserManagementPage />
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