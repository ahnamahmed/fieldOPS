import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }> | React.ReactNode;
  iconBgColor?: string;
  badge?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = "bg-blue-50 text-blue-700",
  badge,
  className,
}: MetricCardProps) {
  const renderIcon = () => {
    if (React.isValidElement(icon)) {
      return icon;
    }
    if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
      const Icon = icon as React.ComponentType<{ className?: string }>;
      return <Icon className="h-5 w-5" />;
    }
    return icon;
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </p>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border border-slate-100",
            iconBgColor
          )}
        >
          {renderIcon()}
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {value}
        </span>
        {badge && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
            {badge}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 font-medium">{subtitle}</p>
      )}
    </div>
  );
}
