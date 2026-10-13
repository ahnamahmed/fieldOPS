import { describe, it, expect } from "vitest";
import {
  onboardingSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/schemas/auth";
import {
  isOwner,
  isAdminOrOwner,
  canManageTeam,
  canManageCustomers,
  canManageJobs,
  canManageQuotes,
  canManageInvoices,
  canRecordPayments,
  canViewFinancialReports,
  isTechnician,
  getRoleBadgeVariant,
  type UserRole,
} from "@/lib/permissions";

describe("Auth & Onboarding Validation & Authorization", () => {
  describe("Onboarding Input Validation", () => {
    it("accepts valid Bangladeshi AC service business onboarding details", () => {
      const result = onboardingSchema.safeParse({
        companyName: "Dhaka Chilling & HVAC Engineering",
        slug: "dhaka-chilling-hvac",
        contactPhone: "01712345678",
        city: "Dhaka",
        address: "Plot 15, Block B, Nikunja-2, Dhaka-1229",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.city).toBe("Dhaka");
      }
    });

    it("rejects invalid slugs containing spaces or uppercase characters", () => {
      const withSpaces = onboardingSchema.safeParse({
        companyName: "Cool Tech",
        slug: "cool tech",
        contactPhone: "01712345678",
      });
      expect(withSpaces.success).toBe(false);

      const withUppercase = onboardingSchema.safeParse({
        companyName: "Cool Tech",
        slug: "CoolTech",
        contactPhone: "01712345678",
      });
      expect(withUppercase.success).toBe(false);
    });

    it("rejects invalid Bangladesh phone numbers during onboarding", () => {
      const result = onboardingSchema.safeParse({
        companyName: "Cool Tech",
        slug: "cooltech",
        contactPhone: "123456",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("valid Bangladesh");
      }
    });
  });

  describe("Password Reset Validation", () => {
    it("validates valid email for forgot password request", () => {
      const valid = forgotPasswordSchema.safeParse({
        email: "rezaul@fieldops.com.bd",
      });
      expect(valid.success).toBe(true);
    });

    it("rejects invalid email for forgot password", () => {
      const invalid = forgotPasswordSchema.safeParse({
        email: "notanemail",
      });
      expect(invalid.success).toBe(false);
    });

    it("validates matching passwords during password reset", () => {
      const valid = resetPasswordSchema.safeParse({
        password: "NewSecurePassword123",
        confirmPassword: "NewSecurePassword123",
      });
      expect(valid.success).toBe(true);
    });

    it("rejects mismatched passwords during password reset", () => {
      const invalid = resetPasswordSchema.safeParse({
        password: "NewSecurePassword123",
        confirmPassword: "DifferentPassword456",
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toBe("Passwords do not match");
      }
    });

    it("rejects passwords shorter than 6 characters", () => {
      const invalid = resetPasswordSchema.safeParse({
        password: "12345",
        confirmPassword: "12345",
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("Role-Based Access Control (Tenant Security)", () => {
    it("enforces owner privileges within tenant scope", () => {
      const role: UserRole = "owner";
      expect(isOwner(role)).toBe(true);
      expect(isAdminOrOwner(role)).toBe(true);
      expect(canManageTeam(role)).toBe(true);
      expect(canRecordPayments(role)).toBe(true);
      expect(canViewFinancialReports(role)).toBe(true);
      expect(isTechnician(role)).toBe(false);
    });

    it("enforces dispatcher permissions: can dispatch jobs but cannot record financial payments or manage owners", () => {
      const role: UserRole = "dispatcher";
      expect(isOwner(role)).toBe(false);
      expect(isAdminOrOwner(role)).toBe(false);
      expect(canManageTeam(role)).toBe(false);
      expect(canManageJobs(role)).toBe(true);
      expect(canManageCustomers(role)).toBe(true);
      expect(canRecordPayments(role)).toBe(false);
      expect(canViewFinancialReports(role)).toBe(false);
    });

    it("enforces technician permissions: restricted strictly to job execution and not financial actions", () => {
      const role: UserRole = "technician";
      expect(isTechnician(role)).toBe(true);
      expect(isOwner(role)).toBe(false);
      expect(canManageTeam(role)).toBe(false);
      expect(canManageQuotes(role)).toBe(false);
      expect(canManageInvoices(role)).toBe(false);
      expect(canRecordPayments(role)).toBe(false);
      expect(canViewFinancialReports(role)).toBe(false);
    });

    it("enforces finance role: can manage quotes, invoices, and payments but cannot manage technicians", () => {
      const role: UserRole = "finance";
      expect(isOwner(role)).toBe(false);
      expect(canManageTeam(role)).toBe(false);
      expect(canManageQuotes(role)).toBe(true);
      expect(canManageInvoices(role)).toBe(true);
      expect(canRecordPayments(role)).toBe(true);
      expect(canViewFinancialReports(role)).toBe(true);
      expect(canManageJobs(role)).toBe(false);
    });

    it("renders proper UI badge variants for each role", () => {
      expect(getRoleBadgeVariant("owner").label).toBe("Owner");
      expect(getRoleBadgeVariant("technician").label).toBe("Technician");
      expect(getRoleBadgeVariant("finance").label).toBe("Finance");
      expect(getRoleBadgeVariant("dispatcher").label).toBe("Dispatcher");
      expect(getRoleBadgeVariant("admin").label).toBe("Admin");
    });
  });
});
