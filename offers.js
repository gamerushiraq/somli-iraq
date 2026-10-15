const SUPABASE_URL="https://vpducjdkjrbxeosdxvdi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_K9GLIlPYh55utqPq77pgwA_hp3QQYDf";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>v==null?"السعر عند الطلب":new Intl.NumberFormat("ar-IQ").format(v)+" د.ع";
function parseOfferDetails(raw){const out={delivery:"غير محددة",warranty:"غير محدد",time:"غير محددة",extra:[]};String(raw||"").split("\n").forEach(line=>{const x=line.trim();if(x.startsWith("كلفة التوصيل:"))out.delivery=x.slice("كلفة التوصيل:".length).trim()||"غير محددة";else if(x.startsWith("الضمان:"))out.warranty=x.slice("الضمان:".length).trim()||"غير محدد";else if(x.startsWith("مدة التجهيز والتوصيل:"))out.time=x.slice("مدة التجهيز والتوصيل:".length).trim()||"غير محددة";else if(x.startsWith("تفاصيل إضافية:"))out.extra.push(x.slice("تفاصيل إضافية:".length).trim());else if(x)out.extra.push(x);});return out;}
function status(t,error=false){const el=$("#offersStatus");el.textContent=t;el.classList.toggle("offers-error",error);}
function dateLabel(v){return v?new Date(v).toLocaleString("ar-IQ"):"—";}
function renderRequests(requests,quotes,shops){
 const host=$("#offersRequests");
 if(!requests.length){host.innerHTML='<div class="offers-empty"><div style="font-size:32px">🧾</div><b>بعدك ما عندك طلبات أسعار</b><p>من الموقع الرئيسي اضغط «اطلب سعر» حتى تستلم عروض المحلات هنا.</p><a class="btn btn-primary" href="./">روح للموقع الرئيسي</a></div>';return;}
 host.innerHTML=requests.map(r=>{
  const offers=quotes.filter(q=>q.request_id===r.id).sort((a,b)=>(Number(a.price_iqd)||Infinity)-(Number(b.price_iqd)||Infinity));
  const shopById=new Map(shops.map(s=>[s.id,s]));
  const offerMarkup=offers.length?'<div class="offers-list">'+offers.map((q,i)=>{
   const shop=shopById.get(q.shop_id)||{};
   const lowest=i===0;
   const d=parseOfferDetails(q.details);return '<article class="offer-card '+(lowest?'lowest':'')+'">'+(lowest?'<span class="offer-tag">أقل سعر ضمن العروض</span>':'<span class="offer-tag neutral">عرض من محل</span>')+'<h3>'+esc(shop.name||"محل معتمد")+'</h3><div class="offers-meta">📍 '+esc(shop.governorate||"المحافظة غير محددة")+' · '+esc(dateLabel(q.created_at))+'</div><div class="offer-price">'+esc(money(q.price_iqd))+'</div><div class="offer-facts"><div><span>🚚 كلفة التوصيل</span><b>'+esc(d.delivery)+'</b></div><div><span>🛡️ الضمان</span><b>'+esc(d.warranty)+'</b></div><div><span>⏱️ مدة التجهيز</span><b>'+esc(d.time)+'</b></div></div>'+(d.extra.length?'<div class="offer-details">'+esc(d.extra.join("\n"))+'</div>':'')+'</article>';
  }).join("")+'</div>':'<div class="offers-empty">بعد ما وصلتك عروض لهذا الطلب. المحلات المعتمدة تگدر تشوفه وترد عليك، ارجع حدّث الصفحة لاحقاً.</div>';
  return '<section class="offers-panel"><div class="offers-panel-head"><div><h2>'+esc((r.details||"طلب سعر").split("\n")[0].replace(/^المنتج:\s*/,""))+'</h2><div class="offers-meta">📍 '+esc(r.governorate||"المحافظة غير محددة")+' · الكمية: '+esc(r.quantity||1)+' · '+esc(dateLabel(r.created_at))+'</div></div><span class="offer-tag neutral">'+offers.length+' عرض</span></div><div class="offers-meta" style="margin-top:9px;white-space:pre-line">'+esc(r.details||"")+'</div>'+offerMarkup+'</section>';
 }).join("");
}
async function load(){
 const btn=$("#offersReload");btn.disabled=true;status("دا نحمل طلباتك وعروض المحلات...");
 try{
  const {data:{session},error:sessionError}=await db.auth.getSession();if(sessionError)throw sessionError;
  const user=session?.user;
  if(!user){$("#offersRequests").innerHTML="";status("سجّل دخولك من الموقع الرئيسي بنفس الحساب اللي استخدمته لطلب السعر حتى تشوف عروضك.");return;}
  const {data:requests,error:requestError}=await db.from("quote_requests").select("id,details,governorate,quantity,status,created_at").eq("customer_id",user.id).order("created_at",{ascending:false}).limit(100);
  if(requestError)throw requestError;
  if(!requests?.length){renderRequests([],[],[]);status("تم التحقق من حسابك.");return;}
  const ids=requests.map(r=>r.id);
  const {data:quotes,error:quoteError}=await db.from("quotes").select("id,request_id,shop_id,price_iqd,details,created_at").in("request_id",ids).order("price_iqd",{ascending:true});
  if(quoteError)throw quoteError;
  const shopIds=[...new Set((quotes||[]).map(q=>q.shop_id).filter(Boolean))];
  let shops=[];
  if(shopIds.length){const {data,error}=await db.from("shops").select("id,name,governorate").in("id",shopIds);if(error)throw error;shops=data||[];}
  renderRequests(requests||[],quotes||[],shops);
  status("تم تحميل طلباتك. الأسعار مرتبة من الأرخص للأعلى لكل طلب.");
 }catch(e){console.error("Somli offers page:",e.message);$("#offersRequests").innerHTML='<div class="offers-empty">تعذر تحميل العروض من قاعدة البيانات. قد تكون صلاحيات عرض الطلبات أو العروض بحاجة إلى مراجعة في Supabase.</div>';status("صار خطأ أثناء تحميل العروض: "+(e.message||"حاول مرة ثانية."),true);}
 finally{btn.disabled=false;}
}
$("#offersReload").addEventListener("click",load);
$("#offersYear").textContent=new Date().getFullYear();
load();