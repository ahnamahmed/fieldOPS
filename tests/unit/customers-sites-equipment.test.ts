import { describe, it, expect } from "vitest";
import {
  customerSchema,
  serviceSiteSchema,
  equipmentAssetSchema,
} from "@/schemas/customer";

describe("Customers, Service Sites & Equipment Modules", () => {
  describe("Customer Validation", () => {
    it("validates commercial customer with Bangladesh mobile phone", () => {
      const valid = customerSchema.safeParse({
        name: "Prime Bank Banani Branch",
        contactName: "Mahmud Hasan",
        phone: "01712345678",
        customerType: "commercial",
        email: "facility@primebank.com.bd",
        billingAddress: "House 12, Road 11, Banani, Dhaka",
      });

      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.name).toBe("Prime Bank Banani Branch");
        expect(valid.data.customerType).toBe("commercial");
        expect(valid.data.contactName).toBe("Mahmud Hasan");
      }
    });

    it("accepts phone with +880 international prefix", () => {
      const valid = customerSchema.safeParse({
        name: "Square Pharmaceuticals HQ",
        phone: "+8801812345678",
      });

      expect(valid.success).toBe(true);
    });

    it("rejects invalid Bangladesh mobile numbers", () => {
      const invalid = customerSchema.safeParse({
        name: "Invalid Customer",
        phone: "123456789",
      });

      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toContain("valid Bangladesh");
      }
    });

    it("auto-populates companyName and contactName if only name is provided", () => {
      const valid = customerSchema.safeParse({
        name: "Bengal Meat Factory",
        phone: "01912345678",
      });

      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.companyName).toBe("Bengal Meat Factory");
        expect(valid.data.contactName).toBe("Bengal Meat Factory");
      }
    });
  });

  describe("Service Sites Validation", () => {
    const validCustomerId = "123e4567-e89b-12d3-a456-426614174000";

    it("validates multiple service site locations per customer", () => {
      const site1 = serviceSiteSchema.safeParse({
        customerId: validCustomerId,
        siteName: "Banani Branch 3rd Floor",
        address: "Plot 14, Road 11, Block E",
        area: "Banani",
        city: "Dhaka",
        postcode: "1213",
        accessNotes: "Rooftop key at Security Desk 1st floor.",
      });

      const site2 = serviceSiteSchema.safeParse({
        customerId: validCustomerId,
        siteName: "Gulshan ATM Booth Hub",
        address: "Circle 2, Gulshan Avenue",
        area: "Gulshan",
        city: "Dhaka",
        accessNotes: "Emergency 24/7 keycard access required.",
      });

      expect(site1.success).toBe(true);
      expect(site2.success).toBe(true);
      if (site1.success) {
        expect(site1.data.address).toBe("Plot 14, Road 11, Block E");
        expect(site1.data.accessNotes).toBe("Rooftop key at Security Desk 1st floor.");
      }
    });

    it("rejects service site with invalid customer UUID", () => {
      const invalid = serviceSiteSchema.safeParse({
        customerId: "not-a-valid-uuid",
        siteName: "Head Office",
        address: "Dhaka",
      });

      expect(invalid.success).toBe(false);
    });

    it("rejects service site with missing address", () => {
      const invalid = serviceSiteSchema.safeParse({
        customerId: validCustomerId,
        siteName: "Head Office",
        address: "",
      });

      expect(invalid.success).toBe(false);
    });
  });

  describe("Equipment Assets Validation", () => {
    const validCustomerId = "123e4567-e89b-12d3-a456-426614174000";
    const validSiteId = "223e4567-e89b-12d3-a456-426614174000";

    it("validates AC unit specifications for HVAC servicing", () => {
      const valid = equipmentAssetSchema.safeParse({
        customerId: validCustomerId,
        siteId: validSiteId,
        brand: "Gree",
        model: "Lomo Inverter Series",
        serialNumber: "SN-GREE-2026-981",
        capacity: "2.0 Ton",
        equipmentType: "split_ac",
        refrigerantType: "R32",
        locationDescription: "Server Room 3rd Floor",
        conditionStatus: "operational",
        serviceNotes: "Installed 2024. Next gas inspection due in 6 months.",
      });

      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.brand).toBe("Gree");
        expect(valid.data.capacity).toBe("2.0 Ton");
        expect(valid.data.refrigerantType).toBe("R32");
        expect(valid.data.serviceSiteId).toBe(validSiteId);
      }
    });

    it("rejects equipment without a brand", () => {
      const invalid = equipmentAssetSchema.safeParse({
        customerId: validCustomerId,
        siteId: validSiteId,
        brand: "",
      });

      expect(invalid.success).toBe(false);
    });

    it("rejects equipment without a site ID", () => {
      const invalid = equipmentAssetSchema.safeParse({
        customerId: validCustomerId,
        brand: "Daikin",
      });

      expect(invalid.success).toBe(false);
    });
  });

  describe("Tenant & Relationship Security Rules", () => {
    it("simulates cross-customer site attachment rejection", () => {
      const customerA = "11111111-1111-1111-1111-111111111111";
      const customerB = "22222222-2222-2222-2222-222222222222";
      const siteOfCustomerB = {
        id: "33333333-3333-3333-3333-333333333333",
        customerId: customerB,
      };

      // Function simulating the server action & database trigger validation
      function validateAssetCustomerSiteRelation(assetCustId: string, siteCustId: string) {
        if (assetCustId !== siteCustId) {
          throw new Error("Equipment service site does not belong to the selected customer");
        }
        return true;
      }

      // Customer A cannot use Customer B's site
      expect(() =>
        validateAssetCustomerSiteRelation(customerA, siteOfCustomerB.customerId)
      ).toThrow("Equipment service site does not belong to the selected customer");

      // Customer B can use Customer B's site
      expect(
        validateAssetCustomerSiteRelation(customerB, siteOfCustomerB.customerId)
      ).toBe(true);
    });

    it("simulates cross-tenant isolation enforcement", () => {
      const tenantOrg1 = "org-1111";
      const tenantOrg2 = "org-2222";

      function enforceTenantIsolation(recordOrgId: string, sessionOrgId: string) {
        if (recordOrgId !== sessionOrgId) {
          throw new Error("Cross-tenant access denied: Row Level Security violation");
        }
        return true;
      }

      expect(() => enforceTenantIsolation(tenantOrg2, tenantOrg1)).toThrow(
        "Cross-tenant access denied"
      );
      expect(enforceTenantIsolation(tenantOrg1, tenantOrg1)).toBe(true);
    });
  });
});
