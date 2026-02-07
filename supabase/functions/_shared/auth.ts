import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AppRole = "super_admin" | "admin" | "responsible" | "employee" | "asesor";

export type UserCallerContext = {
  kind: "user";
  userId: string;
  roles: AppRole[];
  isAdminLike: boolean;
};

export type ServiceRoleCallerContext = {
  kind: "service_role";
};

export type CallerContext = UserCallerContext | ServiceRoleCallerContext;

export function jsonResponse(payload: unknown, status = 200, corsHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^\s*Bearer\s+(.+)\s*$/i);
    if (match?.[1]) return match[1].trim();
    return authHeader.trim();
  }

  // Some callers (including supabase-js without a user session) may send the API key only.
  const apiKey = req.headers.get("apikey") || req.headers.get("x-api-key");
  if (apiKey) return apiKey.trim();

  return null;
}

type RequireCallerContextArgs = {
  req: Request;
  supabaseAdmin: SupabaseClient;
  corsHeaders: Record<string, string>;
  allowServiceRole?: boolean;
};

export async function requireCallerContext(
  args: RequireCallerContextArgs,
): Promise<CallerContext | Response> {
  const { req, supabaseAdmin, corsHeaders, allowServiceRole = false } = args;

  const token = getBearerToken(req);
  if (!token) {
    return jsonResponse({ error: "Missing Authorization header" }, 401, corsHeaders);
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (allowServiceRole && serviceRoleKey && token === serviceRoleKey) {
    return { kind: "service_role" };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return jsonResponse({ error: "Unauthorized user" }, 401, corsHeaders);
  }

  const userId = authData.user.id;
  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (roleError) {
    console.error("[auth] failed to resolve roles:", roleError);
    return jsonResponse({ error: "Unable to resolve user roles" }, 500, corsHeaders);
  }

  const roles = (roleRows || []).map((row) => row.role as AppRole);
  const isAdminLike =
    roles.includes("super_admin") ||
    roles.includes("admin") ||
    roles.includes("responsible") ||
    roles.includes("asesor");

  return { kind: "user", userId, roles, isAdminLike };
}

type RequireAnyRoleArgs = {
  ctx: CallerContext;
  allowed: AppRole[];
  corsHeaders: Record<string, string>;
};

export function requireAnyRole(args: RequireAnyRoleArgs): Response | null {
  const { ctx, allowed, corsHeaders } = args;
  if (ctx.kind !== "user") {
    return jsonResponse({ error: "Unauthorized caller" }, 401, corsHeaders);
  }

  const ok = ctx.roles.some((role) => allowed.includes(role));
  if (ok) return null;

  return jsonResponse({ error: "Insufficient permissions" }, 403, corsHeaders);
}

type RequireCompanyAccessArgs = {
  supabaseAdmin: SupabaseClient;
  ctx: CallerContext;
  companyId: string;
  corsHeaders: Record<string, string>;
  allowEmployee?: boolean;
};

export async function requireCompanyAccess(
  args: RequireCompanyAccessArgs,
): Promise<{ companyId: string; employeeId: string | null } | Response> {
  const { supabaseAdmin, ctx, companyId, corsHeaders, allowEmployee = false } = args;

  if (!companyId) {
    return jsonResponse({ error: "company_id is required" }, 400, corsHeaders);
  }

  if (ctx.kind !== "user") {
    return { companyId, employeeId: null };
  }

  // Super admin is global by policy.
  if (ctx.roles.includes("super_admin")) {
    return { companyId, employeeId: null };
  }

  const employeeLink = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (employeeLink.error) {
    console.error("[auth] employee-company lookup failed:", employeeLink.error);
    return jsonResponse({ error: "Unable to validate company access" }, 500, corsHeaders);
  }

  const employeeId = employeeLink.data?.id ?? null;

  const companyLink = await supabaseAdmin
    .from("user_company")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (companyLink.error) {
    console.error("[auth] user-company lookup failed:", companyLink.error);
    return jsonResponse({ error: "Unable to validate company access" }, 500, corsHeaders);
  }

  if (!employeeId && !companyLink.data) {
    return jsonResponse({ error: "User not assigned to requested company" }, 403, corsHeaders);
  }

  // If the caller is only an employee, optionally block access when endpoints are admin-only.
  const isOnlyEmployee = ctx.roles.includes("employee") && !ctx.isAdminLike;
  if (isOnlyEmployee && !allowEmployee) {
    return jsonResponse({ error: "Insufficient permissions" }, 403, corsHeaders);
  }

  return { companyId, employeeId };
}

