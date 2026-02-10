export interface TicketSummary {
  id: number;
  number?: string;
  title?: string;
  customer?: string;
  status?: string;
  createdAt?: string;
}

export interface TechnicianWorkload {
  technician: string;
  count: number;
}

export interface TrendPoint {
  date: string;
  opened: number;
  closed: number;
}

export interface CustomerTicketLoad {
  customer: string;
  count: number;
}

export interface TicketStatusSummary {
  status: string;
  count: number;
}

export interface AlertSummary {
  id: number;
  title?: string;
  customer?: string;
  device?: string;
  createdAt?: string;
}

export interface DashboardMetrics {
  generatedAt: string;
  openTotal: number;
  openThisMonth: number;
  newToday: number;
  closedThisMonth: number;
  pendingTickets: number;
  averageOpenAgeHours: number;
  slaRiskCount: number;
  technicianLoad: TechnicianWorkload[];
  trendSevenDay: TrendPoint[];
  newTicketsByCustomer: CustomerTicketLoad[];
  statusBreakdown: TicketStatusSummary[];
  criticalAlertsOpen: number;
  criticalAlertsSample: AlertSummary[];
  sampleOpenTickets: TicketSummary[];
}
