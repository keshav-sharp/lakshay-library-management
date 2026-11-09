import React, { useMemo, useState } from 'react';
import { Student } from '../types/student';
import { ThemeColors } from '../types/theme';
import { getDaysDifference } from '../services/storageService';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  CalendarClock,
  IndianRupee,
  TrendingUp,
  AlertCircle,
  Clock,
  ChevronRight,
  Users,
} from 'lucide-react';

interface FeeCollectionForecastProps {
  students: Student[];
  theme: ThemeColors;
  isDarkMode?: boolean;
  onSelectStudent: (student: Student) => void;
}

interface ForecastBucket {
  id: string;
  label: string;
  windowRange: string;
  predictedAmount: number;
  cumulativeAmount: number;
  studentCount: number;
  studentsList: Student[];
  urgency: 'overdue' | 'urgent' | 'upcoming' | 'scheduled';
}

export const FeeCollectionForecast: React.FC<FeeCollectionForecastProps> = ({
  students,
  theme,
  isDarkMode = false,
  onSelectStudent,
}) => {
  const [horizonMode, setHorizonMode] = useState<'weekly_30d' | 'daily_14d'>('weekly_30d');
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);

  // 1. 30-Day Weekly Forecast Buckets based on each student's nextFeeDueDate
  const weeklyForecastData = useMemo<ForecastBucket[]>(() => {
    const buckets: Omit<ForecastBucket, 'cumulativeAmount'>[] = [
      {
        id: 'overdue',
        label: 'Overdue',
        windowRange: 'Past Due (Immediate Recovery)',
        predictedAmount: 0,
        studentCount: 0,
        studentsList: [],
        urgency: 'overdue',
      },
      {
        id: 'days_0_3',
        label: 'Next 3 Days',
        windowRange: 'Days 0–3 (WorkManager Window)',
        predictedAmount: 0,
        studentCount: 0,
        studentsList: [],
        urgency: 'urgent',
      },
      {
        id: 'days_4_7',
        label: 'Days 4–7',
        windowRange: 'Later This Week',
        predictedAmount: 0,
        studentCount: 0,
        studentsList: [],
        urgency: 'upcoming',
      },
      {
        id: 'week_2',
        label: 'Week 2',
        windowRange: 'Days 8–14',
        predictedAmount: 0,
        studentCount: 0,
        studentsList: [],
        urgency: 'scheduled',
      },
      {
        id: 'week_3',
        label: 'Week 3',
        windowRange: 'Days 15–21',
        predictedAmount: 0,
        studentCount: 0,
        studentsList: [],
        urgency: 'scheduled',
      },
      {
        id: 'week_4',
        label: 'Week 4+',
        windowRange: 'Days 22–30+',
        predictedAmount: 0,
        studentCount: 0,
        studentsList: [],
        urgency: 'scheduled',
      },
    ];

    students.forEach((student) => {
      const diff = getDaysDifference(student.nextFeeDueDate);
      let target = buckets[5];
      if (diff < 0) {
        target = buckets[0];
      } else if (diff <= 3) {
        target = buckets[1];
      } else if (diff <= 7) {
        target = buckets[2];
      } else if (diff <= 14) {
        target = buckets[3];
      } else if (diff <= 21) {
        target = buckets[4];
      } else {
        target = buckets[5];
      }

      target.predictedAmount += student.monthlyFee;
      target.studentCount += 1;
      target.studentsList.push(student);
    });

    let runningTotal = 0;
    return buckets.map((b) => {
      runningTotal += b.predictedAmount;
      return {
        ...b,
        cumulativeAmount: runningTotal,
      };
    });
  }, [students]);

  // 2. 14-Day Daily Horizon Forecast based on exact student due dates
  const dailyForecastData = useMemo<ForecastBucket[]>(() => {
    const result: Omit<ForecastBucket, 'cumulativeAmount'>[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // First bucket: Overdue backlog
    const overdueStudents = students.filter((s) => getDaysDifference(s.nextFeeDueDate) < 0);
    result.push({
      id: 'overdue_daily',
      label: 'Overdue',
      windowRange: 'Past Due Backlog',
      predictedAmount: overdueStudents.reduce((sum, s) => sum + s.monthlyFee, 0),
      studentCount: overdueStudents.length,
      studentsList: overdueStudents,
      urgency: 'overdue',
    });

    for (let offset = 0; offset <= 13; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      const shortLabel =
        offset === 0
          ? 'Today'
          : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const fullLabel = d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });

      const dueOnDay = students.filter((s) => getDaysDifference(s.nextFeeDueDate) === offset);
      const sumFee = dueOnDay.reduce((acc, s) => acc + s.monthlyFee, 0);

      result.push({
        id: `day_${offset}`,
        label: shortLabel,
        windowRange: fullLabel,
        predictedAmount: sumFee,
        studentCount: dueOnDay.length,
        studentsList: dueOnDay,
        urgency: offset <= 3 ? 'urgent' : offset <= 7 ? 'upcoming' : 'scheduled',
      });
    }

    let runningTotal = 0;
    return result.map((b) => {
      runningTotal += b.predictedAmount;
      return {
        ...b,
        cumulativeAmount: runningTotal,
      };
    });
  }, [students]);

  const activeData = horizonMode === 'weekly_30d' ? weeklyForecastData : dailyForecastData;

  // Summary KPIs for the Forecast card based on individual student due dates
  const forecastSummary = useMemo(() => {
    let overduePool = 0;
    let next7Days = 0;
    let next30DaysTotal = 0;
    let next30DaysStudentCount = 0;
    let dueSoonCount = 0;

    students.forEach((s) => {
      const diff = getDaysDifference(s.nextFeeDueDate);
      if (diff <= 30) {
        next30DaysTotal += s.monthlyFee;
        next30DaysStudentCount += 1;
      }
      if (diff < 0) {
        overduePool += s.monthlyFee;
      } else if (diff <= 7) {
        next7Days += s.monthlyFee;
        dueSoonCount += 1;
      }
    });

    return {
      overduePool,
      next7Days,
      next30DaysTotal,
      next30DaysStudentCount,
      dueSoonCount,
    };
  }, [students]);

  const selectedBucket = useMemo(() => {
    if (!selectedBucketId) return activeData.find((b) => b.studentCount > 0) || activeData[0];
    return activeData.find((b) => b.id === selectedBucketId) || activeData[0];
  }, [activeData, selectedBucketId]);

  const getBarColor = (urgency: ForecastBucket['urgency']) => {
    switch (urgency) {
      case 'overdue':
        return '#e11d48'; // rose-600
      case 'urgent':
        return '#d97706'; // amber-600
      case 'upcoming':
        return '#f59e0b'; // amber-500
      default:
        return isDarkMode ? '#64748b' : '#475569'; // slate
    }
  };

  const gridStroke = isDarkMode ? '#1e293b' : '#f1f5f9';
  const axisTickColor = isDarkMode ? '#94a3b8' : '#64748b';

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow space-y-4">
      {/* Header & Horizon Switcher */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Fee Collection Forecast
            </h3>
            <span className="text-[11px] font-mono text-amber-600 font-semibold">
              · Due-Date Predictive Model
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Predicts upcoming fee payment volumes and cumulative cash inflow from active student due dates
          </p>
        </div>

        {/* Forecast Horizon Switcher */}
        <div className="flex items-center bg-slate-100/80 p-1 rounded-full border border-slate-200/60 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setHorizonMode('weekly_30d');
              setSelectedBucketId(null);
            }}
            className={`px-3.5 py-1 rounded-full transition-all ${
              horizonMode === 'weekly_30d'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            30-Day Windows
          </button>
          <button
            type="button"
            onClick={() => {
              setHorizonMode('daily_14d');
              setSelectedBucketId(null);
            }}
            className={`px-3.5 py-1 rounded-full transition-all ${
              horizonMode === 'daily_14d'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            14-Day Daily
          </button>
        </div>
      </div>

      {/* 3 Predictive Summary Strips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/60">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-amber-800 font-semibold">
            <span>Next 7 Days Expected</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono flex items-center gap-0.5 mt-1">
            <IndianRupee className="w-4 h-4 text-amber-600" />
            <span>{forecastSummary.next7Days.toLocaleString('en-IN')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            From {forecastSummary.dueSoonCount} student renewal(s) due this week
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/60">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-rose-800 font-semibold">
            <span>Overdue Recovery Pool</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono flex items-center gap-0.5 mt-1">
            <IndianRupee className="w-4 h-4 text-rose-600" />
            <span>{forecastSummary.overduePool.toLocaleString('en-IN')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Immediate collectible backlog from past-due seats
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/60">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-600 font-semibold">
            <span>Total Revenue Projected</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono flex items-center gap-0.5 mt-1">
            <IndianRupee className="w-4 h-4 text-emerald-600" />
            <span>{forecastSummary.next30DaysTotal.toLocaleString('en-IN')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Next 30 days across {forecastSummary.next30DaysStudentCount} due dates
          </p>
        </div>
      </div>

      {/* Recharts Composed Chart: Predicted Window Volume (Bar) + Cumulative Trajectory (Line) */}
      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={activeData}
            margin={{ top: 10, right: 12, left: -15, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: axisTickColor }}
              axisLine={{ stroke: gridStroke }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: axisTickColor }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(val) => `₹${(val / 1000).toFixed(1)}k`}
            />
            <Tooltip
              formatter={(value: any, name: any) => {
                const formatted = `₹${Number(value).toLocaleString('en-IN')}`;
                if (name === 'predictedAmount') return [formatted, 'Predicted Window Volume'];
                if (name === 'cumulativeAmount') return [formatted, 'Cumulative Cash Inflow'];
                return [formatted, String(name ?? '')];
              }}
              labelFormatter={(label, payload) => {
                const item = payload?.[0]?.payload as ForecastBucket | undefined;
                return item
                  ? `${item.label} • ${item.windowRange} (${item.studentCount} students)`
                  : label;
              }}
              contentStyle={{
                backgroundColor: '#0f172a',
                borderRadius: '12px',
                color: '#f8fafc',
                border: '1px solid #334155',
                fontSize: '12px',
              }}
            />
            <Bar
              dataKey="predictedAmount"
              radius={[8, 8, 0, 0]}
              barSize={horizonMode === 'weekly_30d' ? 36 : 20}
              cursor="pointer"
              onClick={(data: any) => {
                if (data && data.id) {
                  setSelectedBucketId(data.id);
                }
              }}
            >
              {activeData.map((entry) => (
                <Cell
                  key={entry.id}
                  fill={getBarColor(entry.urgency)}
                  stroke={selectedBucket?.id === entry.id ? '#fbbf24' : 'none'}
                  strokeWidth={selectedBucket?.id === entry.id ? 2 : 0}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="cumulativeAmount"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#10b981', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" />
            <span>Overdue Backlog</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-600" />
            <span>Due in 0–7 Days</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-600" />
            <span>Scheduled (Weeks 2–4)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Cumulative Cashflow Line</span>
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          Click any bar to inspect students due in that window
        </span>
      </div>

      {/* Interactive Window Inspector: Shows students contributing to the selected forecast window */}
      {selectedBucket && (
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-slate-900">
                {selectedBucket.label}: {selectedBucket.windowRange}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-600">
              ₹{selectedBucket.predictedAmount.toLocaleString('en-IN')} ({selectedBucket.studentCount}{' '}
              {selectedBucket.studentCount === 1 ? 'student' : 'students'})
            </span>
          </div>

          {selectedBucket.studentsList.length === 0 ? (
            <p className="text-xs text-slate-400 py-1">
              No student fee renewals fall inside this date window.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedBucket.studentsList.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onSelectStudent(st)}
                  className="p-2.5 rounded-xl bg-white border border-slate-200/80 hover:border-amber-400 text-left flex items-center justify-between gap-2 transition-all"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {st.name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Seat {st.seatNumber} &bull; Due{' '}
                      {new Date(st.nextFeeDueDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs font-mono font-bold text-slate-900">
                      ₹{st.monthlyFee.toLocaleString('en-IN')}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
