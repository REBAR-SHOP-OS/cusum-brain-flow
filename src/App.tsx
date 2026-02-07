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
import DataStoresAudit from "./pages/DataStoresAudit";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Landing from "./pages/Landing";
import Install from "./pages/Install";
import OfficePortal from "./pages/OfficePortal";
import TimeClock from "./pages/TimeClock";
import TeamHub from "./pages/TeamHub";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Helper to wrap protected routes with layout */
function P({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <WorkspaceProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                {/* Core */}
                <Route path="/home" element={<P><Home /></P>} />
                <Route path="/inbox" element={<P><Inbox /></P>} />
                <Route path="/tasks" element={<P><Tasks /></P>} />
                <Route path="/phonecalls" element={<P><Phonecalls /></P>} />

                {/* Sales */}
                <Route path="/pipeline" element={<P><Pipeline /></P>} />
                <Route path="/customers" element={<P><Customers /></P>} />

                {/* AI Agents */}
                <Route path="/agent/:agentId" element={<P><AgentWorkspace /></P>} />

                {/* Operations */}
                <Route path="/shop-floor" element={<P><ShopFloor /></P>} />
                <Route path="/shopfloor/cutter" element={<P><CutterPlanning /></P>} />
                <Route path="/shopfloor/station" element={<P><StationDashboard /></P>} />
                <Route path="/shopfloor/station/:machineId" element={<P><StationView /></P>} />
                <Route path="/shopfloor/pickup" element={<P><PickupStation /></P>} />
                <Route path="/shopfloor/live-monitor" element={<P><LiveMonitor /></P>} />
                <Route path="/deliveries" element={<P><Deliveries /></P>} />
                <Route path="/timeclock" element={<P><TimeClock /></P>} />
                <Route path="/team-hub" element={<P><TeamHub /></P>} />

                {/* Office Portal - standalone layout but wrapped in workspace */}
                <Route path="/office" element={<ProtectedRoute><OfficePortal /></ProtectedRoute>} />

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
                <Route path="/admin/data-audit" element={<P><DataStoresAudit /></P>} />

                {/* Legacy redirects */}
                <Route path="/inbox-manager" element={<Navigate to="/inbox" replace />} />

                {/* Public pages */}
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/install" element={<Install />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </WorkspaceProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
