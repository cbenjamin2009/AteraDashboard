export interface SlaStat {
  count: number;
  percentage: number;
}

export interface BillableEntry {
  technician: string;
  hours: number;
}

export interface TicketRow {
  id: number;
  number?: string;
  title?: string;
  customer?: string;
  status?: string;
  opened?: string;
  firstResponseMinutes?: number;
  resolutionMinutes?: number;
  satisfaction?: number;
}

export interface MonthlyReviewMetrics {
  monthLabel: string;
  totalTickets: number;
  avgFirstResponseMinutes: number;
  avgResolutionMinutes: number;
  satisfactionScore: number;
  responseWithin2Hours: SlaStat;
  closureWithinTwoDays: SlaStat;
  billableHours: {
    totalHours: number;
    entries: BillableEntry[];
  };
  keywordCloud: Array<{ label: string; count: number }>;
  tickets: TicketRow[];
}
