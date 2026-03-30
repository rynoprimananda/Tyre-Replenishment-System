// Tyre Replenishment Planning System - Calculation Engine

import type { 
  PlanningInputs, 
  CalculationResults, 
  Delivery, 
  DailyStock, 
  OrderCycle 
} from '@/types';
import { addDays, addMonths, format, differenceInDays } from 'date-fns';

// Generate month labels based on start date and forecast period
export function generateMonthLabels(startDateStr: string, forecastPeriod: number = 12): string[] {
  const startDate = new Date(startDateStr);
  const labels: string[] = [];
  
  for (let i = 0; i < forecastPeriod; i++) {
    const date = addMonths(startDate, i);
    labels.push(format(date, 'MMM yyyy'));
  }
  
  return labels;
}

// Get planning period display string
export function getPlanningPeriod(startDateStr: string, forecastPeriod: number = 12): string {
  const startDate = new Date(startDateStr);
  const endDate = addDays(addMonths(startDate, forecastPeriod), -1);
  return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
}

// Get total days in forecast period
export function getTotalDaysInPeriod(forecastPeriod: number): number {
  // Approximate days: 3 months = 90, 6 months = 180, 12 months = 365
  return forecastPeriod * 30;
}

// Calculate daily demand from monthly forecasts
export function calculateDailyDemand(monthlyDemands: number[], forecastPeriod: number = 12): number {
  const totalDemand = monthlyDemands.reduce((sum, d) => sum + d, 0);
  const totalDays = getTotalDaysInPeriod(forecastPeriod);
  return totalDemand / totalDays;
}

// Calculate Reorder Point (ROP)
export function calculateROP(
  dailyDemand: number, 
  leadTime: number, 
  safetyStockPercent: number
): number {
  const baseROP = dailyDemand * leadTime;
  const safetyFactor = 1 + (safetyStockPercent / 100);
  return Math.ceil(baseROP * safetyFactor);
}

// Calculate Reorder Quantity (ROQ) - sum of next 3 months demand or remaining months
export function calculateROQ(
  monthlyDemands: number[], 
  startMonthIndex: number,
  forecastPeriod: number = 12
): number {
  // ROQ is minimum of 3 months or remaining months in forecast
  const remainingMonths = forecastPeriod - startMonthIndex;
  const monthsToSum = Math.min(3, remainingMonths);
  
  let roq = 0;
  for (let i = 0; i < monthsToSum; i++) {
    const index = (startMonthIndex + i) % forecastPeriod;
    // If we wrap around or exceed available data, use the average of available months
    if (index >= monthlyDemands.length) {
      const avg = monthlyDemands.reduce((a, b) => a + b, 0) / monthlyDemands.length;
      roq += avg;
    } else {
      roq += monthlyDemands[index];
    }
  }
  return Math.ceil(roq);
}

// Generate delivery schedule with lot splitting
export function generateDeliverySchedule(
  inputs: PlanningInputs,
  dailyDemand: number
): { deliveries: Delivery[]; orderCycles: OrderCycle[] } {
  const deliveries: Delivery[] = [];
  const orderCycles: OrderCycle[] = [];
  const startDate = new Date(inputs.startDate);
  const forecastPeriod = inputs.forecastPeriod || 12;
  
  let currentDate = new Date(startDate);
  let currentStock = inputs.initialStock;
  let deliveryId = 1;
  let orderCycleNumber = 1;
  
  // Generate deliveries for the forecast period + buffer
  const totalMonths = forecastPeriod + 3; // Add buffer for lead time coverage
  const endDate = addMonths(startDate, totalMonths);
  
  while (currentDate < endDate) {
    // Determine current month index
    const monthsElapsed = Math.floor(differenceInDays(currentDate, startDate) / 30);
    const currentMonthIndex = monthsElapsed % forecastPeriod;
    
    // Stop if we've exceeded the forecast period
    if (monthsElapsed >= forecastPeriod) break;
    
    // Calculate ROQ for current position
    const roq = calculateROQ(inputs.monthlyDemands, currentMonthIndex, forecastPeriod);
    
    // Check if we need to split the delivery
    const availableCapacity = inputs.maxCapacity - currentStock;
    let remainingQuantity = roq;
    const cycleDeliveries: Delivery[] = [];
    
    const cycleStartMonth = format(currentDate, 'MMM yyyy');
    const cycleEndDate = addDays(addMonths(currentDate, 3), -1);
    const cycleEndMonth = format(cycleEndDate, 'MMM yyyy');
    
    // Split delivery if needed
    while (remainingQuantity > 0) {
      const deliveryQuantity = Math.min(remainingQuantity, availableCapacity);
      
      if (deliveryQuantity <= 0) break;
      
      // Calculate order date (lead time before arrival)
      const arrivalDate = new Date(currentDate);
      const orderDate = addDays(arrivalDate, -inputs.leadTime);
      
      const delivery: Delivery = {
        id: deliveryId++,
        orderDate,
        arrivalDate,
        quantity: deliveryQuantity,
        cumulative: 0, // Will calculate after
        orderCycle: orderCycleNumber,
      };
      
      deliveries.push(delivery);
      cycleDeliveries.push(delivery);
      remainingQuantity -= deliveryQuantity;
      
      // Spread next delivery by 30 days if split
      if (remainingQuantity > 0) {
        currentDate = addDays(currentDate, 30);
      }
    }
    
    // Add order cycle
    if (cycleDeliveries.length > 0) {
      const totalCycleDemand = cycleDeliveries.reduce((sum, d) => sum + d.quantity, 0);
      orderCycles.push({
        cycleNumber: orderCycleNumber,
        startMonth: cycleStartMonth,
        endMonth: cycleEndMonth,
        totalDemand: totalCycleDemand,
        deliveries: [...cycleDeliveries],
      });
    }
    
    // Move to next order cycle (3 months later)
    currentDate = addDays(addMonths(currentDate, 3), 0);
    orderCycleNumber++;
    
    // Update simulated stock for capacity calculation
    const daysInCycle = 90;
    currentStock = Math.max(0, currentStock - (dailyDemand * daysInCycle));
    if (cycleDeliveries.length > 0) {
      currentStock += cycleDeliveries[cycleDeliveries.length - 1].quantity;
    }
  }
  
  // Calculate cumulative quantities
  let cumulative = 0;
  for (const delivery of deliveries) {
    cumulative += delivery.quantity;
    delivery.cumulative = cumulative;
  }
  
  return { deliveries, orderCycles };
}

// Generate daily stock projection
export function generateDailyStockProjection(
  inputs: PlanningInputs,
  dailyDemand: number,
  rop: number,
  deliveries: Delivery[]
): DailyStock[] {
  const projection: DailyStock[] = [];
  const startDate = new Date(inputs.startDate);
  const forecastPeriod = inputs.forecastPeriod || 12;
  const endDate = addMonths(startDate, forecastPeriod + 3); // Projection period + buffer
  
  let currentStock = inputs.initialStock;
  let dayNumber = 1;
  
  // Create a map of delivery dates
  const deliveryMap = new Map<string, number>();
  for (const delivery of deliveries) {
    const dateKey = format(delivery.arrivalDate, 'yyyy-MM-dd');
    deliveryMap.set(dateKey, (deliveryMap.get(dateKey) || 0) + delivery.quantity);
  }
  
  for (let date = new Date(startDate); date < endDate; date = addDays(date, 1)) {
    const dateKey = format(date, 'yyyy-MM-dd');
    const incomingDelivery = deliveryMap.get(dateKey) || 0;
    const beginningStock = currentStock;
    
    // Calculate ending stock
    let endingStock = currentStock - dailyDemand + incomingDelivery;
    endingStock = Math.max(0, endingStock);
    
    // Determine status
    let status: DailyStock['status'] = 'normal';
    if (incomingDelivery > 0) {
      status = 'delivery';
    } else if (endingStock === 0) {
      status = 'stockout';
    } else if (endingStock < rop) {
      status = 'below-rop';
    }
    
    projection.push({
      date: new Date(date),
      dayNumber,
      beginningStock: Math.round(beginningStock * 100) / 100,
      dailyDemand: Math.round(dailyDemand * 100) / 100,
      incomingDelivery,
      endingStock: Math.round(endingStock * 100) / 100,
      status,
      isDeliveryDay: incomingDelivery > 0,
    });
    
    currentStock = endingStock;
    dayNumber++;
  }
  
  return projection;
}

// Main calculation function
export function performCalculations(inputs: PlanningInputs): CalculationResults {
  const forecastPeriod = inputs.forecastPeriod || 12;
  const dailyDemand = calculateDailyDemand(inputs.monthlyDemands, forecastPeriod);
  const rop = calculateROP(dailyDemand, inputs.leadTime, inputs.safetyStockPercent);
  
  // Generate delivery schedule
  const { deliveries, orderCycles } = generateDeliverySchedule(inputs, dailyDemand);
  
  // Calculate ROQ (average for display)
  const roq = calculateROQ(inputs.monthlyDemands, 0, forecastPeriod);
  
  // Calculate projected deliveries per year (adjusted for period)
  const yearMultiplier = 12 / forecastPeriod;
  const projectedDeliveries = Math.ceil(deliveries.length * yearMultiplier);
  
  // Generate daily stock projection
  const dailyStockProjection = generateDailyStockProjection(inputs, dailyDemand, rop, deliveries);
  
  return {
    dailyDemand,
    rop,
    roq,
    projectedDeliveries,
    deliverySchedule: deliveries,
    dailyStockProjection,
    orderCycles,
  };
}

// Filter projection for display (every 30 days + delivery days + critical days)
export function filterProjectionForDisplay(projection: DailyStock[]): DailyStock[] {
  const result: DailyStock[] = [];
  let lastAddedDay = -30;
  
  for (const day of projection) {
    const shouldInclude = 
      day.dayNumber === 1 || // First day
      day.dayNumber - lastAddedDay >= 30 || // Every 30 days
      day.isDeliveryDay || // Delivery days
      day.status === 'stockout' || // Stockout days
      (day.status === 'below-rop' && day.dayNumber % 7 === 0); // Weekly below ROP
    
    if (shouldInclude) {
      result.push(day);
      lastAddedDay = day.dayNumber;
    }
  }
  
  return result;
}

// Format number with 2 decimal places
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}

// Get risk assessment
export function getRiskAssessment(projection: DailyStock[]): {
  level: 'low' | 'medium' | 'high';
  message: string;
  stockoutDays: number;
} {
  const stockoutDays = projection.filter(p => p.status === 'stockout').length;
  const belowRopDays = projection.filter(p => p.status === 'below-rop').length;
  
  if (stockoutDays > 0) {
    return {
      level: 'high',
      message: `Critical: ${stockoutDays} days of stockout projected. Consider increasing safety stock or reducing lead time.`,
      stockoutDays,
    };
  }
  
  if (belowRopDays > 30) {
    return {
      level: 'medium',
      message: `Warning: ${belowRopDays} days below reorder point. Monitor inventory closely.`,
      stockoutDays: 0,
    };
  }
  
  return {
    level: 'low',
    message: 'Inventory levels are healthy with minimal risk of stockout.',
    stockoutDays: 0,
  };
}
