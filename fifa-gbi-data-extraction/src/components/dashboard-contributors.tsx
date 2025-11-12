'use client';

import { memo, useMemo } from 'react';

type Contributor = {
  id: string;
  name: string;
  completedCount: number;
};

type DashboardContributorsProps = {
  contributors: Contributor[];
  currentUserId: string | null;
  totalCompleted: number;
};

export const DashboardContributors = memo(function DashboardContributors({
  contributors,
  currentUserId,
  totalCompleted,
}: DashboardContributorsProps) {
  // Memoize sorted contributors
  const topContributors = useMemo(() => {
    return [...contributors]
      .sort((a, b) => b.completedCount - a.completedCount)
      .slice(0, 8);
  }, [contributors]);
  
  const maxCount = useMemo(() => {
    return Math.max(...topContributors.map((c) => c.completedCount), 1);
  }, [topContributors]);

  const getAccentColor = (index: number, isCurrentUser: boolean) => {
    if (isCurrentUser) {
      return {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
        barBg: 'bg-purple-100',
        barFill: 'bg-gradient-to-r from-purple-500 to-purple-400',
      };
    }
    
    if (index === 0) {
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        barBg: 'bg-amber-100',
        barFill: 'bg-gradient-to-r from-amber-500 to-amber-400',
      };
    }
    if (index === 1) {
      return {
        bg: 'bg-slate-50',
        border: 'border-slate-300',
        text: 'text-slate-700',
        barBg: 'bg-slate-200',
        barFill: 'bg-gradient-to-r from-slate-400 to-slate-300',
      };
    }
    if (index === 2) {
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-700',
        barBg: 'bg-orange-100',
        barFill: 'bg-gradient-to-r from-orange-500 to-orange-400',
      };
    }
    
    return {
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      text: 'text-slate-700',
      barBg: 'bg-slate-100',
      barFill: 'bg-gradient-to-r from-slate-500 to-slate-400',
    };
  };

  if (topContributors.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-500">No contributions yet. Start extracting to appear here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {topContributors.map((contributor, index) => {
        const isCurrentUser = contributor.id === currentUserId;
        const percentage = totalCompleted > 0 ? Math.round((contributor.completedCount / totalCompleted) * 100) : 0;
        const barWidth = maxCount > 0 ? Math.round((contributor.completedCount / maxCount) * 100) : 0;
        const colors = getAccentColor(index, isCurrentUser);
        
        return (
          <div
            key={contributor.id}
            className={`relative overflow-hidden rounded-xl border ${colors.border} ${colors.bg} p-3 transition-all hover:shadow-md ${
              isCurrentUser ? 'ring-2 ring-purple-300 ring-offset-2' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Rank badge */}
                {!isCurrentUser && index < 3 && (
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${colors.text} ${colors.barBg} flex-shrink-0`}>
                    {index + 1}
                  </div>
                )}
                {isCurrentUser && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold bg-purple-200 text-purple-700 flex-shrink-0">
                    ★
                  </div>
                )}
                <span className={`text-sm font-semibold truncate ${isCurrentUser ? 'text-purple-900' : 'text-slate-900'}`}>
                  {contributor.name}
                  {isCurrentUser && (
                    <span className="ml-1.5 text-xs font-normal text-purple-600">(You)</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-lg font-bold ${colors.text}`}>
                  {contributor.completedCount}
                </span>
                <span className="text-[10px] font-medium text-slate-500">
                  ({percentage}%)
                </span>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className={`h-2 w-full overflow-hidden rounded-full ${colors.barBg}`}>
              <div
                className={`h-full ${colors.barFill} transition-all duration-500 ease-out`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});

