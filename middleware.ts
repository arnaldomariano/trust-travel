import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("access")?.value;

  const { pathname } = request.nextUrl;

  // rotas públicas
  const publicRoutes = ["/login", "/register"];

  const isPublic = publicRoutes.includes(pathname);

  // 🚫 não logado tentando acessar rota protegida
  if (!token && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 🔁 logado tentando acessar login → manda pra home
  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/create"],
};