import { describe, it, expect } from "vitest";
import {
  canManageTeam,
  canManageCustomers,
  canManageJobs,
  canManageQuotes,
  canManageInvoices,
  canRecordPayments,
  isTechnician,
  canViewFinancialReports,
} from "@/lib/permissions";

describe("Role-Based Permission Rules", () => {
  it("verifies owner has full permissions", () => {
    expect(canManageTeam("owner")).toBe(true);
    expect(canManageCustomers("owner")).toBe(true);
    expect(canManageJobs("owner")).toBe(true);
    expect(canManageQuotes("owner")).toBe(true);
    expect(canManageInvoices("owner")).toBe(true);
    expect(canRecordPayments("owner")).toBe(true);
    expect(canViewFinancialReports("owner")).toBe(true);
    expect(isTechnician("owner")).toBe(false);
  });

  it("verifies dispatcher permissions are operational, not financial", () => {
    expect(canManageTeam("dispatcher")).toBe(false);
    expect(canManageCustomers("dispatcher")).toBe(true);
    expect(canManageJobs("dispatcher")).toBe(true);
    expect(canManageQuotes("dispatcher")).toBe(false);
    expect(canManageInvoices("dispatcher")).toBe(false);
    expect(canRecordPayments("dispatcher")).toBe(false);
    expect(canViewFinancialReports("dispatcher")).toBe(false);
  });

  it("verifies finance permissions cover billing but not dispatcher tasks", () => {
    expect(canManageTeam("finance")).toBe(false);
    expect(canManageCustomers("finance")).toBe(false);
    expect(canManageJobs("finance")).toBe(false);
    expect(canManageQuotes("finance")).toBe(true);
    expect(canManageInvoices("finance")).toBe(true);
    expect(canRecordPayments("finance")).toBe(true);
    expect(canViewFinancialReports("finance")).toBe(true);
  });

  it("verifies technician is restricted from management and finance", () => {
    expect(isTechnician("technician")).toBe(true);
    expect(canManageTeam("technician")).toBe(false);
    expect(canManageCustomers("technician")).toBe(false);
    expect(canManageJobs("technician")).toBe(false);
    expect(canManageQuotes("technician")).toBe(false);
    expect(canManageInvoices("technician")).toBe(false);
    expect(canRecordPayments("technician")).toBe(false);
    expect(canViewFinancialReports("technician")).toBe(false);
  });
});
