export interface VizzyBusinessSnapshot {
  financials: {
    totalReceivable: number;
    totalPayable: number;
    overdueInvoices: any[];
    overdueBills: any[];
    accounts: any[];
    payments: any[];
    qbConnected: boolean;
  };
  production: {
    activeCutPlans: number;
    queuedItems: number;
    completedToday: number;
    machinesRunning: number;
  };
  crm: {
    openLeads: number;
    hotLeads: any[];
  };
  customers: { totalActive: number };
  deliveries: { scheduledToday: number; inTransit: number };
  team: { totalStaff: number };
  recentEvents: any[];
  brainKnowledge: { title: string; category: string; content: string | null }[];
  agentActivity: { agent_name: string; session_count: number; last_topic: string; user_name: string }[];
  teamPresence: { name: string; clocked_in: string; clocked_out: string | null }[];
  inboundEmails: { subject: string; from_address: string; to_address: string; body_preview: string; received_at: string }[];
}
