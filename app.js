const SUPABASE_URL = "https://vpducjdkjrbxeosdxvdi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_K9GLIlPYh55utqPq77pgwA_hp3QQYDf";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let products = [];
let authMode = "login";
let resumeRequestAfterAuth = false;

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
      <div class="tile-art">
        ${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}" loading="lazy">` : `<div class="tile-placeholder"><span>🛍️</span><small>الصورة غير متوفرة</small></div>`}
        <span class="tile-category">${escapeHtml(p.category)}</span>
        ${p.isPro ? '<span class="tile-featured">⭐ محل مميز</span>' : ""}
      </div>
      <div class="tile-body">
        <h3>${escapeHtml(p.title)}</h3>
        <div class="tile-shop"><span class="tile-shop-dot">✓</span><strong>${escapeHtml(p.shop)}</strong></div>
        <div class="tile-location-line"><span>📍 ${escapeHtml(p.governorate || "العراق")}</span><span>منتج معتمد</span></div>
        <div class="tile-price-row"><strong class="tile-price">${p.price == null ? "السعر عند الطلب" : formatPrice(p.price)}</strong></div>
        <p class="tile-description">${escapeHtml(p.description || "تواصل ويانا حتى تعرف تفاصيل أكثر عن هذا المنتج.")}</p>
        <div class="tile-footer">
          <button type="button" class="tile-details-btn" data-product-detail="${escapeHtml(p.id)}">تفاصيل المنتج</button>
          <button type="button" class="tile-ask-btn" data-ask="${escapeHtml(p.id)}">اطلب سعر مشابه</button>
        </div>
      </div>
    </article>`).join("");
  const emptyState = $("#emptyState");
  emptyState.classList.toggle("hidden", filtered.length > 0);
  const emptyTitle = emptyState.querySelector("h3");
  const emptyMessage = emptyState.querySelector("p");
  if (!products.length && !query && !gov && !activeCategory) {
    emptyTitle.textContent = "ماكو منتجات معتمدة حالياً";
    emptyMessage.textContent = "راح تظهر العروض هنا بعد ما تضيف المحلات منتجات وتعتمدها الإدارة. وتگدر هسه تطلب سعر لمنتجك.";
  } else {
    emptyTitle.textContent = "ما لقينا نتائج";
    emptyMessage.textContent = "جرّب كلمة ثانية أو اطلب السعر وخلي المحلات تجاوبك.";
  }
}
async function loadProducts() {
  $("#productGrid").innerHTML = "<p>دا نحمل المنتجات...</p>";
  const { data, error } = await supabaseClient
    .from("products")
    .select("id,name,description,price_iqd,governorate,category_id,shops(name,status,owner_id,pro_until),categories(name_ar),product_images(image_url,sort_order)")
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
    shopOwnerId: p.shops?.owner_id || null,
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
    const authTitle = $("#authBtn").querySelector("strong");
    const authSubtitle = $("#authBtn").querySelector("small");
    if (authTitle) authTitle.textContent = role === "admin" ? "لوحة المدير" : role === "shop_owner" ? "حساب المحل" : "حسابي ومقارنة العروض";
    else $("#authBtn").textContent = role === "admin" ? "لوحة المدير" : role === "shop_owner" ? "حساب المحل" : "حسابي ومقارنة العروض";
    if (authSubtitle) authSubtitle.textContent = role === "admin" ? "إدارة الموقع والطلبات والمحلات" : role === "shop_owner" ? "إدارة منتجات المحل وطلبات الأسعار" : "تابع طلباتك وعروض المحلات";
    $("#authBtn").setAttribute("aria-label", role === "admin" ? "فتح لوحة المدير" : role === "shop_owner" ? "فتح لوحة المحل" : "فتح مقارنة العروض");
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
    const authTitle = $("#authBtn").querySelector("strong");
    const authSubtitle = $("#authBtn").querySelector("small");
    if (authTitle) authTitle.textContent = "دخول / حساب جديد";
    else $("#authBtn").textContent = "دخول / حساب جديد";
    if (authSubtitle) authSubtitle.textContent = "سجّل دخولك أو أنشئ حساب";
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
["openRequestTop","openRequestHero","openRequestSection","openRequestBanner","emptyRequest","somliQuickRequest"].forEach(id => document.getElementById(id)?.addEventListener("click", e => { if (id === "somliQuickRequest") e.preventDefault(); if (id === "openRequestTop") closeSomliMenu(); openRequest(); }));
const somliMenuToggle = $("#somliMenuToggle");
const somliMenuPanel = $("#somliMenuPanel");
function closeSomliMenu() {
  somliMenuPanel.hidden = true;
  somliMenuToggle.setAttribute("aria-expanded", "false");
}
somliMenuToggle.addEventListener("click", () => {
  const isOpen = somliMenuToggle.getAttribute("aria-expanded") === "true";
  somliMenuToggle.setAttribute("aria-expanded", String(!isOpen));
  somliMenuPanel.hidden = isOpen;
});
somliMenuPanel.addEventListener("click", e => {
  if (e.target.closest("a")) closeSomliMenu();
});
document.addEventListener("click", e => {
  if (!e.target.closest(".somli-main-menu")) closeSomliMenu();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeSomliMenu();
});
$("#sellerBtn").addEventListener("click", () => { closeSomliMenu(); openDialog("sellerDialog"); });
$("#authBtn").addEventListener("click", async () => {
  closeSomliMenu();
  const auth = await refreshAuthUI();
  if (auth.user) {
    location.href = auth.role === "admin" ? "admin.html" : auth.role === "shop_owner" ? "shop.html" : "offers.html";
    return;
  }
  setAuthMode("login");
  openDialog("authDialog");
});
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
    const { data: authState } = await supabaseClient.auth.getSession();
    if (resumeRequestAfterAuth && authState.session) {
      resumeRequestAfterAuth = false;
      openDialog("requestDialog");
      showToast("تم تسجيل الدخول. بيانات طلبك محفوظة؛ اضغط إرسال طلب السعر لإكماله.");
    }
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
  const btn = $("#allCategories"), panel = $("#categories");
  const expanded = btn.getAttribute("aria-expanded") === "true";
  btn.setAttribute("aria-expanded", String(!expanded));
  panel.hidden = expanded;
  if (!expanded) panel.scrollIntoView({behavior:"smooth", block:"nearest"});
});
$("#searchBtn").addEventListener("click", renderProducts);
$("#searchInput").addEventListener("input", renderProducts);
$("#governorateFilter").addEventListener("change", renderProducts);
$("#clearSearch").addEventListener("click", () => { $("#searchInput").value = ""; renderProducts(); });
$("#productGrid").addEventListener("click", e => {
  const ask = e.target.closest("[data-ask]");
  if (ask) {
    const p = products.find(x => x.id === ask.dataset.ask);
    if (p) openRequest(p);
    return;
  }
  const details = e.target.closest("[data-product-detail]");
  if (!details) return;
  const p = products.find(x => x.id === details.dataset.productDetail);
  if (!p) return;
  $("#productDetailTitle").textContent = p.title;
  $("#productDetailImage").innerHTML = p.image
    ? '<img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.title) + '">'
    : '<div class="product-detail-placeholder">🛍️<span>الصورة غير متوفرة</span></div>';
  $("#productDetailCategory").textContent = p.category;
  $("#productDetailPrice").textContent = p.price == null ? "السعر عند الطلب" : formatPrice(p.price);
  $("#productDetailShop").textContent = p.shop;
  $("#productDetailChat").href = "chat.html?product=" + encodeURIComponent(p.id);
  $("#productDetailGovernorate").textContent = p.governorate || "العراق";
  $("#productDetailDescription").textContent = p.description || "ماكو تفاصيل إضافية لهذا المنتج حالياً.";
  $("#productDetailAsk").onclick = () => { closeDialog("productDetailDialog"); openRequest(p); };
  openDialog("productDetailDialog");
});
$("#requestForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const originalLabel = submit.textContent;
  submit.disabled = true;
  submit.textContent = "جاري إرسال الطلب...";
  try {
    const data = Object.fromEntries(new FormData(form).entries());
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData.session?.user;
    if (!user) {
      resumeRequestAfterAuth = true;
      closeDialog("requestDialog");
      setAuthMode("login");
      openDialog("authDialog");
      showToast("سجّل دخولك أولاً حتى نحفظ طلبك. احتفظنا ببيانات النموذج.");
      return;
    }
    const details = [
      "المنتج: " + String(data.title || "").trim(),
      "الفئة: " + String(data.category || "").trim(),
      "رقم التواصل: " + String(data.phone || "").trim(),
      data.budget ? "الميزانية: " + data.budget + " د.ع" : "",
      data.condition ? "الحالة: " + data.condition : "",
      data.details ? "تفاصيل: " + String(data.details).trim() : ""
    ].filter(Boolean).join("\n");
    const { error } = await supabaseClient.from("quote_requests").insert({
      customer_id: user.id,
      phone: String(data.phone || "").trim(),
      details,
      governorate: data.governorate,
      status: "open",
      quantity: 1
    });
    if (error) throw error;
    closeDialog("requestDialog");
    form.reset();
    showToast("تم إرسال طلبك إلى سوملي بنجاح.");
  } catch (err) {
    console.error("Somli quote request error:", err.message);
    showToast("تعذر إرسال الطلب حالياً. تأكد من الاتصال والحساب ثم حاول مرة ثانية.");
  } finally {
    submit.disabled = false;
    submit.textContent = originalLabel;
  }
});
$("#sellerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const originalLabel = submit.textContent;
  const files = Array.from(form.elements.prep_images.files || []).filter(file => file && file.size);
  submit.disabled = true;
  submit.textContent = "جاري إرسال الطلب...";
  try {
    if (files.length > 5) throw new Error("تگدر ترفع لحد 5 صور فقط لكل طلب محل.");
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) throw new Error("صيغة إحدى الصور غير مدعومة. استخدم JPG أو PNG أو WebP أو AVIF.");
      if (file.size > 5 * 1024 * 1024) throw new Error("حجم كل صورة لازم يكون 5 ميگابايت أو أقل.");
    }
    const data = Object.fromEntries(new FormData(form).entries());
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData.session?.user;
    if (!user) {
      closeDialog("sellerDialog");
      setAuthMode("login");
      openDialog("authDialog");
      showToast("سجّل دخولك أولاً حتى نرسل طلب تسجيل المحل.");
      return;
    }

    const { data: existing, error: existingError } = await supabaseClient
      .from("seller_applications").select("id,status")
      .eq("user_id", user.id).eq("status", "pending")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existingError) throw existingError;

    let applicationId = existing?.id;
    if (!applicationId) {
      const { data: created, error: createError } = await supabaseClient
        .from("seller_applications")
        .insert({
          user_id: user.id,
          shop_name: String(data.shop || "").trim(),
          governorate: data.governorate,
          category: data.category || "أخرى",
          contact: String(data.contact || "").trim() || null,
          status: "pending"
        }).select("id").single();
      if (createError) throw createError;
      applicationId = created.id;
    } else if (!files.length) {
      showToast("عندك طلب محل قيد المراجعة بالفعل. تگدر تختار الصور وتضغط إرسال حتى نضيفها للطلب نفسه.");
      return;
    }

    if (files.length) {
      const { data: priorImages, error: priorError } = await supabaseClient
        .from("seller_application_images").select("id")
        .eq("application_id", applicationId);
      if (priorError) throw priorError;
      if ((priorImages || []).length + files.length > 5) {
        throw new Error("الطلب يحتوي صوراً مسبقاً؛ المجموع المسموح 5 صور فقط.");
      }
      for (const file of files) {
        const ext = ({ "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp", "image/avif":"avif" })[file.type];
        const path = user.id + "/" + applicationId + "/" + crypto.randomUUID() + "." + ext;
        const { error: uploadError } = await supabaseClient.storage
          .from("somli-pending-images").upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error("تعذر رفع إحدى الصور الخاصة: " + uploadError.message);
        const { error: imageError } = await supabaseClient.from("seller_application_images").insert({
          application_id: applicationId,
          user_id: user.id,
          storage_path: path,
          original_name: file.name.slice(0, 255) || "صورة تجهيز",
          content_type: file.type,
          size_bytes: file.size
        });
        if (imageError) {
          await supabaseClient.storage.from("somli-pending-images").remove([path]);
          throw new Error("تعذر حفظ بيانات إحدى الصور: " + imageError.message);
        }
      }
    }
    closeDialog("sellerDialog");
    form.reset();
    showToast(files.length
      ? "وصل طلب المحل وحُفظت الصور بشكل خاص للمراجعة."
      : "وصل طلب تسجيل المحل، وحالته قيد المراجعة.");
  } catch (err) {
    console.error("Somli seller application error:", err.message);
    showToast(err.code === "23505"
      ? "عندك طلب تسجيل محل قيد المراجعة بالفعل. اختار الصور إذا تريد إضافتها."
      : (err.message || "تعذر إرسال طلب المحل حالياً. تأكد من الاتصال والحساب وحاول مرة ثانية."));
  } finally {
    submit.disabled = false;
    submit.textContent = originalLabel;
  }
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
  function start(){clearInterval(timer);timer=setInterval(()=>show(index+1),5000);}
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
