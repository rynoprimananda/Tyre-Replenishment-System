// Tyre Replenishment Planning System - Types

export interface MonthlyDemand {
  month: number;
  monthName: string;
  demand: number;
}

export interface PlanningInputs {
  startDate: string;
  monthlyDemands: number[];
  leadTime: number;
  maxCapacity: number;
  initialStock: number;
  safetyStockPercent: number;
  siteName: string;
  forecastPeriod: number; // 3, 6, or 12 months
}

export interface CalculationResults {
  dailyDemand: number;
  rop: number;
  roq: number;
  projectedDeliveries: number;
  deliverySchedule: Delivery[];
  dailyStockProjection: DailyStock[];
  orderCycles: OrderCycle[];
}

export interface Delivery {
  id: number;
  orderDate: Date;
  arrivalDate: Date;
  quantity: number;
  cumulative: number;
  orderCycle: number;
}

export interface DailyStock {
  date: Date;
  dayNumber: number;
  beginningStock: number;
  dailyDemand: number;
  incomingDelivery: number;
  endingStock: number;
  status: 'normal' | 'below-rop' | 'stockout' | 'delivery';
  isDeliveryDay: boolean;
}

export interface OrderCycle {
  cycleNumber: number;
  startMonth: string;
  endMonth: string;
  totalDemand: number;
  deliveries: Delivery[];
}

export interface SitePreset {
  name: string;
  leadTime: number;
  maxCapacity: number;
  initialStock: number;
  safetyStockPercent: number;
}

export const SITE_PRESETS: Record<string, SitePreset> = {
  pani: {
    name: 'Pani Mine',
    leadTime: 140,
    maxCapacity: 18,
    initialStock: 12,
    safetyStockPercent: 50,
  },
  tujuhBukit: {
    name: 'Tujuh Bukit',
    leadTime: 90,
    maxCapacity: 18,
    initialStock: 12,
    safetyStockPercent: 50,
  },
  custom: {
    name: 'Custom',
    leadTime: 120,
    maxCapacity: 18,
    initialStock: 12,
    safetyStockPercent: 50,
  },
};

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];
