import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = ["/login", "/signup", "/auth/callback", "/forgot-password", "/reset-password", "/invite"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  // Single Supabase client that both refreshes the session and does auth checks
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Single getUser() call — refreshes session + gives us the user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in → send to login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // Role is stored in JWT app_metadata — no DB query needed
    const role: string = (user.app_metadata?.role as string) ?? "student";

    // Logged in → redirect away from auth pages or root to role dashboard
    if ((isPublic && pathname !== "/auth/callback" && pathname !== "/reset-password") || pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname =
        role === "admin" ? "/admin" : role === "ci" ? "/ci" : "/student";
      return NextResponse.redirect(url);
    }

    // Role-based route guards
    const isAdminRoute = pathname.startsWith("/admin");
    const isCiRoute = pathname.startsWith("/ci");

    if (isAdminRoute && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = role === "ci" ? "/ci" : "/student";
      return NextResponse.redirect(url);
    }

    if (isCiRoute && role !== "ci" && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/student";
      return NextResponse.redirect(url);
    }

    // Enforce CI credential expiry — check DB only on CI routes
    if (role === "ci" && isCiRoute) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("ci_credentials_expire_at, is_active")
        .eq("id", user.id)
        .single();

      const expired =
        profile?.ci_credentials_expire_at &&
        new Date(profile.ci_credentials_expire_at) < new Date();

      if (expired || profile?.is_active === false) {
        // Sign out and send to login with an error message
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", expired ? "credentials_expired" : "account_inactive");
        return NextResponse.redirect(url);
      }
    }

    // Enforce is_active for students on protected routes
    if (role === "student" && !isPublic) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .single();

      if (profile?.is_active === false) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "account_inactive");
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
