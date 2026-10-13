import { describe, it, expect } from "vitest";
import {
  formatBDT,
  roundMoney,
  isValidBDPhone,
  normalizeBDPhone,
  formatBDPhoneDisplay,
} from "@/lib/formatters";

describe("Bangladesh Localization Formatters", () => {
  describe("formatBDT", () => {
    it("formats standard integer numbers to BDT with two decimals", () => {
      const result = formatBDT(15000);
      expect(result).toContain("15,000.00");
      expect(result).toContain("৳");
    });

    it("formats zero amount accurately", () => {
      const result = formatBDT(0);
      expect(result).toBe("৳0.00");
    });

    it("handles decimal strings correctly", () => {
      const result = formatBDT("4550.50");
      expect(result).toContain("4,550.50");
      expect(result).toContain("৳");
    });

    it("gracefully handles null or invalid inputs", () => {
      expect(formatBDT(null)).toBe("৳0.00");
      expect(formatBDT(undefined)).toBe("৳0.00");
      expect(formatBDT("not-a-number")).toBe("৳0.00");
    });
  });

  describe("roundMoney", () => {
    it("accurately prevents binary floating point anomalies", () => {
      // In JS binary float, 0.1 + 0.2 = 0.30000000000000004
      const sum = 0.1 + 0.2;
      expect(roundMoney(sum)).toBe(0.3);
    });

    it("correctly rounds halves up", () => {
      expect(roundMoney(10.555)).toBe(10.56);
      expect(roundMoney(10.554)).toBe(10.55);
    });
  });

  describe("Bangladesh Phone Number Validation", () => {
    it("validates standard 11-digit local mobile numbers", () => {
      expect(isValidBDPhone("01712345678")).toBe(true); // Grameenphone
      expect(isValidBDPhone("01812345678")).toBe(true); // Robi
      expect(isValidBDPhone("01912345678")).toBe(true); // Banglalink
      expect(isValidBDPhone("01512345678")).toBe(true); // Teletalk
      expect(isValidBDPhone("01312345678")).toBe(true); // GP secondary
      expect(isValidBDPhone("01412345678")).toBe(true); // BL secondary
      expect(isValidBDPhone("01612345678")).toBe(true); // Airtel
    });

    it("validates international prefix formats", () => {
      expect(isValidBDPhone("+8801712345678")).toBe(true);
      expect(isValidBDPhone("8801712345678")).toBe(true);
      expect(isValidBDPhone("+880 1712-345678")).toBe(true);
    });

    it("rejects invalid mobile numbers", () => {
      expect(isValidBDPhone("01212345678")).toBe(false); // Invalid operator prefix 012
      expect(isValidBDPhone("0171234567")).toBe(false); // Too short (10 digits)
      expect(isValidBDPhone("017123456789")).toBe(false); // Too long (12 digits)
      expect(isValidBDPhone("abcdefghijk")).toBe(false);
      expect(isValidBDPhone("")).toBe(false);
    });

    it("normalizes to standard E.164 +880 format", () => {
      expect(normalizeBDPhone("01712345678")).toBe("+8801712345678");
      expect(normalizeBDPhone("+880 1712-345678")).toBe("+8801712345678");
    });

    it("formats for human readability", () => {
      expect(formatBDPhoneDisplay("01712345678")).toBe("+880 1712-345678");
    });
  });
});
