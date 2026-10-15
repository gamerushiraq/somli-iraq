const SUPABASE_URL = "https://vpducjdkjrbxeosdxvdi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_K9GLIlPYh55utqPq77pgwA_hp3QQYDf";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (s) => document.querySelector(s);
let currentTab = "requests";
let requests = [];
let sellers = [];
let products = [];
function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;',"'" :"&#39;"}[c])); }
function showNotice(message) { const el=$("#notice"); el.textContent=message; el.classList.remove("hidden"); }
function hideNotice(){ $("#notice").classList.add("hidden"); }
function dateLabel(v){ return v ? new Date(v).toLocaleString("ar-IQ") : "—"; }
function empty(text){ return '<div class="admin-empty">'+esc(text)+'</div>'; }
async function verifyAdmin(){
  const {data:{session},error}=await db.auth.getSession();
  if(error) throw error;
  if(!session){ showNotice("لازم تسجّل دخولك أولاً من الموقع، وبعدها افتح لوحة المدير من جديد."); $("#signedInLabel").textContent="غير مسجل الدخول"; $("#requestsList").innerHTML=empty("سجّل دخولك من الموقع الرئيسي ثم ارجع لهنا."); $("#sellersList").innerHTML=empty("سجّل دخولك من الموقع الرئيسي ثم ارجع لهنا."); return false; }
  const {data:profile,error:profileError}=await db.from("profiles").select("full_name,role").eq("id",session.user.id).maybeSingle();
  if(profileError) throw profileError;
  if(profile?.role!=="admin"){ showNotice("هذا الحساب مو مدير. لوحة الإدارة محمية بصلاحيات قاعدة البيانات؛ اطلب تفعيل حسابك كمدير."); $("#signedInLabel").textContent="ما عندك صلاحية مدير"; $("#requestsList").innerHTML=empty("الوصول مرفوض."); $("#sellersList").innerHTML=empty("الوصول مرفوض."); return false; }
  $("#signedInLabel").textContent="مسجل الدخول كمدير: "+(profile.full_name||session.user.email||"مدير سوملي");
  hideNotice(); return true;
}
async function loadData(){
  $("#requestsList").innerHTML=empty("جاري تحميل الطلبات...");
  $("#sellersList").innerHTML=empty("جاري تحميل طلبات المحلات...");
  $("#productsList").innerHTML=empty("جاري تحميل المنتجات...");
  const [rq,sa,pr]=await Promise.all([
    db.from("quote_requests").select("id,details,governorate,status,quantity,created_at").order("created_at",{ascending:false}).limit(200),
    db.from("seller_applications").select("id,shop_name,governorate,category,contact,status,created_at").order("created_at",{ascending:false}).limit(200),
    db.from("products").select("id,name,description,price_iqd,governorate,status,created_at,shops(name),categories(name_ar)").order("created_at",{ascending:false}).limit(300)
  ]);
  if(rq.error) throw rq.error;
  if(sa.error) throw sa.error;
  if(pr.error) throw pr.error;
  requests=rq.data||[]; sellers=sa.data||[]; products=pr.data||[];
  $("#openCount").textContent=requests.filter(x=>x.status==="open").length;
  $("#pendingCount").textContent=sellers.filter(x=>x.status==="pending").length;
  $("#allCount").textContent=requests.length;
  renderRequests(); renderSellers(); renderProducts();
}
function renderRequests(){
  const list=$("#requestsList");
  if(!requests.length){list.innerHTML=empty("لحد الآن ماكو طلبات أسعار.");return;}
  list.innerHTML=requests.map(r=>'<article class="admin-item"><h3>'+esc((r.details||"طلب سعر").split("\n")[0].replace(/^المنتج:\s*/,""))+'</h3><p>'+esc(r.details||"ماكو تفاصيل")+'</p><p>المحافظة: <b>'+esc(r.governorate)+'</b> · الحالة: <b>'+esc(r.status)+'</b> · الكمية: '+esc(r.quantity)+'</p><p class="admin-meta">تاريخ الطلب: '+esc(dateLabel(r.created_at))+'</p>'+(r.status==="open"?'<div class="admin-actions"><button class="close-request" data-close-request="'+esc(r.id)+'">إغلاق الطلب</button></div>':"")+'</article>').join("");
}
function renderSellers(){
  const list=$("#sellersList");
  if(!sellers.length){list.innerHTML=empty("ماكو طلبات تسجيل محلات لحد الآن.");return;}
  list.innerHTML=sellers.map(s=>'<article class="admin-item"><h3>'+esc(s.shop_name)+'</h3><p>الفئة: '+esc(s.category)+' · المحافظة: '+esc(s.governorate)+'</p><p>رقم التواصل: <b>'+esc(s.contact||"ما مضاف")+'</b></p><p>الحالة: <b>'+esc(s.status)+'</b></p><p class="admin-meta">تاريخ الطلب: '+esc(dateLabel(s.created_at))+'</p>'+(s.status==="pending"?'<div class="admin-actions"><button class="approve" data-seller="'+esc(s.id)+'" data-status="approved">موافقة</button><button class="reject" data-seller="'+esc(s.id)+'" data-status="rejected">رفض</button></div>':"")+'</article>').join("");
}

function renderProducts(){
  const list=$("#productsList");
  if(!products.length){list.innerHTML=empty("ماكو منتجات مسجلة لحد الآن.");return;}
  list.innerHTML=products.map(p=>{
    const price=p.price_iqd==null?"عند الطلب":new Intl.NumberFormat("ar-IQ").format(p.price_iqd)+" د.ع";
    const actions=p.status==="pending" ? '<div class="admin-actions"><button class="approve" data-product="'+esc(p.id)+'" data-status="approved">اعتماد ونشر</button><button class="reject" data-product="'+esc(p.id)+'" data-status="rejected">رفض</button></div>' : "";
    return '<article class="admin-item"><h3>'+esc(p.name)+'</h3><p>المحل: <b>'+esc(p.shops?.name||"—")+'</b> · الفئة: '+esc(p.categories?.name_ar||"أخرى")+'</p><p>السعر: '+esc(price)+' · المحافظة: '+esc(p.governorate)+'</p><p>'+esc(p.description||"بدون وصف")+'</p><p class="admin-meta">الحالة: '+esc(p.status)+' · '+esc(dateLabel(p.created_at))+'</p>'+actions+'</article>';
  }).join("");
}
async function changeProduct(id,status){
  const {error}=await db.from("products").update({status}).eq("id",id);
  if(error){showNotice("ما قدرنا نحدّث المنتج. تأكد من صلاحيات المدير.");return;}
  await loadData(); showNotice(status==="approved"?"تم اعتماد المنتج ونشره.":"تم رفض المنتج.");
}

async function changeSeller(id,status){
  const {error}=await db.rpc("admin_review_seller_application",{p_application_id:id,p_status:status});
  if(error){showNotice("ما قدرنا نحدّث طلب المحل. تأكد من صلاحيات المدير.");return;}
  await loadData(); showNotice(status==="approved"?"تمت الموافقة على طلب المحل.":"تم رفض طلب المحل.");
}
async function closeRequest(id){
  const {error}=await db.from("quote_requests").update({status:"closed"}).eq("id",id);
  if(error){showNotice("ما قدرنا نغلق الطلب. تأكد من صلاحيات المدير.");return;}
  await loadData(); showNotice("تم إغلاق طلب السعر.");
}
document.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{
  currentTab=btn.dataset.tab;
  document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b===btn));
  $("#requestsPanel").classList.toggle("hidden",currentTab!=="requests");
  $("#sellersPanel").classList.toggle("hidden",currentTab!=="sellers");
  $("#productsPanel").classList.toggle("hidden",currentTab!=="products");
}));
$("#requestsList").addEventListener("click",e=>{const b=e.target.closest("[data-close-request]");if(b)closeRequest(b.dataset.closeRequest);});
$("#sellersList").addEventListener("click",e=>{const b=e.target.closest("[data-seller]");if(b)changeSeller(b.dataset.seller,b.dataset.status);});
$("#productsList").addEventListener("click",e=>{const b=e.target.closest("[data-product]");if(b)changeProduct(b.dataset.product,b.dataset.status);});
$("#reloadBtn").addEventListener("click",async()=>{try{if(await verifyAdmin())await loadData();}catch(e){showNotice("صار خطأ بالتحميل: "+(e.message||"حاول مرة ثانية"));}});
$("#logoutBtn").addEventListener("click",async()=>{await db.auth.signOut();location.href="./";});
(async()=>{try{if(await verifyAdmin())await loadData();}catch(e){showNotice("تعذر تحميل اللوحة: "+(e.message||"خطأ غير معروف"));}})();