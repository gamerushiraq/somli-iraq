const SUPABASE_URL = "https://vpducjdkjrbxeosdxvdi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_K9GLIlPYh55utqPq77pgwA_hp3QQYDf";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let products = [];

let activeCategory = "";
let toastTimer;
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const formatPrice = n => new Intl.NumberFormat("ar-IQ").format(n) + " د.ع";

function showToast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3300);
}
function openDialog(id) { const d = document.getElementById(id); if (d?.showModal) d.showModal(); }
function closeDialog(id) { document.getElementById(id)?.close(); }

function renderProducts() {
  const query = $("#searchInput").value.trim().toLocaleLowerCase("ar");
  const gov = $("#governorateFilter").value;
  const filtered = products.filter(p => {
    const matchesText = !query || `${p.title} ${p.shop} ${p.category} ${p.governorate}`.toLocaleLowerCase("ar").includes(query);
    const matchesCategory = !activeCategory || p.category === activeCategory;
    const matchesGov = !gov || p.governorate === gov;
    return matchesText && matchesCategory && matchesGov;
  });
  $("#productGrid").innerHTML = filtered.map(p => `
    <article class="product-tile">
      <div class="tile-art">${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">` : `<span class="tile-category">${escapeHtml(p.category)}</span><span>الصورة غير متوفرة</span>`}</div>
      <div class="tile-body">
        <h3>${escapeHtml(p.title)}</h3>
        <div class="tile-shop">${escapeHtml(p.shop)} <span>·</span> ${escapeHtml(p.governorate)}</div>
        <div class="tile-price-row"><strong class="tile-price">${p.price == null ? "السعر عند الطلب" : formatPrice(p.price)}</strong><span class="tile-location">منتج معتمد</span></div>
        <div class="tile-footer"><span>من محل معتمد</span><button data-ask="${p.id}">اطلب سعر مشابه</button></div>
      </div>
    </article>`).join("");
  $("#emptyState").classList.toggle("hidden", filtered.length > 0);
}
async function loadProducts() {
  $("#productGrid").innerHTML = "<p>دا نحمل المنتجات...</p>";
  const { data, error } = await supabaseClient
    .from("products")
    .select("id,name,description,price_iqd,governorate,category_id,shops(name,status),categories(name_ar),product_images(image_url,sort_order)")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) {
    $("#productGrid").innerHTML = "";
    showToast("تعذر تحميل المنتجات. تأكد من إعدادات Supabase والصلاحيات.");
    console.error("Somli product load error:", error.message);
    products = [];
    renderProducts();
    return;
  }
  products = (data || []).filter(p => p.shops && p.shops.status === "approved").map(p => ({
    id: p.id,
    title: p.name,
    category: p.categories?.name_ar || "أخرى",
    price: p.price_iqd,
    shop: p.shops?.name || "محل",
    governorate: p.governorate,
    image: (p.product_images || []).sort((a,b) => a.sort_order - b.sort_order)[0]?.image_url || "",
    description: p.description || ""
  }));
  renderProducts();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function openRequest(prefill) {
  const form = $("#requestForm");
  form.reset();
  if (prefill) {
    form.elements.title.value = prefill.title || "";
    const category = [...form.elements.category.options].find(o => o.value === prefill.category || o.text === prefill.category);
    if (category) form.elements.category.value = category.value;
  }
  openDialog("requestDialog");
}
["openRequestTop","openRequestHero","openRequestSection","openRequestBanner","emptyRequest"].forEach(id => document.getElementById(id).addEventListener("click", () => openRequest()));
$("#sellerBtn").addEventListener("click", () => openDialog("sellerDialog"));
$$("[data-close]").forEach(btn => btn.addEventListener("click", () => closeDialog(btn.dataset.close)));
["requestDialog","sellerDialog"].forEach(id => document.getElementById(id).addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.close();
}));
$("#categories").addEventListener("click", e => {
  const btn = e.target.closest("[data-category]");
  if (!btn) return;
  activeCategory = btn.dataset.category;
  $$(".category").forEach(el => el.classList.toggle("selected", el === btn));
  renderProducts();
  $("#offers").scrollIntoView({behavior:"smooth",block:"start"});
});
$("#allCategories").addEventListener("click", () => {
  activeCategory = "";
  $$(".category").forEach(el => el.classList.toggle("selected", el.dataset.category === ""));
  renderProducts();
});
$("#searchBtn").addEventListener("click", renderProducts);
$("#searchInput").addEventListener("input", renderProducts);
$("#governorateFilter").addEventListener("change", renderProducts);
$("#clearSearch").addEventListener("click", () => { $("#searchInput").value = ""; renderProducts(); });
$("#productGrid").addEventListener("click", e => {
  const btn = e.target.closest("[data-ask]");
  if (!btn) return;
  const p = products.find(x => x.id === btn.dataset.ask);
  openRequest(p);
});
$("#requestForm").addEventListener("submit", e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget).entries());
  showToast("إرسال طلب السعر يحتاج تسجيل دخول؛ ربط الطلبات الفعلي هو الخطوة التالية.");
  closeDialog("requestDialog");
});
$("#sellerForm").addEventListener("submit", e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget).entries());
  closeDialog("sellerDialog");
  showToast("تسجيل المحلات الفعلي قيد الإعداد؛ لم يتم حفظ البيانات.");
});
$("#year").textContent = new Date().getFullYear();
loadProducts();
