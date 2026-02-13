import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/auth";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { SmartErrorBoundary } from "@/components/error/SmartErrorBoundary";
import { useGlobalErrorHandler } from "@/hooks/useGlobalErrorHandler";
// Pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import AgentWorkspace from "./pages/AgentWorkspace";
import Inbox from "./pages/Inbox";
import Tasks from "./pages/Tasks";
import Pipeline from "./pages/Pipeline";
import Customers from "./pages/Customers";
import ShopFloor from "./pages/ShopFloor";
import LiveMonitor from "./pages/LiveMonitor";
import CutterPlanning from "./pages/CutterPlanning";
import StationDashboard from "./pages/StationDashboard";
import StationView from "./pages/StationView";
import PickupStation from "./pages/PickupStation";
import PoolView from "./pages/PoolView";
import Deliveries from "./pages/Deliveries";
import Brain from "./pages/Brain";
import Integrations from "./pages/Integrations";
import IntegrationCallback from "./pages/IntegrationCallback";
import SocialMediaManager from "./pages/SocialMediaManager";
import DailySummarizer from "./pages/DailySummarizer";
import FacebookCommenter from "./pages/FacebookCommenter";
import Phonecalls from "./pages/Phonecalls";
import Settings from "./pages/Settings";
import AdminPanel from "./pages/AdminPanel";
import AdminMachines from "./pages/AdminMachines";
import AdminDbAudit from "./pages/AdminDbAudit";
import CleanupReport from "./pages/CleanupReport";
import ConnectionsAudit from "./pages/ConnectionsAudit";
import DataStoresAudit from "./pages/DataStoresAudit";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import DataDeletion from "./pages/DataDeletion";
import TermsOfService from "./pages/TermsOfService";
import Landing from "./pages/Landing";
import Install from "./pages/Install";
import OfficePortal from "./pages/OfficePortal";
import TimeClock from "./pages/TimeClock";
import TeamHub from "./pages/TeamHub";
import NotFound from "./pages/NotFound";
import ClearanceStation from "./pages/ClearanceStation";
import AccountingWorkspace from "./pages/AccountingWorkspace";
import CustomerAction from "./pages/CustomerAction";
import CustomerPortal from "./pages/CustomerPortal";
import CEOPortal from "./pages/CEOPortal";
import Transcribe from "./pages/Transcribe";
import TranscribeWatch from "./pages/TranscribeWatch";
import VizzyPage from "./pages/VizzyPage";
import LiveChat from "./pages/LiveChat";
const queryClient = new QueryClient();

/** Helper to wrap protected routes with layout + page-level error boundary */
function P({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>
        <SmartErrorBoundary level="page" maxAutoRetries={2}>
          {children}
        </SmartErrorBoundary>
      </AppLayout>
    </ProtectedRoute>
  );
}

/** Global error handler hook wrapper */
function GlobalErrorWatcher({ children }: { children: React.ReactNode }) {
  useGlobalErrorHandler();
  return <>{children}</>;
}

const App = () => (
  <SmartErrorBoundary level="app" maxAutoRetries={3}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <GlobalErrorWatcher>
                <WorkspaceProvider>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />

                    {/* Core */}
                    <Route path="/home" element={<P><Home /></P>} />
                    <Route path="/ceo" element={<P><CEOPortal /></P>} />
                    <Route path="/inbox" element={<P><Inbox /></P>} />
                    <Route path="/tasks" element={<P><Tasks /></P>} />
                    <Route path="/phonecalls" element={<P><Phonecalls /></P>} />

                    {/* Sales */}
                    <Route path="/pipeline" element={<P><Pipeline /></P>} />
                    <Route path="/customers" element={<P><Customers /></P>} />

                    {/* Accounting */}
                    <Route path="/accounting" element={<P><AccountingWorkspace /></P>} />
                    <Route path="/customer-action/:customerId" element={<P><CustomerAction /></P>} />

                    {/* AI Agents */}
                    <Route path="/agent/:agentId" element={<P><AgentWorkspace /></P>} />

                    {/* Operations */}
                    <Route path="/shop-floor" element={<P><ShopFloor /></P>} />
                    <Route path="/shopfloor/cutter" element={<P><CutterPlanning /></P>} />
                    <Route path="/shopfloor/station" element={<P><StationDashboard /></P>} />
                    <Route path="/shopfloor/station/:machineId" element={<P><StationView /></P>} />
                    <Route path="/shopfloor/pool" element={<P><PoolView /></P>} />
                    <Route path="/shopfloor/pickup" element={<P><PickupStation /></P>} />
                    <Route path="/shopfloor/clearance" element={<P><ClearanceStation /></P>} />
                    <Route path="/shopfloor/live-monitor" element={<P><LiveMonitor /></P>} />
                    <Route path="/deliveries" element={<P><Deliveries /></P>} />
                    <Route path="/timeclock" element={<P><TimeClock /></P>} />
                    <Route path="/transcribe" element={<P><Transcribe /></P>} />
                    <Route path="/transcribe/watch" element={<ProtectedRoute><TranscribeWatch /></ProtectedRoute>} />
                    <Route path="/team-hub" element={<P><TeamHub /></P>} />

                    {/* Office Portal - standalone layout but wrapped in workspace */}
                    <Route path="/office" element={<ProtectedRoute><SmartErrorBoundary level="page"><OfficePortal /></SmartErrorBoundary></ProtectedRoute>} />

                    {/* System */}
                    <Route path="/brain" element={<P><Brain /></P>} />
                    <Route path="/integrations" element={<P><Integrations /></P>} />
                    <Route path="/integrations/callback" element={<IntegrationCallback />} />
                    <Route path="/settings" element={<P><Settings /></P>} />

                    {/* Social / Comms */}
                    <Route path="/social-media-manager" element={<P><SocialMediaManager /></P>} />
                    <Route path="/daily-summarizer" element={<P><DailySummarizer /></P>} />
                    <Route path="/facebook-commenter" element={<P><FacebookCommenter /></P>} />

                    {/* Admin */}
                    <Route path="/admin" element={<P><AdminPanel /></P>} />
                    <Route path="/admin/db-audit" element={<P><AdminDbAudit /></P>} />
                    <Route path="/admin/machines" element={<P><AdminMachines /></P>} />
                    <Route path="/admin/cleanup" element={<P><CleanupReport /></P>} />
                    <Route path="/admin/connections-audit" element={<P><ConnectionsAudit /></P>} />
                    <Route path="/admin/data-audit" element={<P><DataStoresAudit /></P>} />

                    {/* Vizzy – standalone voice page for Siri Shortcut */}
                    <Route path="/vizzy" element={<ProtectedRoute><VizzyPage /></ProtectedRoute>} />
                    {/* Full-screen live chat */}
                    <Route path="/chat" element={<P><LiveChat /></P>} />

                    {/* Legacy redirects */}
                    <Route path="/inbox-manager" element={<Navigate to="/inbox" replace />} />

                    {/* Public pages */}
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/data-deletion" element={<DataDeletion />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />
                    <Route path="/portal" element={<CustomerPortal />} />
                    <Route path="/install" element={<Install />} />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </WorkspaceProvider>
              </GlobalErrorWatcher>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </SmartErrorBoundary>
);

export default App;
