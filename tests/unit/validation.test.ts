import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema, onboardingSchema } from "@/schemas/auth";
import { customerSchema, serviceSiteSchema } from "@/schemas/customer";
import { paymentSchema, lineItemSchema } from "@/schemas/billing";

describe("Zod Validation Schemas", () => {
  describe("Authentication Schemas", () => {
    it("validates correct login credentials", () => {
      const valid = loginSchema.safeParse({
        email: "owner@cooltech.com",
        password: "password123",
      });
      expect(valid.success).toBe(true);
    });

    it("rejects invalid login emails and short passwords", () => {
      const invalidEmail = loginSchema.safeParse({
        email: "not-an-email",
        password: "password123",
      });
      expect(invalidEmail.success).toBe(false);

      const shortPassword = loginSchema.safeParse({
        email: "owner@cooltech.com",
        password: "123",
      });
      expect(shortPassword.success).toBe(false);
    });

    it("validates registration with Bangladesh mobile number", () => {
      const valid = registerSchema.safeParse({
        fullName: "Rezaul Karim",
        email: "reza@cooltech.com",
        phone: "01712345678",
        password: "securepassword",
      });
      expect(valid.success).toBe(true);
    });

    it("validates company onboarding input", () => {
      const valid = onboardingSchema.safeParse({
        companyName: "CoolTech Solutions BD",
        slug: "cooltech-bd",
        contactPhone: "01812345678",
        city: "Dhaka",
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("Customer & Site Schemas", () => {
    it("validates customer data with BD phone", () => {
      const valid = customerSchema.safeParse({
        customerType: "commercial",
        companyName: "Prime Bank Banani",
        contactName: "Mahmud Hasan",
        phone: "01912345678",
      });
      expect(valid.success).toBe(true);
    });

    it("validates service site with landmark", () => {
      const valid = serviceSiteSchema.safeParse({
        customerId: "123e4567-e89b-12d3-a456-426614174000",
        siteName: "Banani Branch 3rd Floor",
        addressLine1: "House 12, Road 11, Block D",
        area: "Banani",
        landmark: "Near Star Kabab",
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("Billing & Payment Schemas", () => {
    it("validates line item price and quantity", () => {
      const valid = lineItemSchema.safeParse({
        description: "1.5 Ton Master Service & Jet Wash",
        quantity: 2,
        unitPrice: 2500,
      });
      expect(valid.success).toBe(true);

      const invalidQty = lineItemSchema.safeParse({
        description: "Item",
        quantity: 0,
        unitPrice: 100,
      });
      expect(invalidQty.success).toBe(false);
    });

    it("validates manual payment with bKash TrxID", () => {
      const valid = paymentSchema.safeParse({
        invoiceId: "123e4567-e89b-12d3-a456-426614174000",
        amount: 5000,
        paymentMethod: "bkash",
        paymentDate: "2026-10-12",
        transactionReference: "9J72KLA98P",
      });
      expect(valid.success).toBe(true);
    });
  });
});
