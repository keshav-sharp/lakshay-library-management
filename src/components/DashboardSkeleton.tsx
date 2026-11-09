import React from 'react';

/**
 * Shimmer loading skeleton for the 4-cell Unified KPI Metrics Header Bar
 * (Active Students, Total Desks Occupied, Pending Dues, Monthly Run-Rate).
 */
export const MetricsHeaderSkeleton: React.FC = () => {
  const cells = [
    { labelWidth: 'w-24', valueWidth: 'w-12', badgeWidth: 'w-14' },
    { labelWidth: 'w-28', valueWidth: 'w-16', badgeWidth: 'w-12' },
    { labelWidth: 'w-20', valueWidth: 'w-10', badgeWidth: 'w-16' },
    { labelWidth: 'w-24', valueWidth: 'w-20', badgeWidth: 'w-6' },
  ];

  return (
    <section
      aria-busy="true"
      aria-label="Loading library metrics from Firestore"
      className="bg-white rounded-2xl border border-slate-200/60 shadow-sm grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/60 overflow-hidden"
    >
      {cells.map((cell, index) => (
        <div key={index} className="p-3.5 sm:p-4">
          {/* Uppercase muted label placeholder */}
          <div className={`h-3 ${cell.labelWidth} rounded-md lakshay-shimmer`} />

          {/* Metric value + right status tag */}
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <div className={`h-6 ${cell.valueWidth} rounded-lg lakshay-shimmer`} />
            <div className={`h-3.5 ${cell.badgeWidth} rounded-full lakshay-shimmer`} />
          </div>
        </div>
      ))}
    </section>
  );
};

/**
 * Shimmer loading skeleton for the Student List Header and Student Cards
 * while Firestore snapshot data is initially fetching.
 */
export const StudentListSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div
      aria-busy="true"
      aria-label="Fetching student records from Cloud Firestore"
      className="space-y-3.5"
    >
      {/* Student List Header Skeleton */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-0.5">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-28 rounded-md lakshay-shimmer" />
          <div className="h-3.5 w-16 rounded-md lakshay-shimmer" />
          <div className="h-4 w-36 rounded-full lakshay-shimmer hidden sm:block" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-10 rounded-md lakshay-shimmer" />
          <div className="h-6 w-44 rounded-full lakshay-shimmer" />
        </div>
      </div>

      {/* Shimmer Student Card Placeholders */}
      <div className="grid grid-cols-1 gap-3.5">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 sm:p-5 overflow-hidden"
          >
            {/* Card Top Row: Name + Seat Badge + Phone on left, Status Pill on right */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-4 ${
                      idx % 2 === 0 ? 'w-36 sm:w-44' : 'w-32 sm:w-40'
                    } rounded-md lakshay-shimmer`}
                  />
                  <div className="h-4 w-16 rounded-lg lakshay-shimmer" />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full lakshay-shimmer" />
                  <div className="h-3 w-28 rounded-md lakshay-shimmer" />
                </div>
              </div>

              {/* Due Status Pill Placeholder */}
              <div className="h-6 w-24 rounded-full lakshay-shimmer shrink-0" />
            </div>

            {/* 4-Column Inner Metadata Strip (Shift Schedule, Next Due Date, Monthly Fee, History) */}
            <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/60 bg-slate-50/70 rounded-xl border border-slate-200/60 overflow-hidden">
              {[
                { label: 'w-20', value: 'w-24' },
                { label: 'w-20', value: 'w-24' },
                { label: 'w-16', value: 'w-16' },
                { label: 'w-14', value: 'w-16' },
              ].map((col, colIdx) => (
                <div key={colIdx} className="px-3 py-2 space-y-1.5">
                  <div className={`h-2.5 ${col.label} rounded-sm lakshay-shimmer`} />
                  <div className={`h-3.5 ${col.value} rounded-md lakshay-shimmer`} />
                </div>
              ))}
            </div>

            {/* Bottom Action Buttons Row (QR Pass, Badge, WhatsApp, Mark Paid) */}
            <div className="mt-3.5 pt-3 border-t border-slate-200/60 flex items-center justify-end gap-2 flex-wrap">
              <div className="h-7 w-20 rounded-xl lakshay-shimmer" />
              <div className="h-7 w-18 rounded-xl lakshay-shimmer" />
              <div className="h-7 w-24 rounded-xl lakshay-shimmer" />
              <div className="h-7 w-24 rounded-xl lakshay-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
