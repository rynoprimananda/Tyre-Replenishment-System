import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Package, 
  TrendingDown, 
  AlertTriangle, 
  FileText, 
  Printer, 
  Settings,
  ChevronRight,
  Warehouse,
  Clock,
  Shield,
  BarChart3,
  Table2,
  FileSpreadsheet
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TooltipProvider,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

import type { 
  PlanningInputs, 
  CalculationResults
} from '@/types';
import { 
  SITE_PRESETS
} from '@/types';
import { 
  performCalculations, 
  generateMonthLabels, 
  getPlanningPeriod,
  filterProjectionForDisplay,
  formatNumber,
  getRiskAssessment
} from '@/lib/calculations';
import './App.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

// Default sample data
const DEFAULT_INPUTS: PlanningInputs = {
  startDate: '2026-04-01',
  monthlyDemands: [10, 10, 12, 12, 14, 15, 15, 14, 12, 10, 10, 11],
  leadTime: 140,
  maxCapacity: 18,
  initialStock: 12,
  safetyStockPercent: 50,
  siteName: 'Pani Mine',
  forecastPeriod: 12,
};

function App() {
  // State
  const [inputs, setInputs] = useState<PlanningInputs>(DEFAULT_INPUTS);
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [activeTab, setActiveTab] = useState('daily-stock');
  const [showCapacityAlert, setShowCapacityAlert] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tyrePlannerInputs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setInputs(parsed);
      } catch (e) {
        console.error('Failed to load saved inputs:', e);
      }
    }
  }, []);

  // Save to localStorage when inputs change
  useEffect(() => {
    localStorage.setItem('tyrePlannerInputs', JSON.stringify(inputs));
  }, [inputs]);

  // Perform calculations when inputs change
  useEffect(() => {
    const calcResults = performCalculations(inputs);
    setResults(calcResults);
    
    // Check capacity constraint
    const maxDelivery = Math.max(...calcResults.deliverySchedule.map(d => d.quantity), 0);
    setShowCapacityAlert(maxDelivery > inputs.maxCapacity);
  }, [inputs]);

  // Generate month labels based on forecast period
  const monthLabels = useMemo(() => generateMonthLabels(inputs.startDate, inputs.forecastPeriod), [inputs.startDate, inputs.forecastPeriod]);

  // Handle input changes
  const handleDemandChange = (index: number, value: string) => {
    const numValue = parseInt(value) || 0;
    const newDemands = [...inputs.monthlyDemands];
    newDemands[index] = numValue;
    setInputs({ ...inputs, monthlyDemands: newDemands });
  };

  const handleSitePreset = (preset: 'pani' | 'tujuhBukit' | 'custom') => {
    const config = SITE_PRESETS[preset];
    setInputs({
      ...inputs,
      leadTime: config.leadTime,
      maxCapacity: config.maxCapacity,
      initialStock: config.initialStock,
      safetyStockPercent: config.safetyStockPercent,
      siteName: config.name,
    });
  };

  // Export to Excel
  const exportToExcel = () => {
    if (!results) return;

    const wb = XLSX.utils.book_new();
    
    // Daily Stock Sheet
    const dailyStockData = filterProjectionForDisplay(results.dailyStockProjection).map(day => ({
      Date: format(day.date, 'yyyy-MM-dd'),
      'Day #': day.dayNumber,
      'Beginning Stock': day.beginningStock,
      'Daily Demand': day.dailyDemand,
      'Incoming Delivery': day.incomingDelivery,
      'Ending Stock': day.endingStock,
      Status: day.status.toUpperCase(),
    }));
    const ws1 = XLSX.utils.json_to_sheet(dailyStockData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Daily Stock Projection');
    
    // Delivery Plan Sheet
    const deliveryData = results.deliverySchedule.map(d => ({
      'Delivery #': d.id,
      'Order Date': format(d.orderDate, 'yyyy-MM-dd'),
      'Arrival Date': format(d.arrivalDate, 'yyyy-MM-dd'),
      Quantity: d.quantity,
      Cumulative: d.cumulative,
      'Order Cycle': d.orderCycle,
    }));
    const ws2 = XLSX.utils.json_to_sheet(deliveryData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Delivery Plan');
    
    // Summary Sheet
    const summaryData = [
      { Metric: 'Site', Value: inputs.siteName },
      { Metric: 'Planning Period', Value: getPlanningPeriod(inputs.startDate, inputs.forecastPeriod) },
      { Metric: 'Forecast Period', Value: `${inputs.forecastPeriod} months` },
      { Metric: 'Daily Demand', Value: `${formatNumber(results.dailyDemand)} units/day` },
      { Metric: 'Reorder Point (ROP)', Value: `${results.rop} units` },
      { Metric: 'Reorder Quantity (ROQ)', Value: `${results.roq} units/cycle` },
      { Metric: 'Projected Deliveries/Year', Value: results.projectedDeliveries },
      { Metric: 'Lead Time', Value: `${inputs.leadTime} days` },
      { Metric: 'Max Capacity', Value: `${inputs.maxCapacity} units` },
      { Metric: 'Initial Stock', Value: `${inputs.initialStock} units` },
      { Metric: 'Safety Stock %', Value: `${inputs.safetyStockPercent}%` },
    ];
    const ws3 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Summary');
    
    XLSX.writeFile(wb, `Tyre_Replenishment_Plan_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  // Generate PDF Report
  const generatePDF = () => {
    if (!results) return;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // Header
    pdf.setFillColor(5, 28, 44);
    pdf.rect(0, 0, pageWidth, 30, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.text('Tyre Replenishment Planning System', 15, 15);
    pdf.setFontSize(12);
    pdf.text(`Report Generated: ${format(new Date(), 'MMM d, yyyy')}`, 15, 25);
    
    // Site Info
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.text(`Site: ${inputs.siteName}`, 15, 45);
    pdf.setFontSize(10);
    pdf.text(`Planning Period: ${getPlanningPeriod(inputs.startDate, inputs.forecastPeriod)}`, 15, 52);
    pdf.text(`Forecast Period: ${inputs.forecastPeriod} months`, 15, 58);
    
    // KPIs
    pdf.setFontSize(12);
    pdf.setTextColor(5, 28, 44);
    pdf.text('Key Performance Indicators', 15, 65);
    
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Daily Demand: ${formatNumber(results.dailyDemand)} units/day`, 15, 75);
    pdf.text(`Reorder Point (ROP): ${results.rop} units`, 15, 82);
    pdf.text(`Reorder Quantity (ROQ): ${results.roq} units/cycle`, 15, 89);
    pdf.text(`Projected Deliveries: ${results.projectedDeliveries} per year`, 15, 96);
    
    // Delivery Schedule Summary
    pdf.setFontSize(12);
    pdf.setTextColor(5, 28, 44);
    pdf.text('Delivery Schedule Summary', 15, 110);
    
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    let y = 120;
    results.orderCycles.slice(0, 6).forEach((cycle) => {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(`Cycle ${cycle.cycleNumber} (${cycle.startMonth} - ${cycle.endMonth}): ${cycle.totalDemand} units`, 15, y);
      y += 7;
    });
    
    // Footer
    const totalPages = (pdf as unknown as { internal: { pages: unknown[] } }).internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`PT Merdeka Copper Gold Tbk - Tyre Replenishment Planning System - Page ${i} of ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
    }
    
    pdf.save(`Tyre_Replenishment_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Chart data
  const inventoryChartData = useMemo(() => {
    if (!results) return null;
    
    // Sample every 7 days for performance
    const sampledData = results.dailyStockProjection.filter((_, i) => i % 7 === 0);
    
    return {
      labels: sampledData.map(d => format(d.date, 'MMM d')),
      datasets: [
        {
          label: 'Stock Level',
          data: sampledData.map(d => d.endingStock),
          borderColor: '#051c2c',
          backgroundColor: 'rgba(5, 28, 44, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'ROP',
          data: sampledData.map(() => results.rop),
          borderColor: '#ffc000',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Max Capacity',
          data: sampledData.map(() => inputs.maxCapacity),
          borderColor: '#ff0000',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [results, inputs.maxCapacity]);

  const deliveryChartData = useMemo(() => {
    if (!results) return null;
    
    return {
      labels: results.deliverySchedule.map(d => format(d.arrivalDate, 'MMM d')),
      datasets: [
        {
          label: 'Delivery Quantity',
          data: results.deliverySchedule.map(d => d.quantity),
          backgroundColor: results.deliverySchedule.map(d => {
            const quarter = Math.floor((d.orderCycle - 1) % 4);
            const colors = ['#051c2c', '#c9a227', '#00b050', '#0070c0'];
            return colors[quarter];
          }),
          borderRadius: 4,
        },
      ],
    };
  }, [results]);

  const riskAssessment = useMemo(() => {
    if (!results) return null;
    return getRiskAssessment(results.dailyStockProjection);
  }, [results]);

  if (!results) return null;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#f5f7fa] print:bg-white">
        {/* Header */}
        <header className="bg-[#051c2c] text-white py-4 px-6 print:hidden">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#c9a227] rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-[#051c2c]" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Tyre Replenishment Planning System</h1>
                <p className="text-xs text-gray-400">PT Merdeka Copper Gold Tbk</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                className="bg-transparent border-white/30 text-white hover:bg-white/10"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generatePDF}
                className="bg-transparent border-white/30 text-white hover:bg-white/10"
              >
                <FileText className="w-4 h-4 mr-2" />
                PDF Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="bg-transparent border-white/30 text-white hover:bg-white/10"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </header>

        {/* Print Header */}
        <div className="hidden print:block p-8">
          <h1 className="text-2xl font-bold text-[#051c2c]">Tyre Replenishment Planning Report</h1>
          <p className="text-gray-600">{inputs.siteName} - {getPlanningPeriod(inputs.startDate, inputs.forecastPeriod)} ({inputs.forecastPeriod} months)</p>
        </div>

        {/* Main Content */}
        <div className="max-w-[1600px] mx-auto p-6 flex gap-6 print:block">
          {/* Sidebar - Input Section */}
          <aside className="w-[380px] flex-shrink-0 print:hidden">
            <Card className="sticky top-6 shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-[#051c2c] to-[#0a3a5c] text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="w-5 h-5" />
                  Planning Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-5">
                {/* Site Presets */}
                <div>
                  <Label className="text-sm font-semibold text-[#051c2c] mb-2 block">Site Configuration</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={inputs.siteName === 'Pani Mine' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleSitePreset('pani')}
                      className={inputs.siteName === 'Pani Mine' ? 'bg-[#051c2c]' : ''}
                    >
                      Pani Mine
                    </Button>
                    <Button
                      variant={inputs.siteName === 'Tujuh Bukit' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleSitePreset('tujuhBukit')}
                      className={inputs.siteName === 'Tujuh Bukit' ? 'bg-[#051c2c]' : ''}
                    >
                      Tujuh Bukit
                    </Button>
                    <Button
                      variant={inputs.siteName === 'Custom' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleSitePreset('custom')}
                      className={inputs.siteName === 'Custom' ? 'bg-[#051c2c]' : ''}
                    >
                      Custom
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Date Picker */}
                <div>
                  <Label className="text-sm font-semibold text-[#051c2c] mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Forecast Start Date
                  </Label>
                  <Input
                    type="date"
                    value={inputs.startDate}
                    onChange={(e) => setInputs({ ...inputs, startDate: e.target.value })}
                    className="border-gray-300 focus:border-[#c9a227] focus:ring-[#c9a227]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {getPlanningPeriod(inputs.startDate, inputs.forecastPeriod)}
                  </p>
                </div>

                <Separator />

                {/* Forecast Period Selector */}
                <div>
                  <Label className="text-sm font-semibold text-[#051c2c] mb-2 block">Forecast Period</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={inputs.forecastPeriod === 3 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        // Trim or extend monthly demands array
                        const newDemands = inputs.monthlyDemands.slice(0, 3);
                        while (newDemands.length < 3) newDemands.push(10);
                        setInputs({ ...inputs, forecastPeriod: 3, monthlyDemands: newDemands });
                      }}
                      className={inputs.forecastPeriod === 3 ? 'bg-[#051c2c]' : ''}
                    >
                      3 Months
                    </Button>
                    <Button
                      variant={inputs.forecastPeriod === 6 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        // Trim or extend monthly demands array
                        const newDemands = inputs.monthlyDemands.slice(0, 6);
                        while (newDemands.length < 6) newDemands.push(10);
                        setInputs({ ...inputs, forecastPeriod: 6, monthlyDemands: newDemands });
                      }}
                      className={inputs.forecastPeriod === 6 ? 'bg-[#051c2c]' : ''}
                    >
                      6 Months
                    </Button>
                    <Button
                      variant={inputs.forecastPeriod === 12 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        // Trim or extend monthly demands array
                        const newDemands = inputs.monthlyDemands.slice(0, 12);
                        while (newDemands.length < 12) newDemands.push(10);
                        setInputs({ ...inputs, forecastPeriod: 12, monthlyDemands: newDemands });
                      }}
                      className={inputs.forecastPeriod === 12 ? 'bg-[#051c2c]' : ''}
                    >
                      12 Months
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Monthly Demand Inputs */}
                <div>
                  <Label className="text-sm font-semibold text-[#051c2c] mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Monthly Demand Forecast (Units)
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {inputs.monthlyDemands.slice(0, inputs.forecastPeriod).map((demand, index) => (
                      <div key={index} className="space-y-1">
                        <Label className="text-xs text-gray-500">
                          Month {index + 1} ({monthLabels[index]})
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={demand}
                          onChange={(e) => handleDemandChange(index, e.target.value)}
                          className="h-8 border-gray-300 focus:border-[#c9a227] focus:ring-[#c9a227]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Planning Parameters */}
                <div className="space-y-4">
                  <Label className="text-sm font-semibold text-[#051c2c] flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Planning Parameters
                  </Label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Lead Time (days)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={inputs.leadTime}
                        onChange={(e) => setInputs({ ...inputs, leadTime: parseInt(e.target.value) || 0 })}
                        className="h-8 border-gray-300 focus:border-[#c9a227] focus:ring-[#c9a227]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Max Capacity (units)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={inputs.maxCapacity}
                        onChange={(e) => setInputs({ ...inputs, maxCapacity: parseInt(e.target.value) || 0 })}
                        className="h-8 border-gray-300 focus:border-[#c9a227] focus:ring-[#c9a227]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Initial Stock (units)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={inputs.initialStock}
                        onChange={(e) => setInputs({ ...inputs, initialStock: parseInt(e.target.value) || 0 })}
                        className="h-8 border-gray-300 focus:border-[#c9a227] focus:ring-[#c9a227]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Safety Stock %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={inputs.safetyStockPercent}
                        onChange={(e) => setInputs({ ...inputs, safetyStockPercent: parseInt(e.target.value) || 0 })}
                        className="h-8 border-gray-300 focus:border-[#c9a227] focus:ring-[#c9a227]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Safety Stock Slider</span>
                      <span className="font-semibold text-[#c9a227]">{inputs.safetyStockPercent}%</span>
                    </div>
                    <Slider
                      value={[inputs.safetyStockPercent]}
                      onValueChange={(value) => setInputs({ ...inputs, safetyStockPercent: value[0] })}
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Capacity Alert */}
                {showCapacityAlert && (
                  <Alert className="bg-yellow-50 border-yellow-400">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <AlertDescription className="text-xs text-yellow-800">
                      Capacity constraint triggered. Deliveries will be split to avoid overflow.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </aside>

          {/* Main Dashboard */}
          <main className="flex-1 min-w-0">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6 print:grid-cols-2">
              <Card className="border-l-4 border-l-[#051c2c] shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Daily Demand</p>
                      <p className="text-2xl font-bold text-[#051c2c]">{formatNumber(results.dailyDemand)}</p>
                      <p className="text-xs text-gray-400">units/day</p>
                    </div>
                    <div className="w-10 h-10 bg-[#051c2c]/10 rounded-full flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-[#051c2c]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-[#c9a227] shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Reorder Point (ROP)</p>
                      <p className="text-2xl font-bold text-[#c9a227]">{results.rop}</p>
                      <p className="text-xs text-gray-400">units</p>
                    </div>
                    <div className="w-10 h-10 bg-[#c9a227]/10 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-[#c9a227]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-[#00b050] shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Reorder Quantity (ROQ)</p>
                      <p className="text-2xl font-bold text-[#00b050]">{results.roq}</p>
                      <p className="text-xs text-gray-400">units/cycle</p>
                    </div>
                    <div className="w-10 h-10 bg-[#00b050]/10 rounded-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-[#00b050]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-[#0070c0] shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Projected Deliveries</p>
                      <p className="text-2xl font-bold text-[#0070c0]">{results.projectedDeliveries}</p>
                      <p className="text-xs text-gray-400">per year</p>
                    </div>
                    <div className="w-10 h-10 bg-[#0070c0]/10 rounded-full flex items-center justify-center">
                      <Warehouse className="w-5 h-5 text-[#0070c0]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="space-y-4 mb-6">
              {/* Inventory Projection Chart */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-[#051c2c] flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Inventory Projection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {inventoryChartData && (
                      <Line
                        data={inventoryChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          interaction: {
                            mode: 'index',
                            intersect: false,
                          },
                          plugins: {
                            legend: {
                              position: 'top',
                              labels: {
                                usePointStyle: true,
                                boxWidth: 8,
                              },
                            },
                            tooltip: {
                              backgroundColor: '#051c2c',
                              titleColor: '#fff',
                              bodyColor: '#fff',
                              borderColor: '#c9a227',
                              borderWidth: 1,
                            },
                          },
                          scales: {
                            x: {
                              grid: {
                                display: false,
                              },
                              ticks: {
                                maxTicksLimit: 12,
                              },
                            },
                            y: {
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: 'Stock Level (units)',
                              },
                            },
                          },
                        }}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Schedule Chart */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-[#051c2c] flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Delivery Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    {deliveryChartData && (
                      <Bar
                        data={deliveryChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              display: false,
                            },
                            tooltip: {
                              backgroundColor: '#051c2c',
                              titleColor: '#fff',
                              bodyColor: '#fff',
                              borderColor: '#c9a227',
                              borderWidth: 1,
                              callbacks: {
                                title: (items) => {
                                  const item = items[0];
                                  const delivery = results.deliverySchedule[item.dataIndex];
                                  return `Delivery #${delivery.id} - ${format(delivery.arrivalDate, 'MMM d, yyyy')}`;
                                },
                                label: (item) => {
                                  return `Quantity: ${item.raw} units`;
                                },
                              },
                            },
                          },
                          scales: {
                            x: {
                              grid: {
                                display: false,
                              },
                              ticks: {
                                maxTicksLimit: 12,
                              },
                            },
                            y: {
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: 'Quantity (units)',
                              },
                            },
                          },
                        }}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Data Tables */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[#051c2c] flex items-center gap-2">
                  <Table2 className="w-5 h-5" />
                  Detailed Planning Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="daily-stock">Daily Stock Projection</TabsTrigger>
                    <TabsTrigger value="delivery-plan">Delivery Plan</TabsTrigger>
                    <TabsTrigger value="executive-summary">Executive Summary</TabsTrigger>
                  </TabsList>

                  <TabsContent value="daily-stock">
                    <ScrollArea className="h-[400px] border rounded-md">
                      <table className="w-full text-sm">
                        <thead className="bg-[#051c2c] text-white sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Day #</th>
                            <th className="px-3 py-2 text-right">Beginning</th>
                            <th className="px-3 py-2 text-right">Demand</th>
                            <th className="px-3 py-2 text-right">Delivery</th>
                            <th className="px-3 py-2 text-right">Ending</th>
                            <th className="px-3 py-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filterProjectionForDisplay(results.dailyStockProjection).map((day, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-3 py-2">{format(day.date, 'MMM d, yyyy')}</td>
                              <td className="px-3 py-2">{day.dayNumber}</td>
                              <td className="px-3 py-2 text-right">{formatNumber(day.beginningStock)}</td>
                              <td className="px-3 py-2 text-right">{formatNumber(day.dailyDemand)}</td>
                              <td className="px-3 py-2 text-right">
                                {day.incomingDelivery > 0 && (
                                  <span className="text-[#0070c0] font-semibold">+{day.incomingDelivery}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-medium">{formatNumber(day.endingStock)}</td>
                              <td className="px-3 py-2 text-center">
                                <Badge 
                                  variant="outline"
                                  className={`
                                    ${day.status === 'normal' ? 'bg-green-50 text-green-700 border-green-300' : ''}
                                    ${day.status === 'below-rop' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' : ''}
                                    ${day.status === 'stockout' ? 'bg-red-50 text-red-700 border-red-300' : ''}
                                    ${day.status === 'delivery' ? 'bg-blue-50 text-blue-700 border-blue-300' : ''}
                                  `}
                                >
                                  {day.status === 'below-rop' ? 'Below ROP' : day.status.charAt(0).toUpperCase() + day.status.slice(1)}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="delivery-plan">
                    <ScrollArea className="h-[400px] border rounded-md">
                      <table className="w-full text-sm">
                        <thead className="bg-[#051c2c] text-white sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Delivery #</th>
                            <th className="px-3 py-2 text-left">Order Date</th>
                            <th className="px-3 py-2 text-left">Arrival Date</th>
                            <th className="px-3 py-2 text-right">Quantity</th>
                            <th className="px-3 py-2 text-right">Cumulative</th>
                            <th className="px-3 py-2 text-center">Order Cycle</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.deliverySchedule.map((delivery, index) => (
                            <tr key={delivery.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-3 py-2 font-medium">#{delivery.id}</td>
                              <td className="px-3 py-2">{format(delivery.orderDate, 'MMM d, yyyy')}</td>
                              <td className="px-3 py-2">
                                <span className="flex items-center gap-1">
                                  <Package className="w-3 h-3 text-[#0070c0]" />
                                  {format(delivery.arrivalDate, 'MMM d, yyyy')}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-semibold">{delivery.quantity}</td>
                              <td className="px-3 py-2 text-right text-gray-600">{delivery.cumulative}</td>
                              <td className="px-3 py-2 text-center">
                                <Badge variant="secondary">Cycle {delivery.orderCycle}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="executive-summary">
                    <div className="space-y-6 p-4">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#051c2c]/5 p-4 rounded-lg">
                          <h4 className="font-semibold text-[#051c2c] mb-2">Planning Overview</h4>
                          <ul className="space-y-2 text-sm">
                            <li className="flex justify-between">
                              <span className="text-gray-600">Site:</span>
                              <span className="font-medium">{inputs.siteName}</span>
                            </li>
                            <li className="flex justify-between">
                              <span className="text-gray-600">Period:</span>
                              <span className="font-medium">{getPlanningPeriod(inputs.startDate, inputs.forecastPeriod)}</span>
                            </li>
                            <li className="flex justify-between">
                              <span className="text-gray-600">Forecast Period:</span>
                              <span className="font-medium">{inputs.forecastPeriod} months</span>
                            </li>
                            <li className="flex justify-between">
                              <span className="text-gray-600">Total Annual Demand:</span>
                              <span className="font-medium">{inputs.monthlyDemands.reduce((a, b) => a + b, 0)} units</span>
                            </li>
                            <li className="flex justify-between">
                              <span className="text-gray-600">Lead Time:</span>
                              <span className="font-medium">{inputs.leadTime} days</span>
                            </li>
                          </ul>
                        </div>

                        <div className="bg-[#c9a227]/10 p-4 rounded-lg">
                          <h4 className="font-semibold text-[#051c2c] mb-2">Key Metrics</h4>
                          <ul className="space-y-2 text-sm">
                            <li className="flex justify-between">
                              <span className="text-gray-600">Daily Demand:</span>
                              <span className="font-medium">{formatNumber(results.dailyDemand)} units/day</span>
                            </li>
                            <li className="flex justify-between">
                              <span className="text-gray-600">Reorder Point:</span>
                              <span className="font-medium">{results.rop} units</span>
                            </li>
                            <li className="flex justify-between">
                              <span className="text-gray-600">Reorder Quantity:</span>
                              <span className="font-medium">{results.roq} units</span>
                            </li>
                            <li className="flex justify-between">
                              <span className="text-gray-600">Deliveries/Year:</span>
                              <span className="font-medium">{results.projectedDeliveries}</span>
                            </li>
                          </ul>
                        </div>
                      </div>

                      {/* Risk Assessment */}
                      {riskAssessment && (
                        <div className={`p-4 rounded-lg border-l-4 ${
                          riskAssessment.level === 'low' ? 'bg-green-50 border-green-500' :
                          riskAssessment.level === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                          'bg-red-50 border-red-500'
                        }`}>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Risk Assessment
                          </h4>
                          <p className="text-sm">{riskAssessment.message}</p>
                          {riskAssessment.stockoutDays > 0 && (
                            <p className="text-sm mt-2 font-semibold text-red-700">
                              Action Required: Review safety stock levels and lead time parameters.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Working Capital Impact */}
                      <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                        <h4 className="font-semibold text-[#051c2c] mb-2">Working Capital Impact</h4>
                        <p className="text-sm text-gray-700">
                          Based on the current planning parameters, the maximum inventory level is 
                          <span className="font-semibold"> {inputs.maxCapacity} units</span> with an average 
                          safety stock of <span className="font-semibold">{Math.round(results.rop * 0.5)} units</span>.
                        </p>
                        <p className="text-sm text-gray-700 mt-2">
                          The {inputs.safetyStockPercent}% safety stock buffer provides approximately 
                          <span className="font-semibold"> {Math.round(results.rop / results.dailyDemand)} days</span> of 
                          coverage against demand variability and lead time uncertainty.
                        </p>
                      </div>

                      {/* Recommendations */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-[#051c2c] mb-2">Recommendations</h4>
                        <ul className="space-y-2 text-sm text-gray-700">
                          <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 text-[#c9a227] mt-0.5 flex-shrink-0" />
                            <span>Monitor inventory levels closely when approaching the reorder point of {results.rop} units.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 text-[#c9a227] mt-0.5 flex-shrink-0" />
                            <span>Place orders {inputs.leadTime} days before expected stock depletion to ensure timely delivery.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 text-[#c9a227] mt-0.5 flex-shrink-0" />
                            <span>Consider increasing warehouse capacity if frequent lot splitting occurs.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 text-[#c9a227] mt-0.5 flex-shrink-0" />
                            <span>Review safety stock percentage quarterly based on actual demand variability.</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default App;
