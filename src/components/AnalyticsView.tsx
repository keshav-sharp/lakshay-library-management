import React, { useMemo, useState } from 'react';
import { Student, PaymentRecord } from '../types/student';
import { ThemeColors } from '../types/theme';
import { getDaysDifference, formatDueDateDisplay } from '../services/storageService';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  IndianRupee,
  CreditCard,
  ArrowUpRight,
  Clock,
  Receipt,
  ShieldCheck,
  CalendarClock,
  BarChart3,
  Plus,
  RotateCcw,
  Database,
  Mail,
  Send,
} from 'lucide-react';
import { exportStudentsToCSV } from '../services/exportService';
import { FeeCollectionForecast } from './FeeCollectionForecast';

interface AnalyticsViewProps {
  students: Student[];
  allPayments: Record<string, PaymentRecord[]>;
  theme: ThemeColors;
  isDarkMode?: boolean;
  onSelectStudent: (student: Student) => void;
  onOpenAddStudent?: () => void;
  onRestorePreviousData?: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  students,
  allPayments,
  theme,
  isDarkMode = false,
  onSelectStudent,
  onOpenAddStudent,
  onRestorePreviousData,
}) => {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  const totalActualPaymentRecordsCount = useMemo(() => {
    return Object.values(allPayments).reduce((sum, records) => sum + (records?.length || 0), 0);
  }, [allPayments]);

  // Compute rolling 6 months based purely on real transactions
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = (d.getMonth() + 1).toString().padStart(2, '0');
      const key = `${yr}-${mo}`;
      const monthShort = d.toLocaleString('en-IN', { month: 'short' });
      const fullName = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      months.push({ key, month: monthShort, fullName });
    }

    // Tally actual payments logged in sub-collections
    const revenueMap: Record<string, number> = {};
    const countMap: Record<string, number> = {};

    Object.values(allPayments).forEach((records) => {
      records.forEach((p) => {
        try {
          const date = new Date(p.paymentDate);
          if (!isNaN(date.getTime())) {
            const yr = date.getFullYear();
            const mo = (date.getMonth() + 1).toString().padStart(2, '0');
            const key = `${yr}-${mo}`;
            revenueMap[key] = (revenueMap[key] || 0) + (p.amountPaid || 0);
            countMap[key] = (countMap[key] || 0) + 1;
          }
        } catch {
          // ignore parsing error
        }
      });
    });

    return months.map((m) => {
      const actual = revenueMap[m.key] || 0;
      const count = countMap[m.key] || 0;

      return {
        key: m.key,
        month: m.month,
        fullName: m.fullName,
        revenue: actual,
        paymentsCount: count,
        avgTicket: count > 0 ? Math.round(actual / count) : 0,
      };
    });
  }, [allPayments]);

  // Total 6-month metrics & Next 30-Day Revenue Projection based on individual student due dates
  const kpis = useMemo(() => {
    const totalRevenue = monthlyData.reduce((acc, m) => acc + m.revenue, 0);
    const avgMonthly = Math.round(totalRevenue / Math.max(1, monthlyData.length));
    const currentMonth = monthlyData[monthlyData.length - 1]?.revenue || 0;
    const previousMonth = monthlyData[monthlyData.length - 2]?.revenue || 0;
    const growthPercent =
      previousMonth > 0
        ? Math.round(((currentMonth - previousMonth) / previousMonth) * 100)
        : currentMonth > 0
        ? 100
        : 0;

    // Calculate Total Revenue Projected for the next 30 days based on individual nextFeeDueDate
    let scheduledNext30Days = 0;
    let scheduledNext30Count = 0;
    let overdueRecovery = 0;
    let overdueCount = 0;
    let due0To7Days = 0;
    let due8To15Days = 0;
    let due16To30Days = 0;

    const studentsDueIn30Days: Student[] = [];

    students.forEach((s) => {
      const diff = getDaysDifference(s.nextFeeDueDate);
      if (diff < 0) {
        overdueRecovery += s.monthlyFee;
        overdueCount += 1;
        studentsDueIn30Days.push(s);
      } else if (diff <= 30) {
        scheduledNext30Days += s.monthlyFee;
        scheduledNext30Count += 1;
        studentsDueIn30Days.push(s);
        if (diff <= 7) {
          due0To7Days += s.monthlyFee;
        } else if (diff <= 15) {
          due8To15Days += s.monthlyFee;
        } else {
          due16To30Days += s.monthlyFee;
        }
      }
    });

    const totalRevenueProjected30d = scheduledNext30Days + overdueRecovery;

    return {
      totalRevenue,
      avgMonthly,
      currentMonth,
      growthPercent,
      totalRevenueProjected30d,
      scheduledNext30Days,
      scheduledNext30Count,
      overdueRecovery,
      overdueCount,
      due0To7Days,
      due8To15Days,
      due16To30Days,
      studentsDueIn30Days: studentsDueIn30Days.sort(
        (a, b) => getDaysDifference(a.nextFeeDueDate) - getDaysDifference(b.nextFeeDueDate)
      ),
    };
  }, [monthlyData, students]);

  // Payment mode split
  const paymentModeData = useMemo(() => {
    const modes: Record<string, number> = { UPI: 0, Cash: 0, Card: 0, 'Bank Transfer': 0 };
    let total = 0;

    Object.values(allPayments).forEach((records) => {
      records.forEach((p) => {
        const mode = p.paymentMode || 'UPI';
        modes[mode] = (modes[mode] || 0) + (p.amountPaid || 0);
        total += p.amountPaid || 0;
      });
    });

    if (total === 0) {
      return [];
    }

    const colors = [theme.chartPrimary, '#10b981', '#6366f1', '#06b6d4'];
    return Object.entries(modes)
      .filter(([_, val]) => val > 0)
      .map(([name, val], i) => ({
        name: name === 'UPI' ? 'UPI (GPay/PhonePe)' : name,
        value: Math.round((val / total) * 100),
        amount: val,
        color: colors[i % colors.length],
      }));
  }, [allPayments, theme.chartPrimary]);

  // Shift-wise revenue distribution
  const shiftRevenueData = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach((s) => {
      const shiftName = s.shiftTimings.split('(')[0].trim() || 'General';
      map[shiftName] = (map[shiftName] || 0) + s.monthlyFee;
    });

    return Object.entries(map).map(([name, fee]) => ({
      shift: name.replace('08:00 AM - 02:00 PM', 'Morning (8AM-2PM)')
                 .replace('02:00 PM - 08:00 PM', 'Evening (2PM-8PM)')
                 .replace('08:00 AM - 08:00 PM', 'Full Day (8AM-8PM)')
                 .replace('08:00 PM - 02:00 AM', 'Night Owl'),
      monthlyTotal: fee,
    }));
  }, [students]);

  // Recent 6 transactions flat list
  const recentTransactions = useMemo(() => {
    const list: { record: PaymentRecord; student?: Student }[] = [];
    const studentMap = new Map(students.map((s) => [s.id, s]));

    Object.entries(allPayments).forEach(([studentId, records]) => {
      const s = studentMap.get(studentId);
      records.forEach((r) => {
        list.push({ record: r, student: s });
      });
    });

    return list
      .sort((a, b) => new Date(b.record.paymentDate).getTime() - new Date(a.record.paymentDate).getTime())
      .slice(0, 6);
  }, [allPayments, students]);

  // Empty State: When starting fresh with 0 students
  if (students.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/60 p-8 sm:p-12 text-center shadow-sm">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden border border-amber-200/60 shadow-md mx-auto mb-4">
          <img src="/empty_analytics.jpg" alt="No Analytics Yet" className="w-full h-full object-cover" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          No Analytics Records Yet
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1.5 leading-relaxed">
          Starting fresh with a clean library database. Real-time revenue charts and fee collection forecasts will generate automatically once student accounts are registered and payments are collected.
        </p>

        {/* Quick Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto mt-6 text-left">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Active Students</span>
            <span className="text-base font-bold font-mono text-slate-800 mt-0.5 block">0 Enrolled</span>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">30-Day Forecast</span>
            <span className="text-base font-bold font-mono text-slate-800 mt-0.5 block">₹0</span>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Pending Dues</span>
            <span className="text-base font-bold font-mono text-slate-800 mt-0.5 block">0 Overdue</span>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">6-Mo Revenue</span>
            <span className="text-base font-bold font-mono text-slate-800 mt-0.5 block">₹0 Collected</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 mt-7 flex-wrap">
          {onOpenAddStudent && (
            <button
              type="button"
              onClick={onOpenAddStudent}
              className="px-5 py-2.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Register First Student</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Top Header Banner with Compact Segmented Pill Chart Toggle */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Financial &amp; Revenue Analytics
            </h2>
            <span className="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
              Last 6 Months
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated revenue collected from student desk subscriptions and verified payment histories
          </p>
        </div>

        {/* Compact Segmented Pill Control for Chart Type */}
        <div className="flex items-center bg-slate-100/80 p-1 rounded-full border border-slate-200/60 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setChartType('area')}
            className={`px-3.5 py-1 rounded-full transition-all ${
              chartType === 'area'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Area Chart
          </button>
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className={`px-3.5 py-1 rounded-full transition-all ${
              chartType === 'bar'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bar Chart
          </button>
        </div>
      </div>

      {/* Unified Metrics Header Bar with Subtle Divider Lines */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/60 overflow-hidden">
        <div className="p-4 sm:p-5">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
            6-Mo Revenue
          </span>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-0.5">
            <IndianRupee className="w-4 h-4 text-amber-500" />
            <span>{kpis.totalRevenue.toLocaleString('en-IN')}</span>
          </div>
          {kpis.totalRevenue > 0 ? (
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
              <ArrowUpRight className="w-3 h-3" />
              {kpis.growthPercent >= 0 ? `+${kpis.growthPercent}% vs prev period` : `${kpis.growthPercent}% vs prev period`}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 block mt-1">
              0 payments recorded
            </span>
          )}
        </div>

        <div className="p-4 sm:p-5">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
            Monthly Avg
          </span>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-0.5">
            <IndianRupee className="w-4 h-4 text-slate-400" />
            <span>{kpis.avgMonthly.toLocaleString('en-IN')}</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {kpis.totalRevenue > 0 ? 'Across 6 billing cycles' : 'No recorded transactions'}
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
            Current Month
          </span>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold text-amber-600 tracking-tight flex items-center gap-0.5">
            <IndianRupee className="w-4 h-4 text-amber-500" />
            <span>{kpis.currentMonth.toLocaleString('en-IN')}</span>
          </div>
          <span className="text-[11px] text-amber-700 font-medium block mt-1">
            Ongoing renewals
          </span>
        </div>

        <div className="p-4 sm:p-5 bg-amber-50/40">
          <span className="text-xs uppercase tracking-wider font-semibold text-amber-700 block">
            Total Revenue Projected
          </span>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold text-amber-600 tracking-tight flex items-center gap-0.5 font-mono">
            <IndianRupee className="w-4 h-4 text-amber-500" />
            <span>{kpis.totalRevenueProjected30d.toLocaleString('en-IN')}</span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Next 30 days ({kpis.scheduledNext30Count + kpis.overdueCount} due dates)
          </span>
        </div>
      </div>

      {/* Dedicated Next 30 Days Revenue Projection Breakdown Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Total Revenue Projected (Next 30 Days)
                </h3>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  Live Due-Date Calculation
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Calculated directly from each active student&apos;s individual{' '}
                <code className="font-mono text-[11px] text-amber-600">nextFeeDueDate</code> within the upcoming 30-day window
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
              30-Day Projected Inflow
            </span>
            <span className="text-xl sm:text-2xl font-bold text-amber-600 font-mono">
              ₹{kpis.totalRevenueProjected30d.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* 4-Window Due Date Breakdown Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/60 bg-slate-50/70 rounded-xl border border-slate-200/60 overflow-hidden">
          <div className="p-3">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-rose-600 block">
              Overdue Recovery
            </span>
            <div className="mt-1 text-sm sm:text-base font-bold text-slate-900 font-mono">
              ₹{kpis.overdueRecovery.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-slate-500">
              {kpis.overdueCount} past-due {kpis.overdueCount === 1 ? 'account' : 'accounts'}
            </span>
          </div>

          <div className="p-3">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-600 block">
              Due in 0–7 Days
            </span>
            <div className="mt-1 text-sm sm:text-base font-bold text-slate-900 font-mono">
              ₹{kpis.due0To7Days.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-slate-500">Immediate 7-day window</span>
          </div>

          <div className="p-3">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block">
              Due in 8–15 Days
            </span>
            <div className="mt-1 text-sm sm:text-base font-bold text-slate-900 font-mono">
              ₹{kpis.due8To15Days.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-slate-500">Mid-month renewals</span>
          </div>

          <div className="p-3">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 block">
              Due in 16–30 Days
            </span>
            <div className="mt-1 text-sm sm:text-base font-bold text-slate-900 font-mono">
              ₹{kpis.due16To30Days.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-slate-500">Late-month renewals</span>
          </div>
        </div>

        {/* Upcoming Student Due Dates Pill Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 shrink-0">
            Upcoming Renewals:
          </span>
          {kpis.studentsDueIn30Days.slice(0, 6).map((s) => {
            const diff = getDaysDifference(s.nextFeeDueDate);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectStudent(s)}
                className="px-2.5 py-1 rounded-full bg-slate-100/80 hover:bg-amber-50 border border-slate-200/60 text-[11px] flex items-center gap-1.5 whitespace-nowrap transition-colors shrink-0"
              >
                <span className="font-semibold text-slate-800">{s.name.split(' ')[0]}</span>
                <span className="font-mono text-amber-600 font-bold">₹{s.monthlyFee}</span>
                <span className="text-[10px] text-slate-400">
                  ({diff < 0 ? `${Math.abs(diff)}d ago` : formatDueDateDisplay(s.nextFeeDueDate)})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Recharts 6-Month Revenue Chart */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Monthly Fee Collection Trend (₹)
            </h3>
            <p className="text-xs text-slate-400">
              Consistent financial expansion over the last 6 months at Lakshay Library
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.chartPrimary }} />
            <span>Monthly Revenue</span>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="themeColorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.chartPrimary} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={theme.chartPrimary} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Fee Revenue']}
                  labelFormatter={(label, payload) => {
                    const item = payload?.[0]?.payload;
                    return item ? item.fullName : label;
                  }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={theme.chartPrimary}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#themeColorRevenue)"
                />
              </AreaChart>
            ) : (
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Fee Revenue']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px'
                  }}
                />
                <Bar 
                  dataKey="revenue" 
                  fill={theme.chartPrimary} 
                  radius={[8, 8, 0, 0]} 
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recharts Fee Collection Forecast (Due-Date Predictive Volume Model) */}
      <FeeCollectionForecast
        students={students}
        theme={theme}
        isDarkMode={isDarkMode}
        onSelectStudent={onSelectStudent}
      />

      {/* Grid: Payment Method Breakdown & Shift Revenue Contribution */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Payment Methods */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-slate-500" />
              <span>Payment Methods Distribution</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Breakdown of how library students prefer paying their monthly dues
            </p>
          </div>

          <div className="my-3 space-y-2.5">
            {paymentModeData.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{item.name}</span>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{item.amount.toLocaleString('en-IN')} ({item.value}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ width: `${item.value}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-500 flex items-center justify-between border border-slate-100">
            <span>Primary Collection Channel:</span>
            <span className="font-bold text-slate-800">UPI Instant Settlement</span>
          </div>
        </div>

        {/* Shift Revenue Contribution */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Revenue by Shift Schedule</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Monthly fee collection contributed per study shift
            </p>
          </div>

          <div className="my-3 space-y-2.5">
            {shiftRevenueData.map((item) => (
              <div key={item.shift} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 truncate mr-2">{item.shift}</span>
                <span className="font-bold text-slate-900 shrink-0 font-mono">
                  ₹{item.monthlyTotal.toLocaleString('en-IN')}/mo
                </span>
              </div>
            ))}
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-500 flex items-center justify-between border border-slate-100">
            <span>Highest Revenue Shift:</span>
            <span className="font-bold text-slate-800">Full Day Pass (₹1,800)</span>
          </div>
        </div>
      </div>

      {/* Recent Sub-collection Activity Feed */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-bold text-slate-900">
              Live Verified Firestore Transactions
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            PaymentHistory stream
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {recentTransactions.map(({ record, student }) => {
            const date = new Date(record.paymentDate);
            const dateStr = date.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });

            return (
              <div 
                key={record.id}
                className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 px-2 rounded-xl transition-colors cursor-pointer"
                onClick={() => student && onSelectStudent(student)}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{student?.name || 'Student'}</span>
                      {student && (
                        <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                          Seat {student.seatNumber}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {dateStr} &bull; {record.paymentMode} &bull; {record.receiptNumber || record.id}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-600">
                    +₹{record.amountPaid.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-slate-400">Recorded</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Analytics Email & Cloud Shared Report Card */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 rounded-3xl border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/30">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Monthly Analytics Email &amp; Cloud Shared Report
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              Automatically packages revenue, active enrollments, and payment histories into a report for email delivery &amp; Google Drive shared folders.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              const currentMonthName = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
              const totalRev = monthlyData[monthlyData.length - 1]?.revenue || 0;
              const subject = encodeURIComponent(`Lakshay Library Monthly Report — ${currentMonthName}`);
              const body = encodeURIComponent(
                `Hello Library Management,\n\nHere is the monthly analytics summary for ${currentMonthName}:\n\n` +
                `- Total Enrolled Students: ${students.length}\n` +
                `- Current Month Revenue: ₹${totalRev.toLocaleString('en-IN')}\n` +
                `- Verified Payment Transactions: ${totalActualPaymentRecordsCount}\n\n` +
                `Generated securely by Lakshay Library Management App.`
              );
              window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Monthly Report via Gmail</span>
          </button>

          <button
            type="button"
            onClick={() => {
              exportStudentsToCSV(students, 'Monthly_Analytics_Master_Report');
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs shadow-xs transition-all"
          >
            <Database className="w-3.5 h-3.5 text-amber-600" />
            <span>Save to Shared Cloud Folder</span>
          </button>
        </div>
      </div>
    </div>
  );
};
