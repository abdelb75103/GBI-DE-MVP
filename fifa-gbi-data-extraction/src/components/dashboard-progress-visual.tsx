'use client';

type DashboardProgressVisualProps = {
  totalPapers: number;
  completedPapers: number;
  userCompletedPapers: number;
};

export function DashboardProgressVisual({
  totalPapers,
  completedPapers,
  userCompletedPapers,
}: DashboardProgressVisualProps) {
  const size = 200;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate percentages
  const completedPercentage = totalPapers > 0 ? (completedPapers / totalPapers) * 100 : 0;
  const userPercentage = totalPapers > 0 ? (userCompletedPapers / totalPapers) * 100 : 0;
  
  // Calculate stroke dash offsets
  const completedOffset = circumference - (completedPercentage / 100) * circumference;
  const userOffset = circumference - (userPercentage / 100) * circumference;
  
  const completionRate = totalPapers > 0 ? Math.round((completedPapers / totalPapers) * 100) : 0;

  return (
    <div className="flex items-center gap-6">
      {/* Circular Progress */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle (light gray) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
            opacity={0.3}
          />
          
          {/* Purple ring - Total papers base */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#purpleGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={0}
            strokeLinecap="round"
            opacity={0.4}
          />
          
          {/* Green ring - Completed papers */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#greenGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={completedOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
          
          {/* Blue ring - Your completed papers */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#blueGradient)"
            strokeWidth={strokeWidth - 8}
            strokeDasharray={circumference}
            strokeDashoffset={userOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
          
          {/* Gradient Definitions */}
          <defs>
            <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
            <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold text-slate-900">{completionRate}%</div>
          <div className="text-xs font-medium text-slate-500">Complete</div>
        </div>
      </div>
      
      {/* Legend - Next to the wheel */}
      <div className="flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-gradient-to-br from-purple-50/80 via-violet-50/60 to-purple-50/80 px-3 py-2 shadow-sm ring-1 ring-purple-200/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-purple-500 to-violet-400 shadow-sm" />
            <span className="text-xs font-medium text-slate-700">Total Papers</span>
          </div>
          <span className="text-sm font-semibold text-purple-700">{totalPapers}</span>
        </div>
        
        <div className="flex items-center justify-between gap-3 rounded-lg bg-gradient-to-br from-emerald-50/80 via-teal-50/60 to-emerald-50/80 px-3 py-2 shadow-sm ring-1 ring-emerald-200/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-400 shadow-sm" />
            <span className="text-xs font-medium text-slate-700">Completed</span>
          </div>
          <span className="text-sm font-semibold text-emerald-700">{completedPapers}</span>
        </div>
        
        <div className="flex items-center justify-between gap-3 rounded-lg bg-gradient-to-br from-blue-50/80 via-sky-50/60 to-blue-50/80 px-3 py-2 shadow-sm ring-1 ring-blue-200/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-blue-500 to-blue-400 shadow-sm" />
            <span className="text-xs font-medium text-slate-700">Your Completed</span>
          </div>
          <span className="text-sm font-semibold text-blue-700">{userCompletedPapers}</span>
        </div>
      </div>
    </div>
  );
}
