const SUPABASE_URL="https://vpducjdkjrbxeosdxvdi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_K9GLIlPYh55utqPq77pgwA_hp3QQYDf";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>v===null||v===undefined||v===""?"السعر قابل للتفاوض":Number(v)===0?"مجاني":new Intl.NumberFormat("ar-IQ").format(v)+" د.ع";
let currentUser=null, listings=[], authMode="login", toastTimer, resumeSellAfterAuth=false, paymentSettings=null;
function toast(t){const el=$("#marketToast");el.textContent=t;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3500);}
function open(id){const d=document.getElementById(id);if(d&&!d.open)d.showModal();}
function close(id){document.getElementById(id)?.close();}
function authModeSet(mode){authMode=mode;const signup=mode==="signup";$("#marketAuthTitle").textContent=signup?"إنشاء حساب":"دخول للحساب";$("#marketAuthSubmit").textContent=signup?"إنشاء حساب":"دخول";$("#marketNameWrap").classList.toggle("market-hidden",!signup);$("#marketAuthForm").elements.full_name.required=signup;$("#marketAuthForm").elements.password.autocomplete=signup?"new-password":"current-password";$("#marketAuthToggle").textContent=signup?"عندك حساب؟ سجّل دخولك":"ما عندك حساب؟ أنشئ حساب جديد";}
async function getSession(){const {data,error}=await db.auth.getSession();if(error)throw error;currentUser=data.session?.user||null;$("#marketAuthBtn").textContent=currentUser?"حسابي / خروج":"دخول / حساب جديد";$("#myListingsNote").textContent=currentUser?"هنا تكدر تدير إعلاناتك أو تعلّم المنتج كمباع.":"سجّل دخولك حتى تنشر إعلان وتدير إعلاناتك.";await loadMyListings();await loadPaymentHistory();}
function whatsappNumber(phone){
 const digits=String(phone||"").replace(/\D/g,"");
 if(!digits)return "";
 if(digits.startsWith("964"))return digits;
 if(digits.startsWith("0"))return "964"+digits.slice(1);
 if(digits.startsWith("7"))return "964"+digits;
 return digits;
}
function card(p){
 const image=p.image_urls?.[0], promoted=!!p.is_promoted&&p.promoted_until&&new Date(p.promoted_until)>new Date();
 const phone=String(p.phone||"").trim(), wa=whatsappNumber(phone), condition=esc(p.condition||"مستعمل");
 const imageCount=(p.image_urls||[]).filter(Boolean).length;
 return `<article class="market-card ${promoted?"market-card-featured":""}">
 <div class="market-card-img" data-detail="${esc(p.id)}" role="button" tabindex="0" aria-label="عرض تفاصيل ${esc(p.title)}">
  ${image?'<img src="'+esc(image)+'" alt="'+esc(p.title)+'" loading="lazy">':'<div class="market-no-img-wrap"><span class="market-no-img">📦</span><small>الصورة غير متوفرة</small></div>'}
  ${promoted?'<span class="market-featured-badge">⭐ إعلان مميز</span>':""}
  ${imageCount>1?'<span class="market-image-count">▧ '+imageCount+' صور</span>':""}
 </div>
 <div class="market-card-body">
  <div class="market-card-title-row"><h3>${esc(p.title)}</h3><span class="market-condition-chip">${condition}</span></div>
  <div class="market-price">${esc(money(p.price_iqd))}</div>
  <div class="market-meta">
   <span>📍 ${esc(p.governorate||"العراق")}</span><span>👤 ${esc(p.seller_name||"بائع سوملي")}</span>
   <span>🗓️ ${esc(new Date(p.created_at).toLocaleDateString("ar-IQ"))}</span>
  </div>
  <p class="market-card-description">${esc(p.description||"تواصل مع البائع لمعرفة المزيد من التفاصيل.")}</p>
  <div class="market-card-actions">
   <button type="button" class="market-details-action" data-detail="${esc(p.id)}">تفاصيل المنتج</button>
   ${wa?'<a class="market-whatsapp-action" href="https://wa.me/'+wa+'?text='+esc(encodeURIComponent("مرحبا، شفت إعلانك على سوملي: "+p.title))+'" target="_blank" rel="noopener noreferrer">واتساب</a>':'<a class="market-call-action" href="tel:'+esc(phone)+'">اتصال</a>'}
  </div>
  ${wa?'<a class="market-call-link" href="tel:'+esc(phone)+'">📞 اتصال مباشر بالبائع</a>':""}
 </div></article>`;
}
function renderListings(){
 const q=$("#marketSearch").value.trim().toLocaleLowerCase("ar");
 const gov=$("#marketGov").value,cat=$("#marketCategory").value,sort=$("#marketSort")?.value||"newest"; const minText=$("#marketMinPrice")?.value.trim()||"",maxText=$("#marketMaxPrice")?.value.trim()||""; const minPrice=minText===""?null:Number(minText),maxPrice=maxText===""?null:Number(maxText);
 const shown=listings.filter(p=>(!q||[p.title,p.description,p.category,p.governorate,p.seller_name,p.condition].join(" ").toLocaleLowerCase("ar").includes(q))&&(!gov||p.governorate===gov)&&(!cat||p.category===cat)&&(minPrice===null||(p.price_iqd!==null&&p.price_iqd!==undefined&&Number(p.price_iqd)>=minPrice))&&(maxPrice===null||(p.price_iqd!==null&&p.price_iqd!==undefined&&Number(p.price_iqd)<=maxPrice)));
 shown.sort((a,b)=>{
  if(sort==="price-low"||sort==="price-high"){
   const ap=a.price_iqd===null||a.price_iqd===undefined?Infinity:Number(a.price_iqd);
   const bp=b.price_iqd===null||b.price_iqd===undefined?Infinity:Number(b.price_iqd);
   return (sort==="price-low"?ap-bp:bp-ap)||new Date(b.created_at)-new Date(a.created_at);
  }
  if(sort==="oldest")return new Date(a.created_at)-new Date(b.created_at);
  return new Date(b.created_at)-new Date(a.created_at);
 });
 const count=$("#marketResultsCount");if(count)count.textContent="عدد الإعلانات: "+shown.length;
 const active=[];if(q)active.push("بحث: "+q);if(gov)active.push(gov);if(cat)active.push(cat);if(minPrice!==null)active.push("من "+minPrice.toLocaleString("ar-IQ"));if(maxPrice!==null)active.push("إلى "+maxPrice.toLocaleString("ar-IQ"));
 const activeEl=$("#marketActiveFilters");if(activeEl)activeEl.textContent=active.length?"الفلاتر: "+active.join(" · "):"كل الإعلانات";
 $("#marketGrid").innerHTML=shown.length?shown.map(card).join(""):'<div class="market-empty"><div style="font-size:35px">🔎</div><b>ماكو إعلانات مطابقة</b><p>غيّر البحث أو امسح الفلاتر حتى تشوف كل المنتجات.</p><button class="btn btn-primary" id="emptySell">أضف إعلان</button></div>';
 $("#emptySell")?.addEventListener("click",startSell);
}
async function loadListings(){ $("#marketGrid").innerHTML='<div class="market-empty">دا نحمل الإعلانات...</div>';const {data,error}=await db.from("market_listings").select("id,seller_id,seller_name,phone,title,description,category,governorate,condition,price_iqd,image_urls,status,created_at,is_promoted,promoted_until").eq("status","approved").order("created_at",{ascending:false}).limit(200);if(error){$("#marketGrid").innerHTML='<div class="market-empty">تعذر تحميل الإعلانات. جرّب تحديث الصفحة بعد قليل.</div>';console.error("market listings",error.message);return;}listings=(data||[]).sort((a,b)=>{const ap=a.is_promoted&&a.promoted_until&&new Date(a.promoted_until)>new Date()?1:0;const bp=b.is_promoted&&b.promoted_until&&new Date(b.promoted_until)>new Date()?1:0;return bp-ap||new Date(b.created_at)-new Date(a.created_at);});renderListings();}
async function loadMyListings(){
 if(!currentUser){$("#myListings").innerHTML="";return;}
 const {data,error}=await db.from("market_listings").select("id,title,description,category,governorate,condition,phone,seller_name,price_iqd,image_urls,status,created_at,is_promoted,promoted_until").eq("seller_id",currentUser.id).order("created_at",{ascending:false}).limit(100);
 if(error){$("#myListings").innerHTML='<div class="market-empty">تعذر تحميل إعلاناتك.</div>';return;}
 if(!data?.length){$("#myListings").innerHTML='<div class="market-empty">بعدك ما ناشر أي إعلان. اضغط «أضف إعلان» وابدأ.</div>';return;}
 $("#myListings").innerHTML=data.map(p=>{
  const active=!!p.is_promoted&&p.promoted_until&&new Date(p.promoted_until)>new Date();
  const promotion=active?'<small class="market-sponsored">مروّج لغاية '+esc(new Date(p.promoted_until).toLocaleDateString("ar-IQ"))+'</small>':"";
  const promoButton=p.status==="approved"&&!active?'<button class="btn btn-outline" data-promote="'+esc(p.id)+'">⭐ روّج الإعلان</button>':"";
  const status=p.status==="sold"?"مباع":p.status==="hidden"?"مخفي":p.status==="pending"?"بانتظار الموافقة":"معروض";
  const canEdit=p.status!=="deleted";
  return '<article class="market-my-item">'+(p.image_urls?.[0]?'<img src="'+esc(p.image_urls[0])+'" alt="">':'<span style="font-size:30px">📦</span>')+'<div><b>'+esc(p.title)+'</b><small>'+esc(money(p.price_iqd))+' · '+status+'</small>'+promotion+'<div class="market-my-actions">'+(canEdit?'<button class="btn btn-outline market-edit-btn" data-edit="'+esc(p.id)+'">✏️ تعديل</button>':'')+'<button class="btn btn-outline market-delete-btn" data-delete="'+esc(p.id)+'">🗑️ حذف</button>'+(p.status==="approved"?'<button class="btn btn-outline" data-sold="'+esc(p.id)+'">تم البيع</button>':p.status==="sold"?'<button class="btn btn-outline" data-relist="'+esc(p.id)+'">إعادة العرض</button>':"")+'</div>'+promoButton+'</div></article>';
 }).join("");
}
async function loadPaymentHistory(){
 const host=$("#marketPaymentHistory");if(!host)return;
 if(!currentUser){host.innerHTML='<p class="market-muted">سجّل دخولك حتى تشوف طلبات الدفع.</p>';return;}
 const {data,error}=await db.from("market_payments").select("id,kind,package_code,amount_iqd,duration_days,status,transaction_reference,created_at").eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(30);
 if(error){host.innerHTML='<p class="market-muted">تعذر تحميل سجل الدفع.</p>';return;}
 if(!data?.length){host.innerHTML='<p class="market-muted">ما عندك طلبات دفع لحد الآن.</p>';return;}
 host.innerHTML=data.map(p=>'<article class="market-payment-item"><div><b>'+(p.kind==="promotion"?"ترويج إعلان":"اشتراك محل")+'</b><br><small>'+esc(p.amount_iqd.toLocaleString("ar-IQ"))+' د.ع · '+esc(p.duration_days)+' يوم · مرجع '+esc(p.transaction_reference)+'</small><br><span class="market-payment-state '+esc(p.status)+'">'+(p.status==="approved"?"تم التأكيد":p.status==="rejected"?"مرفوض":"بانتظار التحقق")+'</span></div><small>'+esc(new Date(p.created_at).toLocaleDateString("ar-IQ"))+'</small></article>').join("");
}
async function loadPaymentInstructions(method){
 const host=$("#marketPayInstructions");if(!host)return;
 if(!paymentSettings){const {data,error}=await db.from("market_payment_settings").select("zain_cash_account,super_qi_account,other_instructions,support_phone").eq("id",true).maybeSingle();if(error){host.textContent="تعذر تحميل بيانات الاستلام. حاول تحديث الصفحة.";return;}paymentSettings=data||{};}
 const key=method==="zain_cash"?"zain_cash_account":method==="super_qi"?"super_qi_account":"other_instructions";
 const label=method==="zain_cash"?"زين كاش":method==="super_qi"?"سوبر كي":"طريقة أخرى";
 const value=String(paymentSettings[key]||"").trim();
 host.textContent=(value?"بيانات الاستلام عبر "+label+": "+value:"إدارة سوملي ما ضافت بيانات الاستلام عبر "+label+" بعد. لا تحوّل فلوس قبل ما تظهر البيانات الرسمية.")+(paymentSettings.support_phone?" — للاستفسار: "+paymentSettings.support_phone:"");
}
function startPromotion(listingId){
 if(!currentUser){resumeSellAfterAuth=false;authModeSet("login");open("authMarketDialog");$("#marketAuthMessage").textContent="سجّل دخولك حتى تطلب ترويج الإعلان.";return;}
 const p=listings.find(x=>x.id===listingId);
 if(!p){toast("حدّث الصفحة وحاول مرة ثانية.");return;}
 $("#marketPayForm").reset();$("#marketPayForm").elements.listing_id.value=listingId;$("#marketPayMessage").textContent="الترويج يتفعّل بعد مراجعة الإدارة والتحقق من رقم العملية.";open("marketPayDialog");loadPaymentInstructions($("#marketPayForm").elements.payment_method.value);
}
function startSell(){if(!currentUser){resumeSellAfterAuth=true;authModeSet("login");open("authMarketDialog");$("#marketAuthMessage").textContent="سجّل دخولك أو أنشئ حساب حتى تنشر منتجك.";return;}$("#sellForm").reset();$("#sellForm").elements.listing_id.value="";$("#sellDialogTitle").textContent="أضف إعلان جديد";$("#sellSubmit").textContent="نشر الإعلان";$("#marketImages").required=true;$("#marketPreview").innerHTML="";$("#sellMessage").textContent="";open("sellDialog");}
function startEditListing(p){if(!currentUser||p.seller_id!==currentUser.id){toast("تقدر تعدّل إعلانات حسابك فقط.");return;}const f=$("#sellForm");f.reset();f.elements.listing_id.value=p.id;f.elements.title.value=p.title||"";f.elements.category.value=p.category||"أخرى";f.elements.condition.value=p.condition||"مستعمل";f.elements.price_iqd.value=p.price_iqd??"";f.elements.governorate.value=p.governorate||"";f.elements.description.value=p.description||"";f.elements.seller_name.value=p.seller_name||"";f.elements.phone.value=p.phone||"";$("#sellDialogTitle").textContent="تعديل الإعلان";$("#sellSubmit").textContent="حفظ التعديلات";$("#marketImages").required=false;$("#marketPreview").innerHTML=(p.image_urls||[]).map(url=>{const img=document.createElement("img");img.alt="الصورة الحالية";img.src=url;return img.outerHTML;}).join("");$("#sellMessage").textContent="اترك اختيار الصور فارغاً حتى تبقى الصور الحالية، أو اختار صوراً جديدة لاستبدالها.";open("sellDialog");}
$("#marketImages").addEventListener("change",()=>{const files=[...$("#marketImages").files];$("#marketPreview").innerHTML="";if(files.length>5){$("#sellMessage").textContent="اختار 5 صور أو أقل.";$("#marketImages").value="";return;}for(const file of files){if(file.size>5*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type)){ $("#sellMessage").textContent="كل صورة لازم تكون JPG أو PNG أو WEBP وحجمها أقل من 5 ميگابايت.";$("#marketImages").value="";$("#marketPreview").innerHTML="";return;}const img=document.createElement("img");img.alt="معاينة الصورة";img.src=URL.createObjectURL(file);$("#marketPreview").append(img);}$("#sellMessage").textContent=files.length?("تم اختيار "+files.length+" صورة."): "اختار صورة واضحة للمنتج.";});
$("#sellForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!currentUser){startSell();return;}
 const form=e.currentTarget,fd=new FormData(form),files=[...$("#marketImages").files],btn=$("#sellSubmit"),editingId=String(fd.get("listing_id")||"").trim();
 if(files.length>5){$("#sellMessage").textContent="الحد الأعلى 5 صور.";return;}
 if(!editingId&&files.length<1){$("#sellMessage").textContent="لازم تضيف صورة وحدة على الأقل حتى يبين المنتج للمشتري.";return;}
 for(const f of files){if(f.size>5*1024*1024||!["image/jpeg","image/png","image/webp"].includes(f.type)){$("#sellMessage").textContent="كل صورة لازم تكون JPG أو PNG أو WEBP وحجمها أقل من 5 ميگابايت.";return;}}
 const phone=String(fd.get("phone")||"").trim();if(!/^[0-9+() -]{7,20}$/.test(phone)){$("#sellMessage").textContent="تأكد من رقم الهاتف.";return;}
 const title=String(fd.get("title")||"").trim(),sellerName=String(fd.get("seller_name")||"").trim(),priceText=String(fd.get("price_iqd")||"").trim();
 if(!title||!sellerName){$("#sellMessage").textContent="اكتب اسم المنتج واسم البائع.";return;}
 btn.disabled=true;btn.textContent=editingId?"جاري حفظ التعديلات...":"جاري نشر الإعلان...";$("#sellMessage").textContent="انتظر شوي، دا نحفظ البيانات.";
 let uploaded=[];
 try{
  let listingId=editingId, existing=null;
  if(editingId){existing=listings.find(p=>p.id===editingId);if(!existing){const {data,error}=await db.from("market_listings").select("id,seller_id,image_urls,status").eq("id",editingId).eq("seller_id",currentUser.id).maybeSingle();if(error)throw error;if(!data)throw new Error("الإعلان غير موجود أو ما عندك صلاحية تعديله.");existing=data;}if(existing.seller_id&&existing.seller_id!==currentUser.id)throw new Error("ما عندك صلاحية تعديل هذا الإعلان.");}
  else listingId=crypto.randomUUID();
  if(files.length){for(let i=0;i<files.length;i++){const f=files[i],ext=f.type==="image/jpeg"?"jpg":f.type==="image/png"?"png":"webp";const path=currentUser.id+"/"+listingId+"/"+(i+1)+"-"+Date.now()+"."+ext;const {error:upErr}=await db.storage.from("somli-market-images").upload(path,f,{contentType:f.type,upsert:false});if(upErr)throw upErr;uploaded.push(db.storage.from("somli-market-images").getPublicUrl(path).data.publicUrl);}}
  const payload={seller_id:currentUser.id,seller_name:sellerName,phone,title,description:String(fd.get("description")||"").trim(),category:fd.get("category"),governorate:fd.get("governorate"),condition:fd.get("condition"),price_iqd:priceText===""?null:Number(priceText),image_urls:uploaded.length?uploaded:(existing?.image_urls||[]),status:editingId?(existing?.status||"approved"):"approved"};
  let result;
  if(editingId)result=await db.from("market_listings").update(payload).eq("id",editingId).eq("seller_id",currentUser.id);
  else result=await db.from("market_listings").insert({id:listingId,...payload});
  if(result.error)throw result.error;
  close("sellDialog");toast(editingId?"تم حفظ تعديلات الإعلان.":"تم نشر إعلانك بنجاح.");await loadListings();await loadMyListings();
 }catch(err){console.error("market save error",err.message);$("#sellMessage").textContent="تعذر حفظ الإعلان: "+(err.message||"حاول مرة ثانية.");}
 finally{btn.disabled=false;btn.textContent=editingId?"حفظ التعديلات":"نشر الإعلان";}
});
function showDetail(id){const p=listings.find(x=>x.id===id);if(!p)return;$("#detailTitle").textContent=p.title;$("#detailImages").innerHTML=(p.image_urls||[]).map(u=>'<img src="'+esc(u)+'" alt="'+esc(p.title)+'">').join("");$("#detailBody").innerHTML='<p class="market-price">'+esc(money(p.price_iqd))+'</p><p><b>الفئة:</b> '+esc(p.category)+' · <b>الحالة:</b> '+esc(p.condition)+'</p><p><b>المحافظة:</b> '+esc(p.governorate)+'</p><p><b>البائع:</b> '+esc(p.seller_name)+'</p><p style="white-space:pre-wrap;line-height:1.9">'+esc(p.description||"ماكو تفاصيل إضافية.")+'</p><p><b>رقم التواصل:</b> '+esc(p.phone)+'</p><a class="btn btn-primary btn-full" href="tel:'+esc(p.phone)+'">اتصل بالبائع</a><p class="market-notice">نصيحة: افحص المنتج بنفسك ولا تحول فلوس مقدماً لشخص ما تعرفه.</p>';open("detailDialog");}
$("#marketGrid").addEventListener("click",e=>{const el=e.target.closest("[data-detail]");if(el)showDetail(el.dataset.detail);});
$("#marketGrid").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches(".market-card-img[data-detail]")){e.preventDefault();showDetail(e.target.dataset.detail);}});
$("#myListings").addEventListener("click",async e=>{
 const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]"),sold=e.target.closest("[data-sold]"),relist=e.target.closest("[data-relist]"),promote=e.target.closest("[data-promote]");
 if(edit){const p=listings.find(x=>x.id===edit.dataset.edit);if(!p){toast("حدّث الصفحة وحاول مرة ثانية.");return;}startEditListing(p);return;}
 if(del){const id=del.dataset.delete;if(!confirm("متأكد تريد تحذف الإعلان نهائياً؟ هذا الإجراء ما يتراجع."))return;del.disabled=true;const {data,error}=await db.from("market_listings").delete().eq("id",id).eq("seller_id",currentUser.id).select("id,image_urls").maybeSingle();if(error){toast("تعذر حذف الإعلان: "+error.message);del.disabled=false;return;}if(!data){toast("ما تم حذف الإعلان. تأكد من تسجيل الدخول وصلاحية الحساب.");del.disabled=false;return;}const paths=(data.image_urls||[]).map(url=>{try{const u=new URL(url),marker="/storage/v1/object/public/somli-market-images/";const i=u.pathname.indexOf(marker);return i>=0?decodeURIComponent(u.pathname.slice(i+marker.length)):null;}catch{return null;}}).filter(Boolean).filter(path=>path.startsWith(currentUser.id+"/"));if(paths.length)await db.storage.from("somli-market-images").remove(paths);toast("تم حذف الإعلان.");await loadMyListings();await loadListings();return;}
 if(promote){startPromotion(promote.dataset.promote);return;}
 const btn=sold||relist;if(!btn)return;const status=sold?"sold":"approved";btn.disabled=true;const {error}=await db.from("market_listings").update({status}).eq("id",btn.dataset.sold||btn.dataset.relist).eq("seller_id",currentUser.id);if(error)toast("تعذر تحديث الإعلان: "+error.message);else{toast(status==="sold"?"تم تعليم الإعلان كمباع.":"تمت إعادة عرض الإعلان.");await loadMyListings();await loadListings();}
});
$("#marketAuthBtn").addEventListener("click",async()=>{if(currentUser){if(confirm("تريد تسجل خروجك من سوملي؟")){await db.auth.signOut();await getSession();toast("تم تسجيل الخروج.");}return;}authModeSet("login");open("authMarketDialog");});
$("#marketAuthToggle").addEventListener("click",()=>authModeSet(authMode==="login"?"signup":"login"));
$("#marketAuthForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,fd=new FormData(f),btn=$("#marketAuthSubmit");btn.disabled=true;try{if(authMode==="signup"){const {data,error}=await db.auth.signUp({email:String(fd.get("email")).trim(),password:String(fd.get("password")),options:{data:{full_name:String(fd.get("full_name")||"").trim()}}});if(error)throw error;if(!data.session){$("#marketAuthMessage").textContent="تم التسجيل. افتح بريدك الإلكتروني لتأكيد الحساب، وبعدها سجّل دخولك.";return;}currentUser=data.user;}else{const {data,error}=await db.auth.signInWithPassword({email:String(fd.get("email")).trim(),password:String(fd.get("password"))});if(error)throw error;currentUser=data.user;}const fullName=currentUser.user_metadata?.full_name||currentUser.email?.split("@")[0]||"مستخدم سوملي";await db.from("profiles").upsert({id:currentUser.id,full_name:fullName},{onConflict:"id"});close("authMarketDialog");await getSession();toast("تم تسجيل الدخول.");if(resumeSellAfterAuth){resumeSellAfterAuth=false;startSell();}}catch(err){$("#marketAuthMessage").textContent=err.message||"تعذر تسجيل الدخول."; }finally{btn.disabled=false;}});

$("#marketPayForm").elements.payment_method.addEventListener("change",e=>loadPaymentInstructions(e.target.value));
$("#marketPayForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!currentUser)return;
 const fd=new FormData(e.currentTarget),code=String(fd.get("package_code")),listingId=String(fd.get("listing_id")),method=String(fd.get("payment_method")),reference=String(fd.get("transaction_reference")||"").trim(),note=String(fd.get("note")||"").trim();
 const prices={boost_3d:{amount:2000,days:3},boost_7d:{amount:4000,days:7}};const pack=prices[code];if(!pack||reference.length<3)return;
 const btn=$("#marketPaySubmit");btn.disabled=true;btn.textContent="جاري إرسال الطلب...";
 try{const {error}=await db.from("market_payments").insert({user_id:currentUser.id,kind:"promotion",listing_id:listingId,package_code:code,amount_iqd:pack.amount,duration_days:pack.days,payment_method:method,transaction_reference:reference,note,status:"pending"});if(error)throw error;close("marketPayDialog");toast("وصل طلب الترويج للإدارة. راح يتفعّل بعد التحقق من التحويل.");await loadPaymentHistory();}catch(err){$("#marketPayMessage").textContent="تعذر إرسال الطلب: "+(err.message||"حاول مرة ثانية.");}finally{btn.disabled=false;btn.textContent="إرسال طلب الترويج";}
});

$("#marketSearch").addEventListener("input",renderListings);$("#marketGov").addEventListener("change",renderListings);$("#marketCategory").addEventListener("change",renderListings);$("#marketSort").addEventListener("change",renderListings);$("#marketMinPrice").addEventListener("input",renderListings);$("#marketMaxPrice").addEventListener("input",renderListings);$("#marketClearFilters").addEventListener("click",()=>{$("#marketSearch").value="";$("#marketGov").value="";$("#marketCategory").value="";$("#marketSort").value="newest";$("#marketMinPrice").value="";$("#marketMaxPrice").value="";renderListings();});
["sellOpenTop","sellOpenHero","sellOpenList"].forEach(id=>$("#"+id).addEventListener("click",startSell));
$("#myListingsReload").addEventListener("click",async()=>{await getSession();toast("تم تحديث إعلاناتك.");});
document.querySelectorAll("[data-close-market]").forEach(b=>b.addEventListener("click",()=>close(b.dataset.closeMarket)));
document.querySelectorAll(".market-modal").forEach(d=>d.addEventListener("click",e=>{if(e.target===d)d.close();}));
$("#marketYear").textContent=new Date().getFullYear();
(async()=>{try{await getSession();await loadListings();if(new URLSearchParams(location.search).get("sell")==="1")startSell();}catch(e){console.error(e);$("#marketGrid").innerHTML='<div class="market-empty">تعذر الاتصال بالسوق حالياً. حدّث الصفحة وجرب مرة ثانية.</div>';}})();
