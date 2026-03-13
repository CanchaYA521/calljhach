import { NextResponse, type NextRequest } from "next/server";

function getSupabaseAuthCookiePrefix() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

function hasSupabaseSession(request: NextRequest) {
  const authCookiePrefix = getSupabaseAuthCookiePrefix();

  if (!authCookiePrefix) {
    return false;
  }

  return request.cookies
    .getAll()
    .some(
      ({ name }) =>
        name === authCookiePrefix || name.startsWith(`${authCookiePrefix}.`),
    );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = hasSupabaseSession(request);
  const isDashboardPage = pathname.startsWith("/dashboard");
  const isLoginPage = pathname === "/login";
  const isHomePage = pathname === "/";

  if (!hasSession && isDashboardPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";

    return NextResponse.redirect(redirectUrl);
  }

  if (hasSession && (isHomePage || isLoginPage)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";

    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
