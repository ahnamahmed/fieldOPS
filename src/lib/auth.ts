import "server-only";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/permissions";

export interface UserProfile {
  id: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
}

export interface UserMembership {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: UserRole;
  status: string;
  currency: string;
  timezone: string;
}

export interface CurrentUserSession {
  user: {
    id: string;
    email: string | null;
  };
  profile: UserProfile;
  membership: UserMembership | null;
}

/**
 * Fetch current authenticated user, their profile, and active organization membership.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<CurrentUserSession | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // Fetch profile
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, full_name, phone, avatar_url")
    .eq("id", user.id)
    .single();

  const profile: UserProfile = {
    id: user.id,
    fullName:
      profileData?.full_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "User",
    phone: profileData?.phone || user.user_metadata?.phone || null,
    avatarUrl: profileData?.avatar_url || null,
  };

  // Fetch membership via secure helper RPC
  let membership: UserMembership | null = null;
  const { data: membershipData } = await supabase.rpc(
    "get_user_membership_details"
  );

  if (membershipData && membershipData.length > 0) {
    const raw = membershipData[0];
    membership = {
      organizationId: raw.organization_id,
      organizationName: raw.organization_name,
      organizationSlug: raw.organization_slug,
      role: raw.role as UserRole,
      status: raw.status,
      currency: raw.currency || "BDT",
      timezone: raw.timezone || "Asia/Dhaka",
    };
  }

  return {
    user: {
      id: user.id,
      email: user.email || null,
    },
    profile,
    membership,
  };
}

/**
 * Ensures user is authenticated. Redirects to /login if not.
 */
export async function requireUser(): Promise<CurrentUserSession> {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Ensures user is authenticated and has an active organization membership.
 * Redirects to /onboarding if user has no organization yet.
 * Optionally verifies role permissions.
 */
export async function requireMembership(
  allowedRoles?: UserRole[]
): Promise<CurrentUserSession & { membership: UserMembership }> {
  const session = await requireUser();

  if (!session.membership) {
    redirect("/onboarding");
  }

  if (allowedRoles && !allowedRoles.includes(session.membership.role)) {
    redirect("/app/dashboard?error=unauthorized");
  }

  return session as CurrentUserSession & { membership: UserMembership };
}
