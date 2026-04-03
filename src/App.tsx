import { Toaster } from "@/components/ui/toaster"; // re-trigger deploy
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/auth";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { SmartErrorBoundary } from "@/components/error/SmartErrorBoundary";
import { useGlobalErrorHandler } from "@/hooks/useGlobalErrorHandler";
import { Loader2 } from "lucide-react";
// Pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import AgentWorkspace from "./pages/AgentWorkspace";
import Tasks from "./pages/Tasks";
import Pipeline from "./pages/Pipeline";
import Prospecting from "./pages/Prospecting";
import LeadScoring from "./pages/LeadScoring";
import Customers from "./pages/Customers";
import ShopFloor from "./pages/ShopFloor";
import LoadingStation from "./pages/LoadingStation";
import DeliveryOps from "./pages/DeliveryOps";
import DeliveryTerminal from "./pages/DeliveryTerminal";

import CutterPlanning from "./pages/CutterPlanning";
import StationDashboard from "./pages/StationDashboard";
import StationView from "./pages/StationView";
import PickupStation from "./pages/PickupStation";
import PoolView from "./pages/PoolView";

import InventoryCountPage from "./pages/InventoryCountPage";
const Brain = React.lazy(() => import("./pages/Brain"));
const Integrations = React.lazy(() => import("./pages/Integrations"));
import IntegrationCallback from "./pages/IntegrationCallback";
import SocialMediaManager from "./pages/SocialMediaManager";
import DailySummarizer from "./pages/DailySummarizer";
import FacebookCommenter from "./pages/FacebookCommenter";
import Phonecalls from "./pages/Phonecalls";
import Settings from "./pages/Settings";
import AdminPanel from "./pages/AdminPanel";
import WasteBankAdmin from "./pages/WasteBankAdmin";
import BendQueueAdmin from "./pages/BendQueueAdmin";
import BundleAdmin from "./pages/BundleAdmin";
import ProductionAudit from "./pages/ProductionAudit";
const PrintTags = React.lazy(() => import("./pages/PrintTags"));
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
import AccountingHealth from "./pages/AccountingHealth";
import CustomerAction from "./pages/CustomerAction";
import CustomerPortal from "./pages/CustomerPortal";
import AcceptQuote from "./pages/AcceptQuote";
import CEOPortal from "./pages/CEOPortal";
import LiveMonitor from "./pages/LiveMonitor";
import VendorPortal from "./pages/VendorPortal";
import Transcribe from "./pages/Transcribe";
import TranscribeWatch from "./pages/TranscribeWatch";
import WebsiteManager from "./pages/WebsiteManager";
import SeoModule from "./pages/SeoModule";
import EmpireBuilder from "./pages/EmpireBuilder";
import AutopilotDashboard from "./pages/AutopilotDashboard";
import PipelineIntelligence from "./pages/PipelineIntelligence";
import SupportInbox from "./pages/SupportInbox";
import KnowledgeBasePublic from "./pages/KnowledgeBasePublic";
import Estimation from "./pages/Estimation";
import QuoteEngine from "./pages/QuoteEngine";
import AutomationsHub from "./pages/AutomationsHub";
import VideoStudio from "./pages/VideoStudio";
import AdDirector from "./pages/AdDirector";
import AppBuilder from "./pages/AppBuilder";
import { AppBuilderWorkspace } from "./components/app-builder/AppBuilderWorkspace";

const QaWar = React.lazy(() => import("./pages/QaWar"));
const SynologyNAS = React.lazy(() => import("./pages/SynologyNAS"));

// Sales Department (new isolated workspace)
const SalesHub = React.lazy(() => import("./pages/sales/SalesHub"));
const SalesPipeline = React.lazy(() => import("./pages/sales/SalesPipeline"));
const SalesQuotations = React.lazy(() => import("./pages/sales/SalesQuotations"));
const SalesInvoices = React.lazy(() => import("./pages/sales/SalesInvoices"));
const SalesContacts = React.lazy(() => import("./pages/sales/SalesContacts"));

import LiveChat from "./pages/LiveChat";

import EmailMarketing from "./pages/EmailMarketing";
import Unsubscribe from "./pages/Unsubscribe";
import InboxManager from "./pages/InboxManager";
import OrgChart from "./pages/OrgChart";
import GlassesCapture from "./pages/GlassesCapture";
import CameraIntelligence from "./pages/CameraIntelligence";
import AzinInterpreter from "./pages/AzinInterpreter";
import VizzyLive from "./pages/VizzyLive";
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
                    <Route path="/" element={<SmartErrorBoundary level="page" maxAutoRetries={2}><Landing /></SmartErrorBoundary>} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    {/* Print-only route — zero app layout */}
                    <Route path="/print-tags" element={<ProtectedRoute><Suspense fallback={<div>Loading...</div>}><PrintTags /></Suspense></ProtectedRoute>} />

                    {/* Core */}
                    <Route path="/home" element={<P><Home /></P>} />
                    <Route path="/ceo" element={<P><CEOPortal /></P>} />
                    <Route path="/live-monitor" element={<P><LiveMonitor /></P>} />
                    
                    <Route path="/tasks" element={<P><Tasks /></P>} />
                    <Route path="/phonecalls" element={<P><Phonecalls /></P>} />

                    <Route path="/website" element={<P><AdminRoute><WebsiteManager /></AdminRoute></P>} />
                    <Route path="/seo" element={<P><AdminRoute><SeoModule /></AdminRoute></P>} />
                    <Route path="/empire" element={<P><AdminRoute><EmpireBuilder /></AdminRoute></P>} />
                    <Route path="/app-builder" element={<ProtectedRoute><SmartErrorBoundary level="page" maxAutoRetries={2}><AppBuilder /></SmartErrorBoundary></ProtectedRoute>} />
                    <Route path="/app-builder/:projectId" element={<P><AppBuilderWorkspace /></P>} />
                    <Route path="/autopilot" element={<P><AutopilotDashboard /></P>} />
                    <Route path="/support-inbox" element={<P><SupportInbox /></P>} />

                    {/* Legacy Sales / CRM */}
                    <Route path="/pipeline" element={<P><Pipeline /></P>} />
                    <Route path="/lead-scoring" element={<P><LeadScoring /></P>} />
                    <Route path="/pipeline/intelligence" element={<P><PipelineIntelligence /></P>} />
                    <Route path="/prospecting" element={<P><Prospecting /></P>} />
                    <Route path="/customers" element={<P><Customers /></P>} />

                    {/* New Sales Department */}
                    <Route path="/sales" element={<P><Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}><SalesHub /></Suspense></P>} />
                    <Route path="/sales/pipeline" element={<P><Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}><SalesPipeline /></Suspense></P>} />
                    <Route path="/sales/quotations" element={<P><Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}><SalesQuotations /></Suspense></P>} />
                    <Route path="/sales/invoices" element={<P><Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}><SalesInvoices /></Suspense></P>} />
                    <Route path="/sales/contacts" element={<P><Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}><SalesContacts /></Suspense></P>} />

                    {/* Accounting */}
                    <Route path="/accounting" element={<P><AccountingWorkspace /></P>} />
                    <Route path="/accounting/health" element={<P><AccountingHealth /></P>} />
                    <Route path="/customer-action/:customerId" element={<P><CustomerAction /></P>} />

                    {/* AI Agents */}
                    <Route path="/agent/:agentId" element={<P><AgentWorkspace /></P>} />
                    <Route path="/azin-interpreter" element={<P><AzinInterpreter /></P>} />

                    {/* Operations */}
                    <Route path="/shop-floor" element={<P><ShopFloor /></P>} />
                    <Route path="/shopfloor/cutter" element={<P><CutterPlanning /></P>} />
                    <Route path="/shopfloor/station" element={<P><StationDashboard /></P>} />
                    <Route path="/shopfloor/station/:machineId" element={<P><StationView /></P>} />
                    <Route path="/shopfloor/pool" element={<P><PoolView /></P>} />
                    <Route path="/shopfloor/loading" element={<P><LoadingStation /></P>} />
                    <Route path="/shopfloor/pickup" element={<P><PickupStation /></P>} />
                    <Route path="/shopfloor/clearance" element={<P><ClearanceStation /></P>} />
                    <Route path="/shopfloor/inventory" element={<P><InventoryCountPage /></P>} />
                    <Route path="/shopfloor/delivery-ops" element={<P><DeliveryOps /></P>} />
                    <Route path="/shopfloor/camera-intelligence" element={<P><CameraIntelligence /></P>} />
                    <Route path="/shopfloor/delivery/:stopId" element={<P><DeliveryTerminal /></P>} />
                    
                    <Route path="/timeclock" element={<P><TimeClock /></P>} />
                    <Route path="/glasses" element={<P><GlassesCapture /></P>} />
                    <Route path="/transcribe" element={<P><Transcribe /></P>} />
                    <Route path="/transcribe/watch" element={<ProtectedRoute><TranscribeWatch /></ProtectedRoute>} />
                    <Route path="/team-hub" element={<P><TeamHub /></P>} />

                    {/* Office Portal - standalone layout but wrapped in workspace */}
                    <Route path="/office" element={<ProtectedRoute><SmartErrorBoundary level="page"><OfficePortal /></SmartErrorBoundary></ProtectedRoute>} />

                    {/* System */}
                    <Route path="/org-chart" element={<P><OrgChart /></P>} />
                    <Route path="/brain" element={<P><Brain /></P>} />
                    <Route path="/integrations" element={<P><Integrations /></P>} />
                    <Route path="/integrations/callback" element={<IntegrationCallback />} />
                    <Route path="/synology" element={<P><Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}><SynologyNAS /></Suspense></P>} />
                    <Route path="/settings" element={<P><Settings /></P>} />

                    {/* Social / Comms */}
                    <Route path="/social-media-manager" element={<P><AdminRoute allowedEmails={["zahra@rebar.shop"]}><SocialMediaManager /></AdminRoute></P>} />
                    <Route path="/video-studio" element={<P><AdminRoute allowedEmails={["zahra@rebar.shop"]}><VideoStudio /></AdminRoute></P>} />
                    <Route path="/ad-director" element={<P><AdminRoute allowedEmails={["zahra@rebar.shop"]}><AdDirector /></AdminRoute></P>} />
                    <Route path="/email-marketing" element={<P><AdminRoute><EmailMarketing /></AdminRoute></P>} />
                    <Route path="/daily-summarizer" element={<P><DailySummarizer /></P>} />
                    <Route path="/facebook-commenter" element={<P><AdminRoute><FacebookCommenter /></AdminRoute></P>} />

                    {/* Admin */}
                    <Route path="/admin" element={<P><AdminPanel /></P>} />
                    <Route path="/admin/db-audit" element={<P><AdminDbAudit /></P>} />
                    <Route path="/admin/machines" element={<P><AdminMachines /></P>} />
                    <Route path="/admin/cleanup" element={<P><CleanupReport /></P>} />
                    <Route path="/admin/connections-audit" element={<P><ConnectionsAudit /></P>} />
                    <Route path="/admin/data-audit" element={<P><DataStoresAudit /></P>} />
                    <Route path="/admin/waste-bank" element={<P><AdminRoute><WasteBankAdmin /></AdminRoute></P>} />
                    <Route path="/admin/bend-queue" element={<P><AdminRoute><BendQueueAdmin /></AdminRoute></P>} />
                    <Route path="/admin/bundles" element={<P><AdminRoute><BundleAdmin /></AdminRoute></P>} />
                    <Route path="/admin/production-audit" element={<P><AdminRoute><ProductionAudit /></AdminRoute></P>} />

                    {/* Automations Hub */}
                    <Route path="/automations" element={<P><AdminRoute><AutomationsHub /></AdminRoute></P>} />

                    {/* QA War Engine */}
                    <Route path="/qa-war" element={<P><AdminRoute><Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}><QaWar /></Suspense></AdminRoute></P>} />

                    {/* Full-screen live chat */}
                    <Route path="/chat" element={<P><LiveChat /></P>} />
                    <Route path="/vizzy" element={<ProtectedRoute><VizzyLive /></ProtectedRoute>} />
                    

                    {/* Legacy redirects */}
                    <Route path="/inbox-manager" element={<P><InboxManager /></P>} />

                    {/* Public pages */}
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/data-deletion" element={<DataDeletion />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />
                    <Route path="/portal" element={<CustomerPortal />} />
                    <Route path="/vendor-portal" element={<VendorPortal />} />
                    <Route path="/install" element={<Install />} />
                    <Route path="/knowledge-base" element={<KnowledgeBasePublic />} />
                    <Route path="/unsubscribe" element={<Unsubscribe />} />
                    <Route path="/accept-quote/:quoteId" element={<AcceptQuote />} />

                    {/* Redirect broken notification paths */}
                    <Route path="/hr" element={<Navigate to="/timeclock" replace />} />
                    <Route path="/hr/*" element={<Navigate to="/timeclock" replace />} />
                    <Route path="/estimation" element={<P><Estimation /></P>} />
                    <Route path="/quote-engine" element={<P><QuoteEngine /></P>} />
                    <Route path="/bills" element={<Navigate to="/accounting" replace />} />
                    <Route path="/bills/*" element={<Navigate to="/accounting" replace />} />
                    <Route path="/invoices/*" element={<Navigate to="/accounting" replace />} />
                    <Route path="/intelligence" element={<Navigate to="/brain" replace />} />
                    <Route path="/inventory" element={<Navigate to="/shop-floor" replace />} />
                    <Route path="/emails/*" element={<Navigate to="/home" replace />} />

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
