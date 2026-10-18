const SUPABASE_URL = "https://vpducjdkjrbxeosdxvdi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_K9GLIlPYh55utqPq77pgwA_hp3QQYDf";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (s) => document.querySelector(s);
let currentTab = "requests";
let requests = [];
let sellers = [];
let products = [];
let payments = [];
let sellerImages = [];
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
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
  $("#paymentsList").innerHTML=empty("جاري تحميل طلبات الدفع...");
  const [rq,sa,pr,pa,si]=await Promise.all([
    db.from("quote_requests").select("id,phone,details,governorate,status,quantity,created_at").order("created_at",{ascending:false}).limit(200),
    db.from("seller_applications").select("id,shop_name,governorate,category,contact,status,created_at").order("created_at",{ascending:false}).limit(200),
    db.from("products").select("id,name,description,price_iqd,governorate,status,created_at,shops(name),categories(name_ar)").order("created_at",{ascending:false}).limit(300),
    db.from("market_payments").select("id,user_id,kind,listing_id,shop_id,package_code,amount_iqd,duration_days,payment_method,transaction_reference,note,status,created_at").order("created_at",{ascending:false}).limit(300),
    db.from("seller_application_images").select("id,application_id,user_id,storage_path,original_name,content_type,size_bytes,created_at").order("created_at",{ascending:true}).limit(1000)
  ]);
  if(rq.error) throw rq.error;
  if(sa.error) throw sa.error;
  if(pr.error) throw pr.error;
  if(pa.error) throw pa.error;
  if(si.error) throw si.error;
  requests=rq.data||[]; sellers=sa.data||[]; products=pr.data||[]; payments=pa.data||[];
  sellerImages=await Promise.all((si.data||[]).map(async image=>{
    const {data,error}=await db.storage.from("somli-pending-images").createSignedUrl(image.storage_path,300);
    return {...image,signedUrl:error?"":(data?.signedUrl||"")};
  }));
  $("#openCount").textContent=requests.filter(x=>x.status==="open").length;
  $("#pendingCount").textContent=sellers.filter(x=>x.status==="pending").length;
  $("#allCount").textContent=requests.length;
  renderRequests(); renderSellers(); renderProducts(); renderPayments();
}
function renderRequests(){
  const list=$("#requestsList");
  if(!requests.length){list.innerHTML=empty("لحد الآن ماكو طلبات أسعار.");return;}
  list.innerHTML=requests.map(r=>'<article class="admin-item"><h3>'+esc((r.details||"طلب سعر").split("\n")[0].replace(/^المنتج:\s*/,""))+'</h3><p>'+esc(r.details||"ماكو تفاصيل")+'</p><p>المحافظة: <b>'+esc(r.governorate)+'</b> · الحالة: <b>'+esc(r.status)+'</b> · الكمية: '+esc(r.quantity)+'</p><p>رقم الزبون: <b>'+(r.phone?'<a href="tel:'+esc(r.phone)+'">'+esc(r.phone)+'</a>':'غير مضاف')+'</b></p><p class="admin-meta">تاريخ الطلب: '+esc(dateLabel(r.created_at))+'</p>'+(r.status==="open"?'<div class="admin-actions"><button class="close-request" data-close-request="'+esc(r.id)+'">إغلاق الطلب</button></div>':"")+'</article>').join("");
}
function renderSellers(){
  const list=$("#sellersList");
  if(!sellers.length){list.innerHTML=empty("ماكو طلبات تسجيل محلات لحد الآن.");return;}
  list.innerHTML=sellers.map(s=>{
    const photos=sellerImages.filter(image=>image.application_id===s.id);
    const gallery=photos.length
      ? '<div class="seller-photo-gallery" aria-label="صور تجهيز المحل">'+photos.map(image=>image.signedUrl
        ? '<a href="'+esc(image.signedUrl)+'" target="_blank" rel="noopener noreferrer"><img src="'+esc(image.signedUrl)+'" alt="'+esc(image.original_name)+'" loading="lazy"><small>'+esc(image.original_name)+'</small></a>'
        : '<span class="admin-meta">تعذر إنشاء رابط آمن للصورة: '+esc(image.original_name)+'</span>').join("")+'</div>'
      : '<p class="admin-meta">ماكو صور تجهيز مرفقة.</p>';
    return '<article class="admin-item"><h3>'+esc(s.shop_name)+'</h3><p>الفئة: '+esc(s.category)+' · المحافظة: '+esc(s.governorate)+'</p><p>رقم التواصل: <b>'+esc(s.contact||"ما مضاف")+'</b></p><p>الحالة: <b>'+esc(s.status)+'</b></p><p class="admin-meta">تاريخ الطلب: '+esc(dateLabel(s.created_at))+'</p><h4>صور التجهيز الخاصة</h4>'+gallery+(s.status==="pending"?'<div class="admin-actions"><button class="approve" data-seller="'+esc(s.id)+'" data-status="approved">موافقة</button><button class="reject" data-seller="'+esc(s.id)+'" data-status="rejected">رفض</button></div>':"")+'</article>';
  }).join("");
}


async function loadPaymentSettings(){
 const {data,error}=await db.from("market_payment_settings").select("zain_cash_account,super_qi_account,other_instructions,support_phone").eq("id",true).maybeSingle();
 if(error){$("#paymentSettingsMessage").textContent="تعذر تحميل بيانات الدفع: "+error.message;return;}
 const form=$("#paymentSettingsForm");if(!form)return;
 if(data)for(const key of ["zain_cash_account","super_qi_account","other_instructions","support_phone"])form.elements[key].value=data[key]||"";
}
$("#paymentSettingsForm").addEventListener("submit",async e=>{
 e.preventDefault();const form=e.currentTarget,fd=new FormData(form),btn=$("#savePaymentSettings");btn.disabled=true;btn.textContent="جاري الحفظ...";
 try{const {error}=await db.from("market_payment_settings").upsert({id:true,zain_cash_account:String(fd.get("zain_cash_account")||"").trim(),super_qi_account:String(fd.get("super_qi_account")||"").trim(),other_instructions:String(fd.get("other_instructions")||"").trim(),support_phone:String(fd.get("support_phone")||"").trim(),updated_at:new Date().toISOString()},{onConflict:"id"});if(error)throw error;$("#paymentSettingsMessage").textContent="تم حفظ بيانات الاستلام.";showNotice("تم تحديث بيانات الدفع التي تظهر للمستخدمين.");}
 catch(err){$("#paymentSettingsMessage").textContent="تعذر حفظ البيانات: "+(err.message||"خطأ");}
 finally{btn.disabled=false;btn.textContent="حفظ بيانات الدفع";}
});

function renderPayments(){
 const list=$("#paymentsList");
 if(!payments.length){list.innerHTML=empty("ماكو طلبات دفع حالياً.");return;}
 list.innerHTML=payments.map(p=>{
  const kind=p.kind==="promotion"?"ترويج إعلان":"اشتراك محل";
  const pack=p.package_code==="boost_3d"?"ترويج 3 أيام":p.package_code==="boost_7d"?"ترويج 7 أيام":"اشتراك احترافي 30 يوم";
  const method=p.payment_method==="zain_cash"?"زين كاش":p.payment_method==="super_qi"?"سوبر كي":"طريقة أخرى";
  const status=p.status==="approved"?"تم التأكيد":p.status==="rejected"?"مرفوض":"بانتظار التحقق";
  return '<article class="admin-item"><h3>'+esc(kind)+' — '+esc(pack)+'</h3><p><b>المبلغ:</b> '+esc(new Intl.NumberFormat("ar-IQ").format(p.amount_iqd))+' د.ع · <b>المدة:</b> '+esc(p.duration_days)+' يوم</p><p><b>طريقة الدفع:</b> '+esc(method)+' · <b>رقم العملية:</b> '+esc(p.transaction_reference)+'</p><p><b>معرّف المستخدم:</b> '+esc(p.user_id)+'</p><p><b>معرّف الإعلان/المحل:</b> '+esc(p.listing_id||p.shop_id||"—")+'</p><p>'+esc(p.note||"بدون ملاحظات")+'</p><p class="admin-meta">الحالة: '+esc(status)+' · '+esc(dateLabel(p.created_at))+'</p>'+(p.status==="pending"?'<div class="admin-actions"><button class="approve" data-payment="'+esc(p.id)+'" data-status="approved">تأكيد الدفع وتفعيل</button><button class="reject" data-payment="'+esc(p.id)+'" data-status="rejected">رفض الطلب</button></div>':"")+'</article>';
 }).join("");
}
async function reviewPayment(id,status){
 const {data,error}=await db.from("market_payments").update({status}).eq("id",id).eq("status","pending").select("id");
 if(error){showNotice("فشل تحديث طلب الدفع: "+error.message);return;}
 if(!data?.length){showNotice("الطلب لم يتغير؛ حدّث القائمة وتأكد من حالته.");return;}
 try{await loadData();showNotice(status==="approved"?"تم تأكيد الدفع وتفعيل الباقة بنجاح.":"تم رفض طلب الدفع.");}
 catch(e){showNotice("تم تحديث حالة الدفع لكن تعذر تحديث القائمة: "+(e.message||"خطأ"));}
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
  const {data,error}=await db.from("products").update({status}).eq("id",id).select("id");
  if(error){showNotice("فشل تحديث المنتج: "+error.message);return;}
  if(!data?.length){showNotice("ما تغير المنتج. غالباً ما وصل تحديث الصلاحيات أو المنتج غير موجود؛ حدّث الصفحة وحاول مرة ثانية.");return;}
  try { await loadData(); showNotice(status==="approved"?"تم اعتماد المنتج ونشره.":"تم رفض المنتج."); }
  catch(e){showNotice("تم تحديث المنتج، لكن تعذر تحديث القائمة: "+(e.message||"خطأ غير معروف"));}
}

async function changeSeller(id,status){
  const {error}=await db.rpc("admin_review_seller_application",{p_application_id:id,p_status:status});
  if(error){showNotice("فشل تحديث طلب المحل: "+error.message);return;}
  try { await loadData(); showNotice(status==="approved"?"تمت الموافقة على طلب المحل وتفعيل المحل.":"تم رفض طلب المحل."); }
  catch(e){showNotice("تم تحديث الطلب، لكن تعذر تحديث القائمة: "+(e.message||"خطأ غير معروف"));}
}
async function closeRequest(id){
  const {data,error}=await db.from("quote_requests").update({status:"closed"}).eq("id",id).select("id");
  if(error){showNotice("فشل إغلاق طلب السعر: "+error.message);return;}
  if(!data?.length){showNotice("الطلب ما تغير. حدّث الصفحة وتأكد من صلاحيات المدير.");return;}
  try { await loadData(); showNotice("تم إغلاق طلب السعر."); }
  catch(e){showNotice("تم إغلاق الطلب، لكن تعذر تحديث القائمة: "+(e.message||"خطأ غير معروف"));}
}
document.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{
  currentTab=btn.dataset.tab;
  document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b===btn));
  $("#requestsPanel").classList.toggle("hidden",currentTab!=="requests");
  $("#sellersPanel").classList.toggle("hidden",currentTab!=="sellers");
  $("#productsPanel").classList.toggle("hidden",currentTab!=="products");
  $("#paymentsPanel").classList.toggle("hidden",currentTab!=="payments");
}));
$("#requestsList").addEventListener("click",e=>{const b=e.target.closest("[data-close-request]");if(b)closeRequest(b.dataset.closeRequest);});
$("#sellersList").addEventListener("click",e=>{const b=e.target.closest("[data-seller]");if(b)changeSeller(b.dataset.seller,b.dataset.status);});
$("#productsList").addEventListener("click",e=>{const b=e.target.closest("[data-product]");if(b)changeProduct(b.dataset.product,b.dataset.status);});
$("#paymentsList").addEventListener("click",e=>{const b=e.target.closest("[data-payment]");if(b)reviewPayment(b.dataset.payment,b.dataset.status);});
$("#reloadBtn").addEventListener("click",async()=>{try{if(await verifyAdmin()){await loadData();await loadPaymentSettings();}}catch(e){showNotice("صار خطأ بالتحميل: "+(e.message||"حاول مرة ثانية"));}});
$("#logoutBtn").addEventListener("click",async()=>{await db.auth.signOut();location.href="./";});
(async()=>{try{if(await verifyAdmin()){await loadData();await loadPaymentSettings();}}catch(e){showNotice("تعذر تحميل اللوحة: "+(e.message||"خطأ غير معروف"));}})();