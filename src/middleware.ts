import { NextResponse, type NextRequest } from "next/server";

// Sirf cookie ki maujoodgi check — asli verification server pages / APIs me hoti hai
export function middleware(req: NextRequest) {
  if (!req.cookies.get("crm_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/crm/:path*"] };
