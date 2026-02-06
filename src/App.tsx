import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import Inbox from "./pages/Inbox";
import Tasks from "./pages/Tasks";
import Pipeline from "./pages/Pipeline";
import Customers from "./pages/Customers";
import ShopFloor from "./pages/ShopFloor";
import Deliveries from "./pages/Deliveries";
import Brain from "./pages/Brain";
import Integrations from "./pages/Integrations";
import IntegrationCallback from "./pages/IntegrationCallback";
import SocialMediaManager from "./pages/SocialMediaManager";
import InboxManager from "./pages/InboxManager";
import DailySummarizer from "./pages/DailySummarizer";
import FacebookCommenter from "./pages/FacebookCommenter";
import Settings from "./pages/Settings";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
          {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/welcome" element={<Landing />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Inbox />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Home />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Tasks />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pipeline"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Pipeline />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Customers />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/shop-floor"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ShopFloor />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/deliveries"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Deliveries />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/brain"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Brain />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/integrations"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Integrations />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/integrations/callback"
              element={
                <ProtectedRoute>
                  <IntegrationCallback />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Settings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/social-media-manager"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SocialMediaManager />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inbox-manager"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <InboxManager />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/daily-summarizer"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <DailySummarizer />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/facebook-commenter"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <FacebookCommenter />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Public policy pages */}
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
