import { z } from "zod";
import { isValidBDPhone } from "@/lib/formatters";

export const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
  email: z.string().trim().email("Please enter a valid email address"),
  phone: z
    .string()
    .trim()
    .refine((val) => isValidBDPhone(val), {
      message: "Please enter a valid Bangladesh mobile number (e.g. 01712345678)",
    }),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const onboardingSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(3, "Company name must be at least 3 characters"),
  slug: z
    .string()
    .trim()
    .min(3, "Company slug must be at least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  contactPhone: z
    .string()
    .trim()
    .refine((val) => isValidBDPhone(val), {
      message: "Please enter a valid Bangladesh contact number",
    }),
  city: z.string().trim().default("Dhaka"),
  address: z.string().trim().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
