import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: cors });
const suspicious = [
  /سلاح|مسدس|بندقية|مخدرات|حشيش|كوكايين|متفجرات|قنبلة|بيع\s*أعضاء|عملة\s*مزورة|بطاقة\s*مزورة|مسروق|تهكير\s*حسابات|بيانات\s*بطاقة|كلمات\s*مرور|ابتزاز|احتيال\s*مضمون/iu,
  /weapon|firearm|explosive|narcotic|cocaine|stolen goods|fake identity|credit card data|passwords for sale/iu,
];
function assess(item: Record<string, any>, type: string) {
  const reasons: string[] = [];
  let risk = 0;
  const title = String(item.title ?? item.name ?? "").trim();
  const description = String(item.description ?? "").trim();
  const text = title + " " + description;
  if (title.length < 3) { risk += 25; reasons.push("العنوان قصير أو ناقص"); }
  if (title.length > 120) { risk += 15; reasons.push("العنوان أطول من الحد المناسب"); }
  if (description.length > 2500) { risk += 15; reasons.push("الوصف طويل جداً"); }
  if (suspicious.some((re) => re.test(text))) { risk += 80; reasons.push("كلمات قد تشير إلى محتوى ممنوع؛ يلزم تحقق بشري"); }
  if (/https?:\/\//iu.test(text) || /www\./iu.test(text)) { risk += 20; reasons.push("يحتوي روابط خارجية تحتاج تحقق"); }
  if (/([!?.])\1{4,}|(.)\2{10,}/u.test(text)) { risk += 15; reasons.push("نمط نصي مكرر أو غير طبيعي"); }
  if (item.price_iqd != null && (!Number.isFinite(Number(item.price_iqd)) || Number(item.price_iqd) < 0)) { risk += 30; reasons.push("السعر غير صالح"); }
  if (item.price_iqd != null && Number(item.price_iqd) > 100000000) { risk += 20; reasons.push("السعر مرتفع جداً ويحتاج تحقق"); }
  if (type === "product" && item.shop_status !== "approved") { risk += 100; reasons.push("المحل غير معتمد"); }
  if (type === "market_listing" && (!item.phone || !item.governorate || !item.category)) { risk += 25; reasons.push("بيانات الإعلان الأساسية ناقصة"); }
  risk = Math.min(100, risk);
  return { risk, reasons, decision: risk <= 10 && reasons.length === 0 ? "auto_approved" : "needs_review" };
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json(500, { error: "server_configuration_missing" });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "authentication_required" });
  const authClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return json(401, { error: "invalid_session" });
  let body: { entityType?: string; entityId?: string };
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
  const type = body.entityType;
  const id = body.entityId;
  if (!["market_listing", "product", "seller_application"].includes(String(type)) || typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
    return json(400, { error: "unsupported_entity" });
  }
  const admin = createClient(url, service, { auth: { persistSession: false } });
  let item: Record<string, any> | null = null;
  let queryError: any = null;
  if (type === "market_listing") {
    const q = await admin.from("market_listings").select("id,seller_id,status,title,description,category,governorate,condition,price_iqd,phone,image_urls").eq("id", id).maybeSingle();
    item = q.data; queryError = q.error;
    if (item && item.seller_id !== authData.user.id) return json(403, { error: "not_owner" });
  } else if (type === "product") {
    const q = await admin.from("products").select("id,shop_id,name,description,status,price_iqd,governorate,shops!inner(owner_id,status)").eq("id", id).maybeSingle();
    queryError = q.error;
    if (q.data) {
      const shop = Array.isArray(q.data.shops) ? q.data.shops[0] : q.data.shops;
      if (!shop || shop.owner_id !== authData.user.id) return json(403, { error: "not_owner" });
      item = { ...q.data, shop_status: shop.status, title: q.data.name };
    }
  } else {
    const q = await admin.from("seller_applications").select("id,user_id,status,shop_name,governorate,category").eq("id", id).maybeSingle();
    item = q.data; queryError = q.error;
    if (item && item.user_id !== authData.user.id) return json(403, { error: "not_owner" });
  }
  if (queryError) return json(500, { error: "entity_lookup_failed" });
  if (!item) return json(404, { error: "entity_not_found" });
  if (item.status !== "pending") return json(409, { error: "entity_not_pending" });
  let result: { risk: number; reasons: string[]; decision: string };
  if (type === "seller_application") {
    result = { risk: 0, reasons: ["طلبات تسجيل البائع تتطلب تحققاً بشرياً من بيانات النشاط"], decision: "needs_review" };
  } else {
    result = assess(item, type!);
  }
  const { data: audit, error: applyError } = await admin.rpc("somli_moderation_apply", {
    p_entity_type: type,
    p_entity_id: id,
    p_decision: result.decision,
    p_requested_by: authData.user.id,
    p_risk_score: result.risk,
    p_reasons: result.reasons,
  });
  if (applyError) {
    console.error("moderation apply failed", applyError.message);
    return json(500, { error: "moderation_apply_failed" });
  }
  return json(200, { ok: true, ...result, audit });
});
