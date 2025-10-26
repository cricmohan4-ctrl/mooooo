import React from "react"; // Added explicit React import
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
import LabelManagementPage from "./pages/LabelManagementPage";
import FormBuilderPage from "./pages/FormBuilderPage";
import TermsAndConditions from "./pages/TermsAndConditions"; // Import new page
import PrivacyPolicy from "./pages/PrivacyPolicy"; // Import new page
import DataDeletionInstructions from "./pages/DataDeletionInstructions"; // Import new page
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
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/data-deletion-instructions" element={<DataDeletionInstructions />} />
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
                <DashboardLayout hideHeader={true} hideFooter={true}> {/* Added hideFooter={true} */}
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
          <Route
            path="/label-management"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <LabelManagementPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/form-builder"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <FormBuilderPage />
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