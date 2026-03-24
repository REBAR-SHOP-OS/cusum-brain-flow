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
    totalPiecesProduced: number;
    machinesRunning: number;
    machineRunsToday: number;
  };
  machineRuns?: {
    totalToday: number;
    runs: { machine_name: string; process: string; status: string; started_at: string | null; output_qty: number | null; operator_name: string | null }[];
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
  ringcentralCalls?: {
    totalCalls: number;
    totalInbound: number;
    totalMissed: number;
    perEmployee: Record<string, { outbound: number; inbound: number; missed: number; talkTimeSec: number }>;
    details: { direction: string; from: string; to: string; duration: number; result: string; received_at: string }[];
  };
}
