const SUPABASE_URL="https://vpducjdkjrbxeosdxvdi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_K9GLIlPYh55utqPq77pgwA_hp3QQYDf";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s);
let user=null, activeConversation=null, channel=null, toastTimer=null, conversations=[];
const params=new URLSearchParams(location.search);
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3500);}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function contextLabel(c){return c.products?.name||c.market_listings?.title||(c.product_id?"محادثة حول منتج":"محادثة حول إعلان");}
function participantOther(c){return c.buyer_id===user.id?c.seller_id:c.buyer_id;}
async function startFromContext(){
 const productId=params.get("product"), listingId=params.get("listing");
 if(!productId&&!listingId)return;
 let sellerId,title,context={};
 if(productId){
  const {data,error}=await db.from("products").select("id,name,status,shop_id,shops(owner_id,status)").eq("id",productId).maybeSingle();
  if(error||!data||data.status!=="approved"||data.shops?.status!=="approved"){toast("المنتج غير متاح للمراسلة حالياً.");return;}
  sellerId=data.shops.owner_id;title=data.name;context.product_id=productId;
 }else{
  const {data,error}=await db.from("market_listings").select("id,title,status,seller_id").eq("id",listingId).maybeSingle();
  if(error||!data||data.status!=="approved"){toast("الإعلان غير متاح للمراسلة حالياً.");return;}
  sellerId=data.seller_id;title=data.title;context.listing_id=listingId;
 }
 if(!sellerId||sellerId===user.id){toast("ما تكدر تفتح محادثة ويا حسابك.");return;}
 let q=db.from("conversations").select("id,buyer_id,seller_id,product_id,listing_id,last_message_at,products(name),market_listings(title)").eq("buyer_id",user.id).eq("seller_id",sellerId);
 q=productId?q.eq("product_id",productId):q.eq("listing_id",listingId);
 let {data:found}=await q.maybeSingle();
 if(!found){
  const {data,error}=await db.from("conversations").insert({buyer_id:user.id,seller_id:sellerId,...context}).select("id,buyer_id,seller_id,product_id,listing_id,last_message_at").single();
  if(error){
   let retry=db.from("conversations").select("id,buyer_id,seller_id,product_id,listing_id,last_message_at,products(name),market_listings(title)").eq("buyer_id",user.id).eq("seller_id",sellerId);
   retry=productId?retry.eq("product_id",productId):retry.eq("listing_id",listingId);
   const again=await retry.maybeSingle();found=again.data;
   if(!found){console.error("start chat",error.message);toast("تعذر فتح المحادثة. تأكد من تسجيل الدخول وحالة الإعلان.");return;}
  }else found=data;
 }
 if(found&&!found.products&&!found.market_listings){if(productId)found.products={name:title};else found.market_listings={title};}
 await loadConversations();
 if(found)openConversation(found.id);
}
async function loadConversations(){
 const {data,error}=await db.from("conversations").select("id,buyer_id,seller_id,product_id,listing_id,last_message_at,products(name),market_listings(title)").or("buyer_id.eq."+user.id+",seller_id.eq."+user.id).order("last_message_at",{ascending:false}).limit(100);
 if(error){console.error(error.message);$("#conversationList").innerHTML='<div class="empty">تعذر تحميل المحادثات. حدّث الصفحة وحاول مرة ثانية.</div>';return;}
 conversations=data||[];
 const list=$("#conversationList");list.replaceChildren();
 if(!conversations.length){list.innerHTML='<div class="empty">ما عندك محادثات بعد.<br>افتح منتج أو إعلان واضغط «مراسلة البائع».</div>';return;}
 for(const c of conversations){
  const b=document.createElement("button");b.type="button";b.className="conv-item"+(c.id===activeConversation?" active":"");
  const title=document.createElement("strong");title.textContent=contextLabel(c);
  const small=document.createElement("small");small.textContent="آخر نشاط: "+new Date(c.last_message_at).toLocaleString("ar-IQ");
  b.append(title,small);b.addEventListener("click",()=>openConversation(c.id));list.appendChild(b);
 }
}
async function openConversation(id){
 const c=conversations.find(x=>x.id===id);if(!c)return;
 activeConversation=id;
 const title=contextLabel(c),other=participantOther(c);
 $("#chatHeader").replaceChildren();
 const box=document.createElement("div"),h=document.createElement("h2"),small=document.createElement("small");
 h.textContent=title;small.textContent="محادثة خاصة • "+(c.buyer_id===user.id?"أنت المشتري":"أنت البائع");
 box.append(h,small);$("#chatHeader").append(box);
 const list=$("#conversationList");[...list.children].forEach((el,i)=>el.classList.toggle("active",conversations[i]?.id===id));
 if(channel){await db.removeChannel(channel);channel=null;}
 await loadMessages();
 channel=db.channel("somli-chat-"+id).on("postgres_changes",{event:"*",schema:"public",table:"chat_messages",filter:"conversation_id=eq."+id},()=>loadMessages()).subscribe();
}
async function loadMessages(){
 if(!activeConversation)return;
 const {data,error}=await db.from("chat_messages").select("id,conversation_id,sender_id,body,image_path,created_at,deleted_at").eq("conversation_id",activeConversation).order("created_at",{ascending:true}).limit(300);
 if(error){console.error(error.message);$("#messages").innerHTML='<div class="empty">تعذر تحميل الرسائل.</div>';return;}
 const root=$("#messages");root.replaceChildren();
 if(!data?.length){root.innerHTML='<div class="empty">ابدأ المحادثة برسالة واضحة. لا ترسل بيانات حساسة.</div>';return;}
 for(const m of data){
  const bubble=document.createElement("div");bubble.className="msg"+(m.sender_id===user.id?" mine":"");
  if(m.deleted_at){const del=document.createElement("span");del.textContent="تم حذف الرسالة";bubble.append(del);}
  else{
   if(m.body){const body=document.createElement("div");body.textContent=m.body;bubble.append(body);}
   if(m.image_path){const {data:sd,error:se}=await db.storage.from("somli-chat-images").createSignedUrl(m.image_path,900);if(!se&&sd?.signedUrl){const img=document.createElement("img");img.src=sd.signedUrl;img.alt="صورة مرفقة";img.loading="lazy";bubble.append(img);}}
  }
  const time=document.createElement("time");time.textContent=new Date(m.created_at).toLocaleString("ar-IQ");bubble.append(time);root.append(bubble);
 }
 root.scrollTop=root.scrollHeight;
}
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const b=e.currentTarget.querySelector("button");b.disabled=true;$("#loginError").textContent="";const {data,error}=await db.auth.signInWithPassword({email:String(f.get("email")).trim(),password:String(f.get("password"))});b.disabled=false;if(error){$("#loginError").textContent="تعذر تسجيل الدخول. تأكد من البريد وكلمة المرور.";return;}user=data.user;await boot();});
$("#imageFile").addEventListener("change",()=>{$("#imageName").textContent=$("#imageFile").files[0]?.name||"حد الصورة 5 ميغابايت";});
$("#composer").addEventListener("submit",async e=>{
 e.preventDefault();if(!activeConversation){toast("اختار محادثة أولاً.");return;}
 const body=$("#messageBody").value.trim(),file=$("#imageFile").files[0];if(!body&&!file){toast("اكتب رسالة أو أرفق صورة.");return;}
 if(body.length>4000){toast("الرسالة أطول من الحد المسموح.");return;}
 if(file&&(!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)||file.size>5*1024*1024)){toast("الصورة لازم تكون JPEG أو PNG أو WebP أو AVIF وبحجم 5MB أو أقل.");return;}
 const btn=$("#sendButton");btn.disabled=true;let path=null;
 try{
  if(file){const ext=({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/avif":"avif"})[file.type];path=activeConversation+"/"+user.id+"/"+(crypto.randomUUID?crypto.randomUUID():Date.now())+"."+ext;const {error}=await db.storage.from("somli-chat-images").upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;}
  const {error}=await db.from("chat_messages").insert({conversation_id:activeConversation,sender_id:user.id,body,image_path:path});if(error)throw error;
  $("#messageBody").value="";$("#imageFile").value="";$("#imageName").textContent="حد الصورة 5 ميغابايت";await loadMessages();await loadConversations();
 }catch(err){console.error("send chat",err.message);if(path)await db.storage.from("somli-chat-images").remove([path]);toast("تعذر إرسال الرسالة أو الصورة. تحقق من الاتصال وصلاحيات المحادثة.");}
 finally{btn.disabled=false;}
});
async function boot(){
 const {data,error}=await db.auth.getSession();if(error)console.error(error.message);
 if(!user)user=data.session?.user||null;
 if(!user){$("#authPanel").classList.remove("hidden");$("#chatApp").classList.add("hidden");return;}
 $("#authPanel").classList.add("hidden");$("#chatApp").classList.remove("hidden");
 await loadConversations();await startFromContext();
}
db.auth.onAuthStateChange((_event,session)=>{if(session?.user){user=session.user;}});
boot();
