// BubaPix "community" Edge Function (Supabase, Deno).
//
// The only way visitor content reaches the database. It validates input,
// limits how often one visitor can send, and stores everything as
// "pending" for the site owner to review. Nothing is published here.
//
// POST { action: "submit", kind, lang, name, message, email?, project?, publicOk?, website, elapsed }
// POST { action: "rate", project, stars }
//
// IP addresses are never stored: only a keyed hash (HMAC-SHA-256) is kept,
// to limit floods and to allow one rating per project per visitor.
// Secrets come from the function's environment, never from the site.
//
// New message → a short email to the studio (Resend), only when the secret
// RESEND_API_KEY is set. The email says only the kind and the project, with
// a link to the review page: the visitor's name, text and email are never
// sent to the email service. A failed email never fails the visitor's send.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ALLOWED_ORIGINS = [
  "https://moshiko259-maker.github.io",
  "https://bubapix.com",
  "https://www.bubapix.com",
  "https://raw.githack.com", // read-only previews of the redesign branch
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Notification email. Resend's free test sender can only write to the email
// address of the Resend account itself, which is the studio's address.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const NOTIFY_TO = Deno.env.get("NOTIFY_EMAIL") ?? "bubapix369@gmail.com";
const RESEND_ENDPOINT = Deno.env.get("RESEND_ENDPOINT") ?? "https://api.resend.com/emails";
const NOTIFY_FROM = Deno.env.get("NOTIFY_FROM") ?? "BubaPix <onboarding@resend.dev>";
const REVIEW_URL = Deno.env.get("REVIEW_URL") ?? "https://moshiko259-maker.github.io/bubapix-preview/admin/community/index.html";
// Hebrew wording with the right gender: "a new comment" etc.
const KIND_HE: Record<string, string> = { comment: "תגובה חדשה", question: "שאלה חדשה", idea: "רעיון חדש", consult: "התייעצות פרטית חדשה" };
const GOT_HE: Record<string, string> = { comment: "התקבלה", question: "התקבלה", idea: "התקבל", consult: "התקבלה" };

const KINDS = ["comment", "question", "idea", "consult"];
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function reply(origin: string | null, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// Removes control and direction-override characters, normalises line breaks
// and spacing. Returns null when the text is longer than allowed.
function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return "";
  const s = value
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s.length > max ? null : s;
}

async function keyedHash(text: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

async function countSince(column: string, value: string, minutes: number): Promise<number> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { count, error } = await db.from("submissions").select("id", { count: "exact", head: true })
    .eq(column, value).gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

// Sends the short notification. Never throws; never includes visitor text.
async function notify(kind: string, project: string | null, lang: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  const what = KIND_HE[kind] ?? kind;
  const where = project ? ` — ${project}` : "";
  const text = [
    `${GOT_HE[kind] ?? "התקבלה"} ${what} באתר${where}.`,
    `שפת הדף: ${lang === "he" ? "עברית" : "אנגלית"}.`,
    "",
    "הפרטים שמורים בשירות התגובות. כדי לקרוא ולענות:",
    REVIEW_URL,
    "",
    "(מייל אוטומטי מהאתר. פרטי השולח לא נכללים בו בכוונה.)",
  ].join("\n");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: NOTIFY_FROM, to: [NOTIFY_TO], subject: `BubaPix: ${what}${where}`, text }),
      signal: ctrl.signal,
    });
    if (!res.ok) console.error("notify failed", res.status, (await res.text()).slice(0, 300));
  } catch (err) {
    console.error("notify error", String(err));
  } finally {
    clearTimeout(timer);
  }
}

// Runs a task after the reply is sent, when the platform allows it.
function inBackground(task: Promise<void>): void {
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt && typeof rt.waitUntil === "function") rt.waitUntil(task);
}

async function handleSubmit(p: Record<string, unknown>, ipHash: string, origin: string | null): Promise<Response> {
  // Honeypot: a hidden field people never fill. Bots are told "ok" and ignored.
  if (typeof p.website === "string" && p.website.trim() !== "") return reply(origin, 200, { ok: true, status: "pending" });
  // Forms filled in under 2.5 seconds are almost always automated.
  if (typeof p.elapsed !== "number" || p.elapsed < 2500) return reply(origin, 400, { ok: false, error: "too_fast" });

  const kind = String(p.kind ?? "");
  if (!KINDS.includes(kind)) return reply(origin, 400, { ok: false, error: "invalid" });
  const lang = p.lang === "he" ? "he" : "en";
  const name = clean(p.name, 60);
  const message = clean(p.message, 2000);
  const email = clean(p.email, 254);
  if (name === null || message === null || email === null) return reply(origin, 400, { ok: false, error: "too_long" });
  if (!name || message.length < 2) return reply(origin, 400, { ok: false, error: "missing" });
  if (email && !EMAIL.test(email)) return reply(origin, 400, { ok: false, error: "email" });
  if (kind === "consult" && !email) return reply(origin, 400, { ok: false, error: "email_required" });
  const links = (message.match(/https?:\/\/|www\./gi) ?? []).length;
  if (links > 2) return reply(origin, 400, { ok: false, error: "links" });

  let project: string | null = null;
  if (kind === "comment" || kind === "question") {
    project = String(p.project ?? "");
    if (!SLUG.test(project)) return reply(origin, 400, { ok: false, error: "invalid" });
  }

  // Flood protection: per visitor, and a ceiling for the whole site.
  if ((await countSince("ip_hash", ipHash, 10)) >= 3) return reply(origin, 429, { ok: false, error: "rate_limited" });
  if ((await countSince("ip_hash", ipHash, 24 * 60)) >= 15) return reply(origin, 429, { ok: false, error: "rate_limited" });
  if ((await countSince("status", "pending", 60)) >= 200) return reply(origin, 503, { ok: false, error: "busy" });

  const { data, error } = await db.from("submissions").insert({
    kind, lang, project_slug: project, display_name: name, body: message,
    public_ok: kind === "idea" ? p.publicOk === true : false,
    status: "pending", ip_hash: ipHash,
  }).select("id").single();
  if (error) throw error;
  if (email) {
    const { error: e2 } = await db.from("submission_contacts").insert({ submission_id: data.id, email: email.toLowerCase() });
    if (e2) throw e2;
  }
  inBackground(notify(kind, project, lang));
  return reply(origin, 200, { ok: true, status: "pending" });
}

async function handleRate(p: Record<string, unknown>, ip: string, origin: string | null): Promise<Response> {
  const project = String(p.project ?? "");
  const stars = Number(p.stars);
  if (!SLUG.test(project) || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return reply(origin, 400, { ok: false, error: "invalid" });
  }
  const voter = await keyedHash(`rate|${project}|${ip}`);
  const { error } = await db.from("ratings").insert({ project_slug: project, stars, voter_hash: voter });
  if (error && error.code === "23505") return reply(origin, 409, { ok: false, error: "already_rated" });
  if (error) throw error;
  const { data: summary, error: e2 } = await db.rpc("rating_summary", { p_slug: project });
  if (e2) throw e2;
  return reply(origin, 200, { ok: true, summary });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return reply(origin, 405, { ok: false, error: "method" });
  // Browsers always send Origin on cross-site POSTs; refuse other sites.
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return reply(origin, 403, { ok: false, error: "origin" });

  try {
    const raw = await req.text();
    if (raw.length > 10_000) return reply(origin, 413, { ok: false, error: "too_long" });
    let p: Record<string, unknown>;
    try { p = JSON.parse(raw); } catch { return reply(origin, 400, { ok: false, error: "invalid" }); }
    if (!p || typeof p !== "object") return reply(origin, 400, { ok: false, error: "invalid" });

    const ip = clientIp(req);
    if (p.action === "submit") return await handleSubmit(p, await keyedHash(`ip|${ip}`), origin);
    if (p.action === "rate") return await handleRate(p, ip, origin);
    return reply(origin, 400, { ok: false, error: "invalid" });
  } catch (err) {
    console.error("community function error", err);
    return reply(origin, 500, { ok: false, error: "server" });
  }
});
