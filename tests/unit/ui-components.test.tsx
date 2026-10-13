import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Users, Briefcase, Cpu, FileCheck2, FileText, Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";

describe("UI Components Icon Contract", () => {
  describe("EmptyState Component", () => {
    it("renders successfully when passed a LucideIcon component reference (Users)", () => {
      const html = renderToStaticMarkup(
        <EmptyState
          icon={Users}
          title="No Customers Registered"
          description="Add your first commercial client to start tracking AC units."
        />
      );

      expect(html).toContain("No Customers Registered");
      expect(html).toContain("svg");
      expect(html).toContain("lucide-users");
    });

    it("renders successfully when passed a LucideIcon component reference (Briefcase, Cpu)", () => {
      const htmlJobs = renderToStaticMarkup(
        <EmptyState
          icon={Briefcase}
          title="No Jobs Dispatched"
          description="Create a work order from the Jobs workspace."
        />
      );
      expect(htmlJobs).toContain("No Jobs Dispatched");
      expect(htmlJobs).toContain("svg");
      expect(htmlJobs).toContain("lucide-briefcase");

      const htmlEquip = renderToStaticMarkup(
        <EmptyState
          icon={Cpu}
          title="No AC Units"
          description="Register AC cooling units."
        />
      );
      expect(htmlEquip).toContain("No AC Units");
      expect(htmlEquip).toContain("svg");
      expect(htmlEquip).toContain("lucide-cpu");
    });

    it("renders successfully when passed an already-instantiated JSX element", () => {
      const html = renderToStaticMarkup(
        <EmptyState
          icon={<FileCheck2 className="h-7 w-7 text-emerald-500 custom-icon" />}
          title="Custom Element Icon"
          description="Testing instantiated element."
        />
      );

      expect(html).toContain("Custom Element Icon");
      expect(html).toContain("custom-icon");
    });

    it("renders successfully when icon is omitted", () => {
      const html = renderToStaticMarkup(
        <EmptyState
          title="No Records"
          description="Clean empty state without an icon."
        />
      );

      expect(html).toContain("No Records");
      expect(html).not.toContain("rounded-full bg-slate-100");
    });
  });

  describe("MetricCard Component", () => {
    it("renders successfully with an instantiated JSX element", () => {
      const html = renderToStaticMarkup(
        <MetricCard
          title="Total Work Orders"
          value={42}
          icon={<Receipt className="h-5 w-5" />}
        />
      );

      expect(html).toContain("Total Work Orders");
      expect(html).toContain("42");
      expect(html).toContain("svg");
    });

    it("renders successfully when passed a LucideIcon component reference", () => {
      const html = renderToStaticMarkup(
        <MetricCard
          title="Active Contracts"
          value="18"
          icon={FileText}
        />
      );

      expect(html).toContain("Active Contracts");
      expect(html).toContain("18");
      expect(html).toContain("svg");
      expect(html).toContain("lucide-file-text");
    });
  });
});
