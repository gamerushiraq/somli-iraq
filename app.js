const demoProducts = [
  {id:"d1",title:"سماعات لاسلكية",category:"إلكترونيات",price:49000,shop:"عالم الصوت",governorate:"البصرة",emoji:"🎧",offers:3,condition:"جديد"},
  {id:"d2",title:"ساعة ذكية",category:"إلكترونيات",price:65000,shop:"تك ستور",governorate:"بغداد",emoji:"⌚",offers:2,condition:"جديد"},
  {id:"d3",title:"حذاء رياضي",category:"أزياء",price:35000,shop:"خطوة ستايل",governorate:"أربيل",emoji:"👟",offers:4,condition:"جديد"},
  {id:"d4",title:"كرسي مكتب مريح",category:"منزل",price:89000,shop:"بيت الراحة",governorate:"النجف",emoji:"🪑",offers:2,condition:"جديد"},
  {id:"d5",title:"شاحن سريع USB-C",category:"إلكترونيات",price:18000,shop:"موبايل زون",governorate:"البصرة",emoji:"🔌",offers:5,condition:"جديد"},
  {id:"d6",title:"مكنسة كهربائية",category:"أجهزة منزلية",price:125000,shop:"البيت الحديث",governorate:"بغداد",emoji:"🧹",offers:3,condition:"جديد"},
  {id:"d7",title:"مصابيح سيارة LED",category:"سيارات",price:27000,shop:"أوتو بلس",governorate:"ذي قار",emoji:"🚘",offers:2,condition:"جديد"},
  {id:"d8",title:"حقيبة يومية",category:"أزياء",price:42000,shop:"ستايلك",governorate:"كربلاء",emoji:"🎒",offers:3,condition:"جديد"},
  {id:"d9",title:"سلة مواد غذائية",category:"مواد غذائية",price:32000,shop:"سوق البيت",governorate:"البصرة",emoji:"🛒",offers:2,condition:"جديد"},
  {id:"d10",title:"يد تحكم للألعاب",category:"ألعاب",price:38000,shop:"قيمر زون",governorate:"بغداد",emoji:"🎮",offers:3,condition:"جديد"},
  {id:"d11",title:"كرة قدم تدريبية",category:"رياضة",price:22000,shop:"الملعب الرياضي",governorate:"النجف",emoji:"⚽",offers:2,condition:"جديد"},
  {id:"d12",title:"دفتر وأقلام",category:"كتب",price:9000,shop:"مكتبة القلم",governorate:"ذي قار",emoji:"📚",offers:4,condition:"جديد"},
  {id:"d13",title:"حقيبة مستلزمات طفل",category:"أطفال",price:28000,shop:"عالم الطفل",governorate:"أربيل",emoji:"🧸",offers:2,condition:"جديد"},
  {id:"d14",title:"عدة صيانة منزلية",category:"أدوات",price:44000,shop:"العدة الحديثة",governorate:"كربلاء",emoji:"🧰",offers:3,condition:"جديد"},
  {id:"d15",title:"مستلزمات قطط",category:"حيوانات",price:19000,shop:"بيت الحيوانات",governorate:"بغداد",emoji:"🐾",offers:2,condition:"جديد"},
  {id:"d16",title:"صيانة موبايل",category:"خدمات",price:15000,shop:"مركز الموبايل",governorate:"البصرة",emoji:"🛠️",offers:2,condition:"حسب الخدمة"}
];
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
  const filtered = demoProducts.filter(p => {
    const matchesText = !query || `${p.title} ${p.shop} ${p.category} ${p.governorate}`.toLocaleLowerCase("ar").includes(query);
    const matchesCategory = !activeCategory || p.category === activeCategory;
    const matchesGov = !gov || p.governorate === gov;
    return matchesText && matchesCategory && matchesGov;
  });
  $("#productGrid").innerHTML = filtered.map(p => `
    <article class="product-tile">
      <div class="tile-art"><span class="tile-category">${p.category}</span><span aria-hidden="true">${p.emoji}</span></div>
      <div class="tile-body">
        <h3>${escapeHtml(p.title)}</h3>
        <div class="tile-shop"><span class="verified">✓</span>${escapeHtml(p.shop)} <span>·</span> ${escapeHtml(p.governorate)}</div>
        <div class="tile-price-row"><strong class="tile-price">${formatPrice(p.price)}</strong><span class="tile-location">مثال تجريبي</span></div>
        <div class="tile-footer"><span>${p.offers} عروض نموذجية</span><button data-ask="${p.id}">اطلب سعر مشابه</button></div>
      </div>
    </article>`).join("");
  $("#emptyState").classList.toggle("hidden", filtered.length > 0);
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
  const p = demoProducts.find(x => x.id === btn.dataset.ask);
  openRequest(p);
});
$("#requestForm").addEventListener("submit", e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget).entries());
  const requests = JSON.parse(localStorage.getItem("soumli_demo_requests") || "[]");
  requests.push({...data, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), createdAt:new Date().toISOString()});
  localStorage.setItem("soumli_demo_requests", JSON.stringify(requests));
  closeDialog("requestDialog");
  showToast("انحفظ طلبك على هذا الجهاز فقط. ربط الإرسال للمحلات راح يجي بالمرحلة التالية.");
});
$("#sellerForm").addEventListener("submit", e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget).entries());
  const leads = JSON.parse(localStorage.getItem("soumli_demo_sellers") || "[]");
  leads.push({...data, createdAt:new Date().toISOString()});
  localStorage.setItem("soumli_demo_sellers", JSON.stringify(leads));
  closeDialog("sellerDialog");
  showToast("انحفظ اهتمامك محلياً على هذا الجهاز فقط. التسجيل الفعلي غير مفعّل بعد.");
});
$("#year").textContent = new Date().getFullYear();
renderProducts();
