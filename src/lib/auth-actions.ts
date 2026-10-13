"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import {
  loginSchema,
  registerSchema,
  onboardingSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/schemas/auth";

export interface AuthActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  message?: string;
}

function extractFieldErrors(parsedError: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  const issues = parsedError.issues ?? [];
  for (const err of issues) {
    const field = err.path[0]?.toString();
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = err.message;
    }
  }
  return fieldErrors;
}

/**
 * Handle user login
 */
export async function loginAction(
  prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const rawData = {
    email: formData.get("email")?.toString() || "",
    password: formData.get("password")?.toString() || "",
  };
  const next = formData.get("next")?.toString() || "";

  const parsed = loginSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("invalid login credentials")) {
      return { error: "Invalid email or password. Please try again." };
    }
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        error:
          "Your email address has not been confirmed yet. Please check your inbox.",
      };
    }
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Unable to sign in. Please try again." };
  }

  // Check organization membership
  const { data: membershipData } = await supabase.rpc(
    "get_user_membership_details"
  );

  let redirectUrl = "/app/dashboard";
  if (!membershipData || membershipData.length === 0) {
    redirectUrl = "/onboarding";
  } else if (membershipData[0].role === "technician") {
    redirectUrl = "/tech/jobs";
  } else if (next && (next.startsWith("/app") || next.startsWith("/tech"))) {
    redirectUrl = next;
  }

  redirect(redirectUrl);
}

/**
 * Handle new user sign-up
 */
export async function registerAction(
  prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const rawData = {
    fullName: formData.get("fullName")?.toString() || "",
    email: formData.get("email")?.toString() || "",
    phone: formData.get("phone")?.toString() || "",
    password: formData.get("password")?.toString() || "",
  };

  const parsed = registerSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  const headerList = await headers();
  const host = headerList.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const origin = `${protocol}://${host}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
      data: {
        full_name: parsed.data.fullName,
        phone: parsed.data.phone,
      },
    },
  });

  if (error) {
    if (
      error.message.toLowerCase().includes("already registered") ||
      error.message.toLowerCase().includes("unique constraint")
    ) {
      return {
        error: "An account with this email already exists. Please log in instead.",
      };
    }
    return { error: error.message };
  }

  // If session is immediately available (e.g. email confirmations disabled or auto-confirmed)
  if (data.session) {
    redirect("/onboarding");
  }

  // If email confirmation is required by Supabase settings
  return {
    success: true,
    message:
      "Registration successful! Please check your email inbox to verify your account before logging in.",
  };
}

/**
 * Handle business onboarding (Creating first organization)
 */
export async function onboardingAction(
  prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const rawData = {
    companyName: formData.get("companyName")?.toString() || "",
    slug: formData.get("slug")?.toString() || "",
    contactPhone: formData.get("contactPhone")?.toString() || "",
    city: formData.get("city")?.toString() || "Dhaka",
    address: formData.get("address")?.toString() || "",
  };

  const parsed = onboardingSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: newOrgId, error } = await supabase.rpc(
    "create_organization_with_owner",
    {
      org_name: parsed.data.companyName,
      org_slug: parsed.data.slug,
      contact_phone: parsed.data.contactPhone,
      city: parsed.data.city,
      address: parsed.data.address || null,
      currency: "BDT",
      timezone: "Asia/Dhaka",
    }
  );

  if (error) {
    return { error: error.message || "Failed to create business. Please try again." };
  }

  if (!newOrgId) {
    return { error: "Organization setup failed. Please try again." };
  }

  redirect("/app/dashboard");
}

/**
 * Handle forgot password request
 */
export async function forgotPasswordAction(
  prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const rawData = {
    email: formData.get("email")?.toString() || "",
  };

  const parsed = forgotPasswordSchema.safeParse(rawData);
  if (!parsed.success) {
    const issues = parsed.error.issues ?? [];
    return {
      error: issues[0]?.message || "Invalid email address",
    };
  }

  const headerList = await headers();
  const host = headerList.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const origin = `${protocol}://${host}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    if (error.message.toLowerCase().includes("rate limit")) {
      return { error: "Too many reset attempts. Please wait a few minutes." };
    }
  }

  return {
    success: true,
    message:
      "If an account exists with this email address, a password reset link has been sent.",
  };
}

/**
 * Handle password update from reset link
 */
export async function resetPasswordAction(
  prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const rawData = {
    password: formData.get("password")?.toString() || "",
    confirmPassword: formData.get("confirmPassword")?.toString() || "",
  };

  const parsed = resetPasswordSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      error: "Please correct the errors below.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/app/dashboard?message=password_updated");
}

/**
 * Handle user sign-out
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
