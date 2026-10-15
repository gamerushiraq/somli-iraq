const SUPABASE_URL="https://vpducjdkjrbxeosdxvdi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_K9GLIlPYh55utqPq77pgwA_hp3QQYDf";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s);
let user=null,shop=null,categories=[];
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
 await Promise.all([loadCategories(),loadProducts()]);
}
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
$("#shopReload").addEventListener("click",async()=>{try{await loadProducts();message("تم تحديث قائمة المنتجات.");}catch(e){message("تعذر التحديث: "+e.message);}});
$("#shopLogout").addEventListener("click",async()=>{await db.auth.signOut();location.href="./";});
(async()=>{try{await boot();}catch(e){message("تعذر فتح لوحة المحل: "+(e.message||"خطأ غير معروف"));}})();