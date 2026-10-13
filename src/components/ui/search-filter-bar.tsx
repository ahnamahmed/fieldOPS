"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "./input";

interface FilterOption {
  label: string;
  value: string;
}

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: FilterOption[];
  filterLabel?: string;
  actions?: React.ReactNode;
  resultsCount?: number;
}

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search records...",
  filterValue,
  onFilterChange,
  filterOptions,
  filterLabel = "All Statuses",
  actions,
  resultsCount,
}: SearchFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-1">
      <div className="flex flex-1 items-center gap-2.5 max-w-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 pr-8 h-9 text-sm bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {filterOptions && onFilterChange && (
          <select
            value={filterValue || ""}
            onChange={(e) => onFilterChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{filterLabel}</option>
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {resultsCount !== undefined && (
          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{resultsCount}</strong> results
          </span>
        )}
        {actions}
      </div>
    </div>
  );
}
