const SUPABASE_URL = "https://vpducjdkjrbxeosdxvdi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_K9GLIlPYh55utqPq77pgwA_hp3QQYDf";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let products = [];
let authMode = "login";

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
        <div class="tile-shop">${escapeHtml(p.shop)} ${p.isPro?'<span class="pro-shop-badge">⭐ محل احترافي</span>':""} <span>·</span> ${escapeHtml(p.governorate)}</div>
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
    .select("id,name,description,price_iqd,governorate,category_id,shops(name,status,pro_until),categories(name_ar),product_images(image_url,sort_order)")
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
    isPro: !!p.shops?.pro_until && new Date(p.shops.pro_until) > new Date(),
    governorate: p.governorate,
    image: (p.product_images || []).sort((a,b) => a.sort_order - b.sort_order)[0]?.image_url || "",
    description: p.description || ""
  })).sort((a,b)=>(Number(b.isPro)-Number(a.isPro)));
  renderProducts();
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  $("#authTitle").textContent = signup ? "إنشاء حساب" : "دخول للحساب";
  $("#authSubmit").textContent = signup ? "إنشاء حساب" : "دخول";
  $("#authNameWrap").classList.toggle("hidden", !signup);
  $("#authForm").elements.full_name.required = signup;
  $("#authForm").elements.password.autocomplete = signup ? "new-password" : "current-password";
  $("#authToggle").textContent = signup ? "عندك حساب؟ سجّل دخولك" : "ما عندك حساب؟ أنشئ حساب جديد";
  $("#authNote").textContent = signup ? "أنشئ حساب زبون بالبريد الإلكتروني." : "سجّل دخولك حتى نكمل تفعيل طلبات الأسعار.";
}
async function syncProfile(user) {
  if (!user) return;
  const fullName = user.user_metadata?.full_name || user.email?.split("@")[0] || "مستخدم سوملي";
  const { error } = await supabaseClient.from("profiles").upsert({ id: user.id, full_name: fullName }, { onConflict: "id" });
  if (error) console.warn("Somli profile sync:", error.message);
}
async function refreshAuthUI() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) console.warn("Somli session check:", error.message);
  const user = data.session?.user;
  let role = "customer";
  if (user) {
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles").select("role,full_name").eq("id", user.id).maybeSingle();
    if (profileError) console.warn("Somli role check:", profileError.message);
    role = profile?.role || "customer";
    $("#authBtn").textContent = role === "admin" ? "لوحة المدير" : "حسابي";
    $("#authBtn").setAttribute("aria-label", role === "admin" ? "فتح لوحة المدير" : "فتح حسابي");
    let shortcut = document.getElementById("adminShortcut");
    if (role === "admin" && !shortcut) {
      shortcut = document.createElement("a");
      shortcut.id = "adminShortcut";
      shortcut.className = "btn btn-ghost";
      shortcut.href = "admin.html";
      shortcut.textContent = "إدارة الموقع";
      $("#authBtn").parentElement.insertBefore(shortcut, $("#authBtn"));
    }
    if (shortcut) shortcut.classList.toggle("hidden", role !== "admin");
    $("#authNote").textContent = "مسجل الدخول: " + (profile?.full_name || user.email || "حساب سوملي") +
      (role === "admin" ? " — صلاحية مدير مفعّلة" : "");
  } else {
    $("#authBtn").textContent = "دخول / حساب جديد";
    $("#authBtn").setAttribute("aria-label", "تسجيل الدخول أو إنشاء حساب");
    const shortcut = document.getElementById("adminShortcut");
    if (shortcut) shortcut.classList.add("hidden");
  }
  $("#authLogout").classList.toggle("hidden", !user);
  return { user, role };
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
$("#authBtn").addEventListener("click", async () => { const auth = await refreshAuthUI(); if (auth.user && auth.role === "admin") { location.href = "admin.html"; return; } if (auth.user) { showToast("أنت مسجل دخولك. صلاحية المدير غير مفعّلة لهذا الحساب."); return; } setAuthMode("login"); openDialog("authDialog"); });
$("#authToggle").addEventListener("click", () => setAuthMode(authMode === "login" ? "signup" : "login"));
$("#authLogout").addEventListener("click", async () => { const { error } = await supabaseClient.auth.signOut(); if (error) showToast("تعذر تسجيل الخروج."); else { showToast("تم تسجيل الخروج."); await refreshAuthUI(); closeDialog("authDialog"); } });
$("#authForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  $("#authSubmit").disabled = true;
  try {
    if (authMode === "signup") {
      const full_name = form.elements.full_name.value.trim();
      const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name } } });
      if (error) throw error;
      if (data.session && data.user) { await syncProfile(data.user); showToast("تم إنشاء الحساب."); }
      else { showToast("تم التسجيل. افتح بريدك الإلكتروني لتأكيد الحساب ثم سجّل دخولك."); }
      closeDialog("authDialog");
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await syncProfile(data.user);
      showToast("هلا بيك بسوملي، تم تسجيل الدخول.");
      closeDialog("authDialog");
    }
    await refreshAuthUI();
  } catch (err) { showToast(err.message || "تعذر إكمال العملية. تأكد من البريد وكلمة المرور."); }
  finally { $("#authSubmit").disabled = false; }
});
supabaseClient.auth.onAuthStateChange(() => { refreshAuthUI(); });
$$("[data-close]").forEach(btn => btn.addEventListener("click", () => closeDialog(btn.dataset.close)));
["requestDialog","sellerDialog","authDialog"].forEach(id => document.getElementById(id).addEventListener("click", e => {
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
$("#requestForm").addEventListener("submit", async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget).entries());
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) { closeDialog("requestDialog"); setAuthMode("login"); openDialog("authDialog"); showToast("سجّل دخولك أولاً حتى نحفظ طلبك."); return; }
  const details = ["المنتج: " + data.title, "رقم التواصل: " + String(data.phone || "").trim(), data.budget ? "الميزانية: " + data.budget + " د.ع" : "", data.condition ? "الحالة: " + data.condition : "", data.details ? "تفاصيل: " + data.details : ""].filter(Boolean).join("\n");
  const { error } = await supabaseClient.from("quote_requests").insert({ customer_id: user.id, phone: String(data.phone || "").trim(), details, governorate: data.governorate, status: "open", quantity: 1 });
  if (error) { showToast("ما انحفظ الطلب. تأكد من الحساب وحاول مرة ثانية."); console.error("Somli quote request error:", error.message); return; }
  closeDialog("requestDialog");
  showToast("تم إرسال طلبك إلى سوملي بنجاح.");
});
$("#sellerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) {
    closeDialog("sellerDialog");
    setAuthMode("login");
    openDialog("authDialog");
    showToast("سجّل دخولك أولاً حتى نرسل طلب تسجيل المحل.");
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  const { error } = await supabaseClient.from("seller_applications").insert({
    user_id: user.id,
    shop_name: String(data.shop || "").trim(),
    governorate: data.governorate,
    category: data.category || "أخرى",
    contact: String(data.contact || "").trim() || null,
    status: "pending"
  });
  submit.disabled = false;
  if (error) {
    showToast("تعذر إرسال طلب المحل. تأكد من تسجيل الدخول وحاول مرة ثانية.");
    console.error("Somli seller application error:", error.message);
    return;
  }
  closeDialog("sellerDialog");
  form.reset();
  showToast("وصل طلب تسجيل المحل، وحالته قيد المراجعة.");
});
$("#year").textContent = new Date().getFullYear();
setAuthMode("login");
refreshAuthUI();
loadProducts();
const initialAction = new URLSearchParams(window.location.search);
if (initialAction.get("request") === "1") openRequest();
if (initialAction.get("login") === "1") refreshAuthUI().then(auth => { if (!auth.user) { setAuthMode("login"); openDialog("authDialog"); } });


/* Image showcase: auto-rotating, swipe-friendly and accessible */
(function initShowcase(){
  const slides=[...document.querySelectorAll(".showcase-image")];
  const dots=[...document.querySelectorAll("[data-slide-to]")];
  if(!slides.length)return;
  const titles=["اختيارات أكثر، مقارنة أسهل","قارن السماعات قبل الشراء","كل احتياجاتك بمكان واحد"];
  let index=0, timer;
  function show(next){
    index=(next+slides.length)%slides.length;
    slides.forEach((s,i)=>s.classList.toggle("active",i===index));
    dots.forEach((d,i)=>d.classList.toggle("active",i===index));
    const title=document.querySelector("#showcaseTitle");
    if(title)title.textContent=titles[index];
  }
  function start(){clearInterval(timer);timer=setInterval(()=>show(index+1),4800);}
  dots.forEach(d=>d.addEventListener("click",()=>{show(Number(d.dataset.slideTo));start();}));
  const hero=document.querySelector(".hero-showcase");
  if(hero){
    let startX=0;
    hero.addEventListener("touchstart",e=>{startX=e.changedTouches[0].clientX;},{passive:true});
    hero.addEventListener("touchend",e=>{const dx=e.changedTouches[0].clientX-startX;if(Math.abs(dx)>45){show(index+(dx<0?1:-1));start();}},{passive:true});
    hero.addEventListener("mouseenter",()=>clearInterval(timer));
    hero.addEventListener("mouseleave",start);
  }
  show(0);start();
})();
