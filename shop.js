const SUPABASE_URL="https://vpducjdkjrbxeosdxvdi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_K9GLIlPYh55utqPq77pgwA_hp3QQYDf";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s);
let user=null,shop=null,categories=[],requests=[],ownQuotes=[],paymentSettings=null;
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function message(t){$("#shopMessage").textContent=t;}
function money(v){return v==null?"السعر عند الطلب":new Intl.NumberFormat("ar-IQ").format(v)+" د.ع";}
async function boot(){
 const {data:{session},error}=await db.auth.getSession(); if(error)throw error;
 user=session?.user||null;
 if(!user){$("#shopIdentity").textContent="غير مسجل الدخول";$("#shopGate").textContent="افتح الموقع الرئيسي وسجّل دخولك، وبعدها ارجع للوحة المحل.";return;}
 const {data:profile,error:pe}=await db.from("profiles").select("full_name,role").eq("id",user.id).maybeSingle();if(pe)throw pe;
 $("#shopIdentity").textContent="الحساب: "+(profile?.full_name||user.email||"مستخدم");
 if(profile?.role!=="shop_owner"){ $("#shopGate").innerHTML="حسابك مو مفعّل كصاحب محل بعد. من الموقع الرئيسي اضغط «أنا صاحب محل» وقدّم طلب التسجيل. بعد موافقة الإدارة، افتح هذه الصفحة من جديد.";return;}
 const {data:shops,error:se}=await db.from("shops").select("id,name,status,governorate").eq("owner_id",user.id).limit(1);
 if(se)throw se;shop=shops?.[0]||null;
 if(!shop||shop.status!=="approved"){ $("#shopGate").textContent="طلب المحل قيد المراجعة أو يحتاج مراجعة الإدارة.";return;}
 $("#shopIdentity").textContent=shop.name+" · "+shop.governorate+" · محل معتمد";
 $("#shopGate").classList.add("shop-hidden");$("#shopWorkspace").classList.remove("shop-hidden");
 await Promise.all([loadCategories(),loadProducts(),loadRequests(),loadSubscription(),loadPreparedImages()]);
}

async function loadShopPaymentInstructions(method){
 const host=$("#shopPaymentInstructions");if(!host)return;
 if(!paymentSettings){const {data,error}=await db.from("market_payment_settings").select("zain_cash_account,super_qi_account,other_instructions,support_phone").eq("id",true).maybeSingle();if(error){host.textContent="تعذر تحميل بيانات الاستلام.";return;}paymentSettings=data||{};}
 const key=method==="zain_cash"?"zain_cash_account":method==="super_qi"?"super_qi_account":"other_instructions";
 const label=method==="zain_cash"?"زين كاش":method==="super_qi"?"سوبر كي":"طريقة أخرى";
 const value=String(paymentSettings[key]||"").trim();
 host.textContent=(value?"بيانات الاستلام عبر "+label+": "+value:"الإدارة ما ضافت بيانات الاستلام عبر "+label+" بعد. لا تحوّل فلوس قبل ما تظهر البيانات الرسمية.")+(paymentSettings.support_phone?" — للاستفسار: "+paymentSettings.support_phone:"");
}
async function loadPreparedImages(){
 const panel=$("#preparedImagesPanel"),host=$("#preparedImages");
 if(!panel||!host||!user||!shop)return;
 const {data:apps,error:appError}=await db.from("seller_applications").select("id").eq("user_id",user.id).eq("status","approved").order("created_at",{ascending:false}).limit(1);
 if(appError)throw appError;
 const application=apps?.[0];
 if(!application){panel.classList.add("shop-hidden");return;}
 const {data:images,error:imageError}=await db.from("seller_application_images").select("id,storage_path,original_name").eq("application_id",application.id).order("created_at",{ascending:true});
 if(imageError)throw imageError;
 if(!images?.length){panel.classList.add("shop-hidden");return;}
 const prepared=await Promise.all(images.map(async image=>{
  const {data,error}=await db.storage.from("somli-pending-images").createSignedUrl(image.storage_path,600);
  return {...image,signedUrl:error?"":(data?.signedUrl||"")};
 }));
 host.innerHTML=prepared.map(image=>{
  if(!image.signedUrl)return '<span class="shop-muted">تعذر فتح الصورة '+esc(image.original_name)+'</span>';
  const downloadUrl=image.signedUrl+(image.signedUrl.includes("?")?"&":"?")+"download="+encodeURIComponent(image.original_name||"somli-image");
  return '<a href="'+esc(downloadUrl)+'" target="_blank" rel="noopener noreferrer"><img src="'+esc(image.signedUrl)+'" alt="'+esc(image.original_name)+'" loading="lazy"><span>تنزيل · '+esc(image.original_name)+'</span></a>';
 }).join("");
 panel.classList.remove("shop-hidden");
}

async function loadSubscription(){
 const {data:sub,error}=await db.from("shop_subscriptions").select("starts_at,ends_at,status").eq("shop_id",shop.id).maybeSingle();
 if(error)throw error;
 const active=sub&&sub.status==="active"&&new Date(sub.ends_at)>new Date();
 await loadShopPaymentInstructions($("#shopSubscriptionForm").elements.payment_method.value);
 $("#shopPlanStatus").textContent=active?"اشتراكك الاحترافي فعّال لغاية "+new Date(sub.ends_at).toLocaleDateString("ar-IQ"):"حسابك حالياً على الباقة المجانية.";
 const {data:payments,error:pError}=await db.from("market_payments").select("id,amount_iqd,status,transaction_reference,created_at").eq("user_id",user.id).eq("kind","shop_subscription").order("created_at",{ascending:false}).limit(10);
 const host=$("#shopPaymentHistory");
 if(pError){host.textContent="تعذر تحميل طلبات الاشتراك.";return;}
 if(!payments?.length){host.innerHTML='<p class="shop-muted">ماكو طلبات اشتراك سابقة.</p>';return;}
 host.innerHTML=payments.map(p=>'<div class="shop-payment-row"><span><b>'+new Intl.NumberFormat("ar-IQ").format(p.amount_iqd)+' د.ع</b><br><small>مرجع: '+esc(p.transaction_reference)+'</small></span><span><b>'+(p.status==="approved"?"تم التأكيد":p.status==="rejected"?"مرفوض":"بانتظار التحقق")+'</b><br><small>'+new Date(p.created_at).toLocaleDateString("ar-IQ")+'</small></span></div>').join("");
}
$("#shopSubscriptionForm").elements.payment_method.addEventListener("change",e=>loadShopPaymentInstructions(e.target.value));
$("#shopSubscriptionForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!user||!shop)return;
 const fd=new FormData(e.currentTarget),reference=String(fd.get("transaction_reference")||"").trim(),method=String(fd.get("payment_method")),note=String(fd.get("note")||"").trim();
 if(reference.length<3){message("اكتب رقم العملية حتى نرسل الطلب.");return;}
 const btn=$("#shopSubscriptionSubmit");btn.disabled=true;btn.textContent="جاري إرسال طلب الاشتراك...";
 try{const {error}=await db.from("market_payments").insert({user_id:user.id,kind:"shop_subscription",shop_id:shop.id,package_code:"shop_pro_30d",amount_iqd:15000,duration_days:30,payment_method:method,transaction_reference:reference,note,status:"pending"});if(error)throw error;message("وصل طلب الاشتراك للإدارة. يتفعّل بعد التحقق من التحويل.");await loadSubscription();}
 catch(err){message("تعذر إرسال طلب الاشتراك: "+(err.message||"حاول مرة ثانية."));}
 finally{btn.disabled=false;btn.textContent="طلب اشتراك 30 يوم — 15,000 د.ع";}
});

async function loadCategories(){
 const {data,error}=await db.from("categories").select("id,name_ar").order("name_ar");if(error)throw error;categories=data||[];
 $("#shopCategory").innerHTML='<option value="">اختار الفئة</option>'+categories.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name_ar)+'</option>').join("");
}
async function loadProducts(){
 $("#shopProducts").innerHTML='<p class="shop-muted">جاري تحميل المنتجات...</p>';
 const {data,error}=await db.from("products").select("id,name,price_iqd,status,created_at,categories(name_ar)").eq("shop_id",shop.id).order("created_at",{ascending:false});
 if(error)throw error;
 if(!data?.length){$("#shopProducts").innerHTML='<div class="shop-note">بعد ما ضفت منتجات. ابدأ بأول منتج من النموذج.</div>';return;}
 $("#shopProducts").innerHTML=data.map(p=>'<article class="shop-product"><strong>'+esc(p.name)+'</strong><div>'+esc(money(p.price_iqd))+'</div><small>الفئة: '+esc(p.categories?.name_ar||"أخرى")+' · الحالة: '+esc(p.status==="approved"?"منشور":p.status==="pending"?"بانتظار المراجعة":"مرفوض")+' · '+esc(new Date(p.created_at).toLocaleDateString("ar-IQ"))+'</small></article>').join("");
}
async function loadRequests(){
 const host=$("#shopRequests");
 host.innerHTML='<p class="shop-muted">جاري تحميل طلبات الزبائن...</p>';
 const [rq,oq]=await Promise.all([
  db.from("quote_requests").select("id,phone,details,quantity,governorate,created_at,product_id").eq("status","open").order("created_at",{ascending:false}).limit(100),
  db.from("quotes").select("request_id,price_iqd,details,created_at").eq("shop_id",shop.id)
 ]);
 if(rq.error)throw rq.error;
 if(oq.error)throw oq.error;
 requests=rq.data||[];ownQuotes=oq.data||[];
 renderRequests();
}
function renderRequests(){
 const host=$("#shopRequests");
 if(!requests.length){host.innerHTML='<div class="shop-note">ماكو طلبات أسعار مفتوحة حالياً. ارجع حدّث القائمة بعدين.</div>';return;}
 host.innerHTML=requests.map(r=>{
  const sent=ownQuotes.find(q=>q.request_id===r.id);
  const phone=String(r.phone||"").trim();
  const phoneLine=phone?'<a href="tel:'+esc(phone)+'">'+esc(phone)+'</a>':'<span>الزبون ما أضاف رقم هاتف</span>';
  const offer=sent
   ? '<div class="shop-note">أرسلت عرضاً لهذا الطلب: <strong>'+esc(money(sent.price_iqd))+'</strong><br>'+esc(sent.details||"بدون تفاصيل إضافية")+'</div>'
   : '<form class="quoteOfferForm" data-request="'+esc(r.id)+'"><label>السعر المقترح بالدينار العراقي<input name="price_iqd" type="number" min="1" step="250" required placeholder="مثلاً 25000"></label><label>كلفة التوصيل (د.ع)<input name="delivery_cost" type="number" min="0" step="500" placeholder="0 إذا التوصيل مجاني أو اتركه غير محدد"></label><label>الضمان<input name="warranty" maxlength="160" placeholder="مثلاً: ضمان محل 3 أشهر أو بدون ضمان"></label><label>مدة التجهيز والتوصيل<input name="delivery_time" maxlength="120" placeholder="مثلاً: تجهيز بنفس اليوم، توصيل خلال 24 ساعة"></label><label>تفاصيل إضافية<textarea name="details" rows="2" maxlength="500" placeholder="المواصفات، اللون، شروط العرض..."></textarea></label><button class="btn btn-primary btn-full" type="submit">إرسال عرض السعر</button></form>';
  return '<article class="shop-product"><strong>طلب سعر · '+esc(r.governorate||"المحافظة غير محددة")+'</strong><p>'+esc(r.details||"طلب سعر")+'</p><p>الكمية: <b>'+esc(r.quantity||1)+'</b></p><p>رقم الزبون: <b>'+phoneLine+'</b></p><small>تاريخ الطلب: '+esc(new Date(r.created_at).toLocaleString("ar-IQ"))+'</small>'+offer+'</article>';
 }).join("");
}
$("#shopRequests").addEventListener("submit",async e=>{
 const form=e.target.closest(".quoteOfferForm");if(!form)return;
 e.preventDefault();if(!shop||!user)return;
 const fd=new FormData(form),requestId=form.dataset.request,price=Number(fd.get("price_iqd")),extra=String(fd.get("details")||"").trim(),deliveryRaw=String(fd.get("delivery_cost")||"").trim(),warranty=String(fd.get("warranty")||"").trim(),deliveryTime=String(fd.get("delivery_time")||"").trim();
 const details=[deliveryRaw!==""?"كلفة التوصيل: "+(Number(deliveryRaw)===0?"مجاني":new Intl.NumberFormat("ar-IQ").format(Number(deliveryRaw))+" د.ع"):"كلفة التوصيل: غير محددة", "الضمان: "+(warranty||"غير محدد"),"مدة التجهيز والتوصيل: "+(deliveryTime||"غير محددة"),extra?"تفاصيل إضافية: "+extra:""].filter(Boolean).join("\n");
 if(!Number.isFinite(price)||price<1||price>1000000000){message("اكتب سعر صحيح بين 1 و1,000,000,000 دينار.");return;}
 if(deliveryRaw!==""&&(!Number.isFinite(Number(deliveryRaw))||Number(deliveryRaw)<0||Number(deliveryRaw)>1000000000)){message("كلفة التوصيل لازم تكون صفر أو أكثر، وبحد أقصى مليار دينار.");return;}
 if(extra.length>1000||warranty.length>200||deliveryTime.length>200){message("اختصر التفاصيل الإضافية والضمان ومدة التوصيل.");return;}
 const btn=form.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="جاري إرسال العرض...";
 try{
  const {error}=await db.from("quotes").insert({request_id:requestId,shop_id:shop.id,price_iqd:Math.round(price),details:details||null});
  if(error)throw error;
  message("تم إرسال عرض السعر بنجاح.");
  await loadRequests();
 }catch(err){message("تعذر إرسال العرض: "+(err.message||"حاول مرة ثانية."));}
 finally{if(btn.isConnected){btn.disabled=false;btn.textContent="إرسال عرض السعر";}}
});

$("#productForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!shop||!user)return;
 const form=e.currentTarget,fd=new FormData(form),btn=$("#shopSubmit"),file=fd.get("image");
 if(file&&file.size>5*1024*1024){message("حجم الصورة أكبر من 5 ميگابايت.");return;}
 if(file&&file.size&&!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)){message("صيغة الصورة غير مدعومة.");return;}
 btn.disabled=true;btn.textContent="جاري الحفظ...";
 try{
  const price=String(fd.get("price_iqd")||"").trim();
  const {data:product,error}=await db.from("products").insert({shop_id:shop.id,category_id:fd.get("category_id"),name:String(fd.get("name")||"").trim(),description:String(fd.get("description")||"").trim()||null,price_iqd:price?Number(price):null,governorate:fd.get("governorate"),status:"pending"}).select("id").single();
  if(error)throw error;
  if(file&&file.size){
   const ext=({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/avif":"avif"})[file.type]||"jpg";
   const path=user.id+"/"+product.id+"-"+Date.now()+"."+ext;
   const {error:uploadError}=await db.storage.from("somli-product-images").upload(path,file,{contentType:file.type,upsert:false});
   if(uploadError)throw new Error("انحفظ المنتج لكن فشل رفع الصورة: "+uploadError.message);
   const {data:{publicUrl}}=db.storage.from("somli-product-images").getPublicUrl(path);
   const {error:imageError}=await db.from("product_images").insert({product_id:product.id,image_url:publicUrl,sort_order:0});
   if(imageError)throw new Error("انحفظ المنتج لكن تعذر ربط الصورة: "+imageError.message);
  }
  form.reset();message("تم إرسال المنتج للمراجعة. راح يظهر بالموقع بعد موافقة الإدارة.");await loadProducts();
 }catch(err){message("تعذر حفظ المنتج: "+(err.message||"حاول مرة ثانية."));}
 finally{btn.disabled=false;btn.textContent="إرسال للمراجعة";}
});
$("#shopReload").addEventListener("click",async()=>{try{await Promise.all([loadProducts(),loadRequests()]);message("تم تحديث المنتجات وطلبات الزبائن.");}catch(e){message("تعذر التحديث: "+e.message);}});
$("#shopLogout").addEventListener("click",async()=>{await db.auth.signOut();location.href="./";});
(async()=>{try{await boot();}catch(e){message("تعذر فتح لوحة المحل: "+(e.message||"خطأ غير معروف"));}})();