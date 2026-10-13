import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // If Supabase environment is missing, allow request through with warning
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Revalidate auth session against Supabase Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password";

  const isProtectedAppRoute =
    pathname.startsWith("/app") ||
    pathname.startsWith("/tech") ||
    pathname === "/onboarding";

  // 1. Unauthenticated users accessing protected routes -> redirect to /login
  if (!user && isProtectedAppRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 2. Authenticated users: Check onboarding status
  if (user) {
    // Check if the user has an active business organization
    let hasOrganization = false;
    let userRole = "owner";

    try {
      const { data: membershipData } = await supabase.rpc(
        "get_user_membership_details"
      );
      if (membershipData && membershipData.length > 0) {
        hasOrganization = true;
        userRole = membershipData[0].role;
      }
    } catch {
      // In case of error querying membership, proceed cautiously
    }

    // Authenticated user accessing /login or /register -> redirect
    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      if (!hasOrganization) {
        url.pathname = "/onboarding";
      } else if (userRole === "technician") {
        url.pathname = "/tech/jobs";
      } else {
        url.pathname = "/app/dashboard";
      }
      return NextResponse.redirect(url);
    }

    // Authenticated user without an organization trying to access /app or /tech
    if (!hasOrganization && (pathname.startsWith("/app") || pathname.startsWith("/tech"))) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // Authenticated user with an organization trying to access /onboarding
    if (hasOrganization && pathname === "/onboarding") {
      const url = request.nextUrl.clone();
      if (userRole === "technician") {
        url.pathname = "/tech/jobs";
      } else {
        url.pathname = "/app/dashboard";
      }
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
