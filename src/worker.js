const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const fromB64 = value => Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0));
const db = env => { if (!env.GDOF_DB) throw new Error("Admin database is not configured. Create the GDOF D1 database and add the GDOF_DB binding."); return env.GDOF_DB; };
async function audit(env, actor, action, details = "") {
  try {
    await db(env).prepare("INSERT INTO admin_audit_logs(id,actor_email,action,details) VALUES(?,?,?,?)")
      .bind(crypto.randomUUID(), actor, action, String(details).slice(0,500)).run();
  } catch (error) {
    console.error("Audit log write failed; apply the admin audit log database migration.", error);
  }
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name:"PBKDF2", salt:enc.encode(salt), iterations:100000, hash:"SHA-256" }, key, 256);
  return b64(bits);
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
}
async function makeSession(email, secret) {
  const payload = b64(enc.encode(JSON.stringify({ email, exp: Date.now()+12*60*60*1000 })));
  return payload + "." + await sign(payload, secret);
}
async function sessionEmail(request, env) {
  if (!env.ADMIN_SESSION_SECRET) return null;
  const cookie = request.headers.get("Cookie") || "";
  const token = cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith("gdof_admin="))?.slice(11);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || (await sign(payload, env.ADMIN_SESSION_SECRET)) !== signature) return null;
  try { const data=JSON.parse(new TextDecoder().decode(fromB64(payload))); return data.exp>Date.now()?data.email:null; } catch { return null; }
}
const cookie = value => ({ "Set-Cookie": `gdof_admin=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200` });
const clearCookie = { "Set-Cookie":"gdof_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" };
async function bootstrap(env) {
  const D = db(env);
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return;
  const existing = await D.prepare("SELECT id FROM admins WHERE email = ?").bind(env.ADMIN_EMAIL.toLowerCase()).first();
  if (!existing) {
    const salt=b64(crypto.getRandomValues(new Uint8Array(16)));
    const hash=await passwordHash(env.ADMIN_PASSWORD,salt);
    await D.prepare("INSERT INTO admins (id,email,password_hash,password_salt,active) VALUES (?,?,?,?,1)").bind(crypto.randomUUID(),env.ADMIN_EMAIL.toLowerCase(),hash,salt).run();
  }
}
async function requireAdmin(request, env) {
  const email=await sessionEmail(request,env);
  if (!email) return null;
  const user=await db(env).prepare("SELECT id,email,active,role FROM admins WHERE email=?").bind(email).first();
  return user?.active ? user : null;
}

const PROGRAMS = {
  "food-security-family-support": {label:"Food Security & Family Support",number:"1",query:"food security nutrition school meals agriculture"},
  "education-bursaries": {label:"Education & Bursaries",number:"2",query:"education school access learning"},
  "youth-entrepreneurship": {label:"Youth Entrepreneurship",number:"3",query:"youth entrepreneurship small business livelihoods"},
  "employment-livelihoods": {label:"Employment & Livelihoods",number:"4",query:"employment livelihoods vocational training"},
  "animal-rescue-welfare": {label:"Animal Rescue & Welfare",number:"7",query:"animal welfare rescue veterinary community"},
  "community-development": {label:"Community Development",number:"5",query:"community development water sanitation resilience"},
  "emergency-relief": {label:"Emergency Relief",number:"6",query:"humanitarian emergency relief response"}
};
const storyKey = "program_stories";
async function readStories(D) {
  const row=await D.prepare("SELECT content_value FROM site_content WHERE content_key=?").bind(storyKey).first();
  let values=[]; try { values=JSON.parse(row?.content_value||"[]"); } catch {}
  return Array.isArray(values)?values.map(x=>({...x,status:x.status||(x.published===true?'PUBLISHED':'DRAFT')})):[];
}
async function writeStories(D,stories) {
  await D.prepare("INSERT INTO site_content(content_key,content_value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(content_key) DO UPDATE SET content_value=excluded.content_value,updated_at=CURRENT_TIMESTAMP").bind(storyKey,JSON.stringify(stories)).run();
}
function categorySlugFromStory(story) {
  if (PROGRAMS[story.category_slug]) return story.category_slug;
  const number=String(story.program||"");
  return Object.entries(PROGRAMS).find(([,v])=>v.number===number)?.[0]||"";
}
async function analyzeGrantEligibility(env,item) {
  if(!env.OPENAI_API_KEY) throw new Error("OpenAI is not configured. Add OPENAI_API_KEY to the Worker secrets.");
  const profile={
    legal_name:"Global Development and Opportunity Foundation, Inc. (GDOF)",
    incorporation:"Delaware, United States; incorporated 4 November 2026",
    mission:"International charitable and community development work across food security, education and bursaries, youth entrepreneurship, employment and livelihoods, community development, emergency relief, and animal welfare",
    operating_scope:"Intends to operate internationally, including Kenya and other countries",
    tax_status:"Do not assume IRS 501(c)(3) recognition. Treat tax-exemption status as unconfirmed unless the grant notice or applicant supplies current IRS determination evidence.",
    ein_status:"EIN status must be confirmed by the applicant before relying on it. EIN alone does not establish 501(c)(3) recognition.",
    track_record:"No verified audited financial statements, operating history, prior awards, or programme outcomes have been supplied for this screening. Treat these as unknown, not as proof they do not exist.",
    registration:"Delaware incorporation is known; foreign-country registration, solicitation permissions, and local implementation arrangements are not established by incorporation alone."
  };
  const prompt="You are a cautious US and international nonprofit grant eligibility screening analyst. Research this exact funding opportunity using public web search, prioritising the official funder notice, official application instructions, official eligibility pages and authoritative legal/tax guidance. Opportunity record: "+JSON.stringify({title:item.title,funder:item.funder,source:item.source_name,source_url:item.source_url||item.apply_url,amount:item.amount,deadline:item.deadline,applicant_types:item.applicant_types||item.applicantTypes||null,eligibility_note:item.eligibility_note||null})+". GDOF applicant profile: "+JSON.stringify(profile)+". Assess whether THIS applicant can apply to THIS opportunity, not whether the topic generally matches. Distinguish: confirmed eligible, potentially eligible subject to conditions, likely ineligible, and insufficient evidence. Check legal applicant type, IRS tax status/501(c)(3), EIN if required, US/domestic presence, foreign organisation restrictions, geography/place of performance, registration, fiscal sponsor rules, past performance, matching funds, and deadline/open status where applicable. Never infer eligibility from an EIN alone. If the official notice is missing or inaccessible, lower confidence and say so. Do not invent criteria. Return ONLY valid JSON with keys: score (integer 0-100), verdict (one of 'Potentially eligible','Likely eligible','Likely ineligible','Insufficient evidence'), confidence (integer 0-100), summary (string), strengths (array of strings), blockers (array of strings), unknowns (array of strings), actions (array of strings), sources (array of objects with title,url,why_relevant). Score means estimated application eligibility/readiness, NOT probability of winning or funding. Use conservative scoring; an unconfirmed mandatory tax status or applicant-type requirement must substantially reduce the score. No guarantee, and clearly recommend direct funder confirmation.";
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:env.OPENAI_RESEARCH_MODEL||"gpt-4.1-mini",tools:[{type:"web_search"}],input:prompt})});
  if(!response.ok) throw new Error("Eligibility research failed with HTTP "+response.status+".");
  const payload=await response.json();
  const output=(payload.output_text|| (payload.output||[]).flatMap(x=>(x.content||[]).filter(c=>c.type==="output_text").map(c=>c.text)).join("\n")).trim();
  if(!output) throw new Error("The eligibility research returned no analysis. Please try again.");
  let parsed; try { const clean=output.replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/,""); parsed=JSON.parse(clean); } catch { throw new Error("The AI returned an unreadable eligibility report. Please retry."); }
  const score=Math.max(0,Math.min(100,Math.round(Number(parsed.score)||0)));
  const verdicts=["Potentially eligible","Likely eligible","Likely ineligible","Insufficient evidence"];
  return {score,verdict:verdicts.includes(parsed.verdict)?parsed.verdict:"Insufficient evidence",confidence:Math.max(0,Math.min(100,Math.round(Number(parsed.confidence)||0))),summary:String(parsed.summary||"No summary supplied."),strengths:Array.isArray(parsed.strengths)?parsed.strengths.slice(0,8):[],blockers:Array.isArray(parsed.blockers)?parsed.blockers.slice(0,8):[],unknowns:Array.isArray(parsed.unknowns)?parsed.unknowns.slice(0,8):[],actions:Array.isArray(parsed.actions)?parsed.actions.slice(0,8):[],sources:Array.isArray(parsed.sources)?parsed.sources.filter(x=>x&&/^https:\/\//i.test(x.url||"")).slice(0,10):[],assessed_at:new Date().toISOString(),score_note:"Preliminary AI screening estimate, not a legal opinion, eligibility determination, or probability of award."};
}
async function publicWebResearch(env,slug) {
  if(!env.OPENAI_API_KEY) throw new Error("OpenAI is not configured. Add OPENAI_API_KEY to the Worker secrets.");
  const category=PROGRAMS[slug];
  const prompt="Research recent, verifiable public information relevant to the GDOF programme category: "+category.label+". Search across authoritative public sources, prioritising UN agencies, government departments, established international organisations, universities and reputable foundations. Find 3-6 useful sources. Return a concise factual research brief with source titles, publishers, publication dates, countries and direct URLs. Clearly distinguish an external programme or reported need from GDOF activity. Never claim GDOF delivered or partnered in any activity. Do not invent facts. Prefer sources published in the last 3 years where possible; state dates. Search themes: "+category.query+".";
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:env.OPENAI_RESEARCH_MODEL||"gpt-4.1-mini",tools:[{type:"web_search"}],input:prompt})});
  if(!response.ok) throw new Error("Public web research failed with HTTP "+response.status+". Check the OpenAI API key and model access.");
  const payload=await response.json();
  const textParts=[],sources=[];
  for(const item of payload.output||[]) for(const part of item.content||[]) if(part.type==="output_text"){textParts.push(part.text||"");for(const annotation of part.annotations||[]) if(annotation.url)sources.push({title:annotation.title||annotation.url,url:annotation.url});}
  const brief=(payload.output_text||textParts.join("\n")).trim();
  if(!brief) throw new Error("Public web search returned no usable research. Please retry or use the manual research option.");
  const unique=[...new Map(sources.filter(x=>/^https:\/\//i.test(x.url)).map(x=>[x.url,x])).values()].slice(0,10);
  if(!unique.length) throw new Error("Public web research returned no direct source links. Please retry; no unsourced story was created.");
  return [{title:"AI public web research brief",url:unique[0].url,date:new Date().toISOString().slice(0,10),source:"OpenAI web search",excerpt:brief.slice(0,12000)},...unique.slice(1).map(x=>({title:x.title,url:x.url,date:"",source:"Public web search",excerpt:"Source discovered during web research."}))];
}
async function reliefWebResearch(env,slug) {
  const p=PROGRAMS[slug];
  if(!env.RELIEFWEB_APPNAME) throw new Error("Set a registered RELIEFWEB_APPNAME Worker secret before using automatic research.");
  const appname=env.RELIEFWEB_APPNAME;
  const response=await fetch("https://api.reliefweb.int/v2/reports?appname="+encodeURIComponent(appname),{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({limit:6,sort:["date.created:desc"],fields:{include:["title","url","date.created","body","country","source"]},query:{value:p.query,operator:"AND"}})
  });
  if(!response.ok) throw new Error("ReliefWeb research returned HTTP "+response.status+".");
  const payload=await response.json();
  const records=(payload.data||[]).map(x=>x.fields||{}).filter(x=>x.title&&x.url);
  return records.map(x=>({title:String(x.title).slice(0,300),url:x.url,date:x["date.created"]||"",country:(x.country||[]).map(c=>c.name).join(", "),source:(x.source||[]).map(s=>s.name).join(", "),excerpt:String(x.body||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").slice(0,1800)}));
}
async function pexelsMedia(env,query) {
  if(!env.PEXELS_API_KEY) throw new Error("Pexels is not configured. Add PEXELS_API_KEY before generating stories.");
  const headers={Authorization:env.PEXELS_API_KEY};
  const [photosRes,videosRes]=await Promise.all([
    fetch("https://api.pexels.com/v1/search?"+new URLSearchParams({query,per_page:"3",orientation:"landscape"}),{headers}),
    fetch("https://api.pexels.com/v1/videos/search?"+new URLSearchParams({query,per_page:"1",orientation:"landscape"}),{headers})
  ]);
  if(!photosRes.ok||!videosRes.ok) throw new Error("Pexels could not provide the requested media.");
  const [photos,videos]=await Promise.all([photosRes.json(),videosRes.json()]);
  const images=(photos.photos||[]).slice(0,3).map(p=>({url:p.src?.large2x||p.src?.large||p.src?.original,source:"pexels_open_source",provider:"Pexels",photographer:p.photographer||"",source_url:p.url||"",caption:p.alt||"Illustrative stock photograph from Pexels"})).filter(x=>x.url);
  const video=(videos.videos||[]).map(v=>({v, file:(v.video_files||[]).filter(f=>f.file_type==="video/mp4").sort((a,b)=>(b.width||0)-(a.width||0))[0]})).find(x=>x.file?.link);
  if(images.length<2||!video) throw new Error("Pexels did not return at least two suitable images and one video. Try another category search later.");
  return {images,video:{url:video.file.link,source:"pexels_open_source",provider:"Pexels",source_url:video.v.url||"",caption:"Illustrative stock video from Pexels"}};
}
async function draftWithOpenAI(env,{slug,notes,research,media}) {
  if(!env.OPENAI_API_KEY) throw new Error("OpenAI is not configured. Add OPENAI_API_KEY to the Worker secrets.");
  const category=PROGRAMS[slug];
  const system="You are GDOF's careful editorial assistant. Return only valid JSON with title, summary, full_story. Never invent GDOF activities, beneficiaries, outcomes, statistics, partnerships, dates, locations or quotations. Distinguish external examples from GDOF work. If evidence is limited, use cautious wording and say what the source actually reports. Do not turn an external humanitarian report into a claim that GDOF delivered assistance. If the input is an idea rather than completed work, label it clearly as a proposed activity and use future/conditional language. Use dignified, non-exploitative language.";
  const user=notes
    ? "Create an editorial draft from these Super Admin field notes. Treat only the notes as facts; identify unverified items as [VERIFY]. Do not imply the idea has already happened. Category: "+category.label+". Notes: "+notes
    : "Create a concise, source-grounded external initiative profile relevant to GDOF's category "+category.label+". It is NOT a GDOF project. Use only the source material below. Do not infer unreported impact or attribute work to GDOF. Cite source names, dates and links in the full story where available. Research records: "+JSON.stringify(research);
  const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:env.OPENAI_MODEL||"gpt-4.1-mini",response_format:{type:"json_schema",json_schema:{name:"gdof_story",strict:true,schema:{type:"object",additionalProperties:false,properties:{title:{type:"string"},summary:{type:"string"},full_story:{type:"string"}},required:["title","summary","full_story"]}}},messages:[{role:"system",content:system},{role:"user",content:user}],temperature:0.2})});
  if(!response.ok) throw new Error("OpenAI content generation failed with HTTP "+response.status+".");
  const payload=await response.json();
  let parsed; try { parsed=JSON.parse(payload.choices?.[0]?.message?.content||"{}"); } catch { throw new Error("AI returned an unreadable story draft. Please retry."); }
  const title=String(parsed.title||"").trim(), summary=String(parsed.summary||"").trim(), full_story=String(parsed.full_story||"").trim();
  if(!title||!summary||!full_story) throw new Error("AI did not return all required story fields.");
  return {title:title.slice(0,180),summary:summary.slice(0,900),full_story:full_story.slice(0,20000)};
}
function onlySuperAdmin(user) { return (user?.role||"super_admin")==="super_admin"; }

async function adminApi(request, env, url) {
  const path=url.pathname, method=request.method;
  if (path==="/api/admin/login" && method==="POST") {
    await bootstrap(env);
    if (!env.ADMIN_SESSION_SECRET) return json({error:"Admin session secret is not configured."},503);
    const body=await request.json().catch(()=>({}));
    const email=String(body.email||"").trim().toLowerCase(), password=String(body.password||"");
    const user=await db(env).prepare("SELECT id,email,password_hash,password_salt,active,role FROM admins WHERE email=?").bind(email).first();
    if (!user || !user.active || (await passwordHash(password,user.password_salt))!==user.password_hash) return json({error:"Invalid email or password."},401);
    const token=await makeSession(user.email,env.ADMIN_SESSION_SECRET);
    await audit(env,user.email,"admin.login","Administrator signed in");
    return json({user:{email:user.email,role:user.role||"super_admin"}},200,cookie(token));
  }
  const user=await requireAdmin(request,env);
  if (path==="/api/admin/logout" && method==="POST") return json({ok:true},200,clearCookie);
  if (!user) return json({error:"Please sign in to continue."},401);
  const D=db(env);
  if (path==="/api/admin/me" && method==="GET") return json({user:{email:user.email,role:user.role||"super_admin"}});
  const eligibilityMatch=path.match(/^\/api\/admin\/notifications\/([^/]+)\/analyze-eligibility$/);
  if (eligibilityMatch && method==="POST") {
    if(!onlySuperAdmin(user)) return json({error:"Only a Super Admin can run eligibility assessments."},403);
    let id; try { id=decodeURIComponent(eligibilityMatch[1]); } catch { return json({error:"Invalid opportunity ID."},400); }
    const row=await D.prepare("SELECT content_value FROM site_content WHERE content_key='grants_radar_notifications'").first();
    let notifications=[]; try { notifications=JSON.parse(row?.content_value||"[]"); } catch {}
    if(!Array.isArray(notifications)) notifications=[];
    const item=notifications.find(x=>x.id===id);
    if(!item) return json({error:"Funding opportunity not found. Refresh the radar and try again."},404);
    try {
      const analysis=await analyzeGrantEligibility(env,item);
      item.eligibility_analysis=analysis;
      await D.prepare("INSERT INTO site_content(content_key,content_value,updated_at) VALUES('grants_radar_notifications',?,CURRENT_TIMESTAMP) ON CONFLICT(content_key) DO UPDATE SET content_value=excluded.content_value,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(notifications)).run();
      await audit(env,user.email,"grants.radar.eligibility_analyzed",id+" · score "+analysis.score);
      return json({ok:true,id,analysis});
    } catch(error) { return json({error:String(error.message||"Eligibility analysis failed.")},502); }
  }
  if (path==="/api/admin/notifications" && method==="GET") {
    if (!onlySuperAdmin(user)) return json({error:"Only a Super Admin can access funding notifications."},403);
    const row=await D.prepare("SELECT content_value FROM site_content WHERE content_key='grants_radar_notifications'").first();
    let notifications=[]; try { notifications=JSON.parse(row?.content_value||"[]"); } catch {}
    if(!Array.isArray(notifications)) notifications=[];
    return json({notifications,unread_count:notifications.filter(item=>!item.read).length});
  }
  if (path==="/api/admin/notifications/scan-now" && method==="POST") {
    if (!onlySuperAdmin(user)) return json({error:"Only a Super Admin can scan funding sources."},403);
    const D=db(env);
    const categories=[
      {slug:"food-security-family-support",label:"Food Security & Family Support",terms:["food security","food assistance","nutrition","agriculture","food systems"]},
      {slug:"education-bursaries",label:"Education & Bursaries",terms:["education","scholarship","student support","literacy","school"]},
      {slug:"youth-entrepreneurship",label:"Youth Entrepreneurship",terms:["youth entrepreneurship","small business","youth employment","entrepreneurship","microenterprise"]},
      {slug:"employment-livelihoods",label:"Employment & Livelihoods",terms:["workforce development","job training","livelihood","employment","skills training"]},
      {slug:"animal-rescue-welfare",label:"Animal Rescue & Welfare",terms:["animal welfare","animal rescue","wildlife conservation","veterinary","animal shelter"]},
      {slug:"community-development",label:"Community Development",terms:["community development","community services","local development","housing","capacity building"]},
      {slug:"emergency-relief",label:"Emergency Relief",terms:["disaster relief","humanitarian assistance","emergency response","crisis response","resilience"]}
    ];
    const searchOne=async(category,keyword)=>{
      const response=await fetch("https://api.grants.gov/v1/api/search2",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows:8,keyword,oppStatuses:"posted|forecasted",startRecordNum:0})});
      if(!response.ok) throw new Error("Grants.gov search returned HTTP "+response.status);
      const payload=await response.json();
      if(Number(payload.errorcode)!==0) throw new Error(payload.msg||"Grants.gov search failed");
      return (payload.data?.oppHits||[]).map(hit=>({...hit,_category:category,_keyword:keyword}));
    };
    const searches=await Promise.allSettled(categories.map(async category=>{
      const query=category.terms.slice(0,3).join(" ");
      return searchOne(category,query);
    }));
    const searchErrors=searches.filter(item=>item.status==="rejected").map(item=>String(item.reason?.message||"Search failed"));
    const hits=searches.filter(item=>item.status==="fulfilled").flatMap(item=>item.value);
    const uniqueHits=[...new Map(hits.filter(hit=>hit.id).map(hit=>[String(hit.id),hit])).values()].slice(0,40);
    const details=await Promise.allSettled(uniqueHits.map(async hit=>{
      const response=await fetch("https://api.grants.gov/v1/api/fetchOpportunity",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({opportunityId:Number(hit.id)})});
      if(!response.ok) throw new Error("Opportunity detail returned HTTP "+response.status);
      const payload=await response.json();
      if(Number(payload.errorcode)!==0) throw new Error(payload.msg||"Opportunity detail failed");
      return {hit,detail:payload.data||{}};
    }));
    const discovered=[];
    for(const result of details){
      if(result.status!=="fulfilled") continue;
      const {hit,detail}=result.value;
      const synopsis=detail.synopsis||{};
      const title=String(detail.opportunityTitle||hit.title||"").trim();
      if(!title) continue;
      const category=hit._category;
      const titleText=title.toLowerCase();
      const queryTerms=category.terms.flatMap(term=>term.toLowerCase().split(/\s+/));
      const titleHits=queryTerms.filter(term=>term.length>3&&titleText.includes(term)).length;
      const score=Math.max(35,Math.min(88,Math.round(48+titleHits*9+(String(hit.oppStatus||"").toLowerCase()==="posted"?8:0))));
      const applicantTypes=(synopsis.applicantTypes||[]).map(item=>item.description).filter(Boolean);
      const awardFloor=synopsis.awardFloorFormatted||synopsis.awardFloor;
      const awardCeiling=synopsis.awardCeilingFormatted||synopsis.awardCeiling;
      const amount=awardFloor||awardCeiling?(awardFloor&&awardCeiling?"USD "+awardFloor+"–"+awardCeiling:("USD "+(awardCeiling||awardFloor))):"Not stated in search record";
      const closeDate=hit.closeDate||synopsis.closeDate||"Not stated — verify on listing";
      const parsedDeadline=Date.parse(closeDate);
      if(Number.isFinite(parsedDeadline)&&parsedDeadline<new Date().setHours(0,0,0,0)) continue;
      const applyUrl="https://www.grants.gov/search-results-detail/"+encodeURIComponent(String(hit.id));
      const eligibility=applicantTypes.length?"Published applicant types: "+applicantTypes.join(", ")+". GDOF must confirm that an internationally operating Delaware nonprofit is eligible, including any U.S. tax-status, domestic presence, and foreign-organization restrictions.":"Applicant-type details were not available in the search response. GDOF must verify applicant eligibility, U.S. tax-status requirements, and foreign-organization restrictions in the official notice.";
      discovered.push({
        id:"grants-gov-"+String(hit.id),
        type:"government",
        title,
        funder:String(synopsis.agencyName||hit.agencyName||"U.S. federal agency"),
        amount:String(amount).slice(0,120),
        deadline:String(closeDate).slice(0,100),
        fit_score:score,
        matched_gdof_category:category.label,
        eligibility_note:eligibility,
        apply_url:applyUrl,
        source_url:applyUrl,
        source_name:"Grants.gov",
        country:"United States",
        continent:"North America",
        read:false,
        created_at:new Date().toISOString()
      });
    }
    const row=await D.prepare("SELECT content_value FROM site_content WHERE content_key='grants_radar_notifications'").first();
    let existing=[]; try { existing=JSON.parse(row?.content_value||"[]"); } catch {}
    if(!Array.isArray(existing)) existing=[];
    const previousByUrl=new Map(existing.map(item=>[item.apply_url,item]));
    const mergedNew=discovered.map(item=>{
      const prior=previousByUrl.get(item.apply_url);
      return prior?{...item,id:prior.id,read:Boolean(prior.read),created_at:prior.created_at||item.created_at}:item;
    });
    const foundUrls=new Set(mergedNew.map(item=>item.apply_url));
    const merged=[...mergedNew,...existing.filter(item=>!foundUrls.has(item.apply_url))].slice(0,250);
    await D.prepare("INSERT INTO site_content(content_key,content_value,updated_at) VALUES('grants_radar_notifications',?,CURRENT_TIMESTAMP) ON CONFLICT(content_key) DO UPDATE SET content_value=excluded.content_value,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(merged)).run();
    await audit(env,user.email,"grants.radar.scanned",`Built-in Grants.gov scan returned ${discovered.length} opportunities; ${searchErrors.length} category searches failed`);
    const addedCount=mergedNew.filter(item=>!previousByUrl.has(item.apply_url)).length;
    const message=discovered.length?"Grants.gov scan completed: "+discovered.length+" opportunities found.":"Grants.gov scan completed; no matching open opportunities were returned.";
    return json({ok:true,added_count:addedCount,scan_message:message,source:"Grants.gov",search_errors:searchErrors});
  }
  const notificationReadMatch=path.match(/^\/api\/admin\/notifications\/([^/]+)\/read$/);
  if (notificationReadMatch && method==="PATCH") {
    if (!onlySuperAdmin(user)) return json({error:"Only a Super Admin can update funding notifications."},403);
    let id; try { id=decodeURIComponent(notificationReadMatch[1]); } catch { return json({error:"Invalid notification ID."},400); }
    const row=await D.prepare("SELECT content_value FROM site_content WHERE content_key='grants_radar_notifications'").first();
    let notifications=[]; try { notifications=JSON.parse(row?.content_value||"[]"); } catch {}
    if(!Array.isArray(notifications)) notifications=[];
    const target=notifications.find(item=>item.id===id);
    if(!target) return json({error:"Funding notification not found."},404);
    if(!target.read){
      target.read=true;
      await D.prepare("INSERT INTO site_content(content_key,content_value,updated_at) VALUES('grants_radar_notifications',?,CURRENT_TIMESTAMP) ON CONFLICT(content_key) DO UPDATE SET content_value=excluded.content_value,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(notifications)).run();
    }
    return json({ok:true,id,unread_count:notifications.filter(item=>!item.read).length});
  }
  if (path==="/api/admin/data" && method==="GET") {
    const role=user.role||"super_admin";
    const [enquiries,donations,admins,rows,auditRows,enquiryCount,donationCount,adminCount]=await Promise.all([
      ["super_admin","editor"].includes(role) ? D.prepare("SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 300").all() : Promise.resolve({results:[]}),
      ["super_admin","finance"].includes(role) ? D.prepare("SELECT * FROM donations ORDER BY created_at DESC LIMIT 300").all() : Promise.resolve({results:[]}),
      role==="super_admin" ? D.prepare("SELECT id,email,active,role,created_at FROM admins ORDER BY created_at ASC").all() : Promise.resolve({results:[]}),
      ["super_admin","editor"].includes(role) ? D.prepare("SELECT content_key,content_value FROM site_content").all() : Promise.resolve({results:[]}),
      role==="super_admin" ? D.prepare("SELECT id,actor_email,action,details,created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT 200").all().catch(() => ({results:[]})) : Promise.resolve({results:[]}),
      D.prepare("SELECT COUNT(*) AS count FROM enquiries").first(),
      D.prepare("SELECT COUNT(*) AS count FROM donations").first(),
      role==="super_admin" ? D.prepare("SELECT COUNT(*) AS count FROM admins").first() : Promise.resolve({count:null})
    ]);
    const content={}; for (const row of rows.results||[]) if (row.content_key!=="program_stories") content[row.content_key]=row.content_value;
    return json({role,counts:{enquiries:enquiryCount?.count||0,donations:donationCount?.count||0,admins:adminCount?.count??null},enquiries:enquiries.results||[],donations:donations.results||[],admins:admins.results||[],auditLogs:auditRows.results||[],content});
  }
  if (path==="/api/admin/program-directory" && method==="GET") {
    if ((user.role||"super_admin")!=="super_admin") return json({error:"Only a Super Admin can manage program directory visibility."},403);
    const row=await D.prepare("SELECT content_value FROM site_content WHERE content_key='program_directory_visibility'").first();
    let settings={categories:{},items:{},disclaimerVisible:true}; try { settings={...settings,...JSON.parse(row?.content_value||"{}")}; } catch {}
    return json({settings});
  }
  if (path==="/api/admin/program-directory" && method==="PUT") {
    if ((user.role||"super_admin")!=="super_admin") return json({error:"Only a Super Admin can manage program directory visibility."},403);
    const body=await request.json().catch(()=>({})), raw=body.settings||{};
    const slugs=["food-security-family-support","education-bursaries","youth-entrepreneurship","employment-livelihoods","animal-rescue-welfare","community-development","emergency-relief"];
    const categories={},items={};
    for (const slug of slugs) {
      if (typeof raw.categories?.[slug]==="boolean") categories[slug]=raw.categories[slug];
      const incoming=raw.items?.[slug]&&typeof raw.items[slug]==="object"?raw.items[slug]:{}; items[slug]={};
      for (const [title,visible] of Object.entries(incoming).slice(0,100)) if (typeof title==="string"&&title.length<=240&&typeof visible==="boolean") items[slug][title]=visible;
    }
    const settings={categories,items,disclaimerVisible:raw.disclaimerVisible!==false};
    await D.prepare("INSERT INTO site_content(content_key,content_value,updated_at) VALUES('program_directory_visibility',?,CURRENT_TIMESTAMP) ON CONFLICT(content_key) DO UPDATE SET content_value=excluded.content_value,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(settings)).run();
    await audit(env,user.email,"program.directory.visibility.updated","Updated public program directory visibility settings");
    return json({ok:true,settings});
  }
  if (path==="/api/admin/partnerships" && method==="GET") {
    if (user.role!=="super_admin") return json({error:"Only a Super Admin can view partner and grant records."},403);
    const row=await D.prepare("SELECT content_value FROM site_content WHERE content_key='partnership_records'").first();
    let partnerships=[]; try { partnerships=JSON.parse(row?.content_value||"[]"); } catch {}
    return json({partnerships:Array.isArray(partnerships)?partnerships:[]});
  }
  if (path==="/api/admin/partnerships" && method==="PUT") {
    if (user.role!=="super_admin") return json({error:"Only a Super Admin can manage partner and grant records."},403);
    const body=await request.json().catch(()=>({}));
    if (!Array.isArray(body.partnerships)||body.partnerships.length>500) return json({error:"Submit a valid list of up to 500 partnership records."},400);
    const partnerships=[];
    for (const item of body.partnerships) {
      const record={
        id:String(item.id||crypto.randomUUID()).slice(0,80),
        partnerName:String(item.partnerName||"").trim().slice(0,180),
        partnerType:String(item.partnerType||"").trim().slice(0,120),
        title:String(item.title||"").trim().slice(0,180),
        program:String(item.program||"").trim().slice(0,120),
        supportType:String(item.supportType||"").trim().slice(0,120),
        amount:String(item.amount||"").trim().slice(0,40),
        currency:String(item.currency||"USD").trim().slice(0,8),
        startDate:String(item.startDate||"").slice(0,10),
        endDate:String(item.endDate||"").slice(0,10),
        status:String(item.status||"Prospective").trim().slice(0,60),
        publicDescription:String(item.publicDescription||"").trim().slice(0,3000),
        internalNotes:String(item.internalNotes||"").trim().slice(0,5000),
        showPublic:Boolean(item.showPublic)
      };
      if (!record.partnerName||!record.title||!record.partnerType||!record.supportType) return json({error:"Each record needs a partner name, partner type, title and support type."},400);
      if (record.startDate&&record.endDate&&record.endDate<record.startDate) return json({error:"The end date cannot be earlier than the start date."},400);
      partnerships.push(record);
    }
    await D.prepare("INSERT INTO site_content(content_key,content_value,updated_at) VALUES('partnership_records',?,CURRENT_TIMESTAMP) ON CONFLICT(content_key) DO UPDATE SET content_value=excluded.content_value,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(partnerships)).run();
    await audit(env,user.email,"partnership.records.updated",`Saved ${partnerships.length} partner and grant records`);
    return json({ok:true,partnerships});
  }
  if (path==="/api/admin/generate-auto" && method==="POST") {
    if (!onlySuperAdmin(user)) return json({error:"Only a Super Admin can generate AI stories."},403);
    const body=await request.json().catch(()=>({})), slug=String(body.category_slug||"");
    if (!PROGRAMS[slug]) return json({error:"Choose one of the seven GDOF programme categories."},400);
    const research=await publicWebResearch(env,slug);
    if (!research.length) return json({error:"No relevant ReliefWeb source records were found. No draft was created."},422);
    let media={images:[],video:null};
    try { media=await pexelsMedia(env,PROGRAMS[slug].query); } catch(mediaError) { await audit(env,user.email,"story.media.fallback_unavailable",String(mediaError.message||"Pexels unavailable").slice(0,300)); }
    const draft=await draftWithOpenAI(env,{slug,research,media});
    const story={id:crypto.randomUUID(),category_slug:slug,program:PROGRAMS[slug].number,generation_mode:"auto",title:draft.title,summary:draft.summary,body:draft.full_story,full_story:draft.full_story,media,images:media.images||[],video_url:media.video?.url||"",video_source:media.video?.source||"none",external_reference_url:research[0].url,research_sources:research.map(x=>({title:x.title,url:x.url,date:x.date,source:x.source})),status:"PENDING_APPROVAL",published:false,created_at:new Date().toISOString(),approved_at:null,created_by:user.email};
    const stories=await readStories(D); stories.unshift(story); await writeStories(D,stories);
    await audit(env,user.email,"story.ai.generated",story.id);
    return json({ok:true,story});
  }
  if (path==="/api/admin/generate-from-notes" && method==="POST") {
    if (!onlySuperAdmin(user)) return json({error:"Only a Super Admin can create AI drafts."},403);
    const body=await request.json().catch(()=>({})), slug=String(body.category_slug||""), notes=String(body.notes||"").trim();
    if (!PROGRAMS[slug]||notes.length<12||notes.length>12000) return json({error:"Choose a category and enter field notes between 12 and 12,000 characters."},400);
    const media=body.media&&typeof body.media==="object"?body.media:{};
    let images=Array.isArray(media.images)?media.images.filter(x=>x&&typeof x.url==="string"&&x.url.startsWith("/media/uploads/")).slice(0,6).map(x=>({...x,source:"superadmin_upload"})):[];
    let video=media.video&&typeof media.video.url==="string"&&media.video.url.startsWith("/media/uploads/")?{...media.video,source:"superadmin_upload"}:null;
    if(images.length<2||!video){
      const fallback=await pexelsMedia(env,PROGRAMS[slug].query);
      if(images.length<2) images=[...images,...fallback.images].slice(0,3);
      if(!video) video=fallback.video;
    }
    const draft=await draftWithOpenAI(env,{slug,notes,media:{images,video}});
    const story={id:crypto.randomUUID(),category_slug:slug,program:PROGRAMS[slug].number,generation_mode:"field_notes",title:draft.title,summary:draft.summary,body:draft.full_story,full_story:draft.full_story,field_notes:notes,media:{images,video},images,video_url:video?.url||"",video_source:video?.source||"none",status:"PENDING_APPROVAL",published:false,created_at:new Date().toISOString(),approved_at:null,created_by:user.email};
    const stories=await readStories(D); stories.unshift(story); await writeStories(D,stories);
    await audit(env,user.email,"story.ai.generated_from_notes",story.id);
    return json({ok:true,story});
  }
  if (path==="/api/admin/verify-story-reliefweb" && method==="POST") {
    if(!onlySuperAdmin(user)) return json({error:"Only a Super Admin can verify story sources."},403);
    if(!env.RELIEFWEB_APPNAME) return json({error:"ReliefWeb is optional and is not configured yet. Add RELIEFWEB_APPNAME to enable this verification."},503);
    const body=await request.json().catch(()=>({})), id=String(body.id||"");
    const stories=await readStories(D), index=stories.findIndex(x=>x.id===id);
    if(index<0) return json({error:"Story draft not found."},404);
    const story=stories[index], slug=categorySlugFromStory(story);
    if(!slug) return json({error:"The draft does not have a recognised GDOF programme category."},400);
    const matches=await reliefWebResearch(env,slug);
    story.reliefweb_verification={checked_at:new Date().toISOString(),status:matches.length?"matches_found":"no_matches",sources:matches};
    stories[index]=story; await writeStories(D,stories);
    await audit(env,user.email,"story.reliefweb.verified",id);
    return json({ok:true,verification:story.reliefweb_verification});
  }
  if (path==="/api/admin/update-story" && method==="PUT") {
    if(!onlySuperAdmin(user)) return json({error:"Only a Super Admin can edit pending AI stories."},403);
    const body=await request.json().catch(()=>({})), id=String(body.id||"");
    const stories=await readStories(D), index=stories.findIndex(x=>x.id===id);
    if(index<0) return json({error:"Story draft not found."},404);
    const story=stories[index];
    if(story.status!=="PENDING_APPROVAL") return json({error:"Only pending drafts can be edited here."},409);
    if(typeof body.title==="string") story.title=body.title.trim().slice(0,180);
    if(typeof body.summary==="string") story.summary=body.summary.trim().slice(0,900);
    if(typeof body.full_story==="string") {story.full_story=body.full_story.trim().slice(0,20000);story.body=story.full_story;}
    if(body.media&&typeof body.media==="object"){
      const images=Array.isArray(body.media.images)?body.media.images.slice(0,6).filter(x=>x&&typeof x.url==="string"&&(x.url.startsWith("/media/uploads/")||x.url.startsWith("https://images.pexels.com/"))):[];
      const video=body.media.video&&typeof body.media.video.url==="string"&&(body.media.video.url.startsWith("/media/uploads/")||body.media.video.url.startsWith("https://videos.pexels.com/"))?body.media.video:null;
      story.media={images,video};story.images=images;story.video_url=video?.url||"";story.video_source=video?.source||"none";
    }
    if(!story.title||!story.summary||!(story.full_story||story.body)) return json({error:"A title, summary and full story are required."},400);
    stories[index]=story;await writeStories(D,stories);await audit(env,user.email,"story.draft.updated",id);
    return json({ok:true,story});
  }
  if (path==="/api/admin/approve-story" && method==="POST") {
    if (!onlySuperAdmin(user)) return json({error:"Only a Super Admin can approve or reject stories."},403);
    const body=await request.json().catch(()=>({})), id=String(body.id||""), action=String(body.action||"");
    if(!id||!["approve","reject"].includes(action)) return json({error:"A story ID and valid action are required."},400);
    const stories=await readStories(D), index=stories.findIndex(x=>x.id===id);
    if(index<0) return json({error:"Story draft not found."},404);
    if(stories[index].status!=="PENDING_APPROVAL") return json({error:"Only pending stories can be approved or rejected from this queue."},409);
    if(action==="reject") {
      stories.splice(index,1); await writeStories(D,stories); await audit(env,user.email,"story.rejected",id);
      return json({ok:true,deleted:true});
    }
    const story=stories[index];
    if(!story.title||!story.summary||!(story.full_story||story.body)) return json({error:"The story must have a title, summary and full text before publishing."},400);
    story.status="PUBLISHED"; story.published=true; story.approved_at=new Date().toISOString(); story.approved_by=user.email;
    stories[index]=story; await writeStories(D,stories); await audit(env,user.email,"story.approved",id);
    return json({ok:true,story});
  }
  if (path==="/api/admin/pending-stories" && method==="GET") {
    if(!onlySuperAdmin(user)) return json({error:"Only a Super Admin can view pending AI stories."},403);
    const stories=await readStories(D);
    return json({stories:stories.filter(x=>x.status==="PENDING_APPROVAL")});
  }
  if (path==="/api/admin/stories" && method==="GET") {
    if (!["super_admin","editor"].includes(user.role||"super_admin")) return json({error:"Your role cannot manage program stories."},403);
    const row=await D.prepare("SELECT content_value FROM site_content WHERE content_key='program_stories'").first();
    let stories=[]; try { stories=JSON.parse(row?.content_value||"[]"); } catch {}
    return json({stories:Array.isArray(stories)?stories.filter(x=>!x.generation_mode):[]});
  }
  if (path==="/api/admin/stories" && method==="PUT") {
    if (!["super_admin","editor"].includes(user.role||"super_admin")) return json({error:"Your role cannot manage program stories."},403);
    const body=await request.json().catch(()=>({}));
    if (!Array.isArray(body.stories) || body.stories.length>300) return json({error:"Submit a valid list of up to 300 stories."},400);
    const existing=await readStories(D);
    const stories=[];
    for (const item of body.stories) {
      const prior=existing.find(x=>x.id===item.id);
      const story={
        id:String(item.id||crypto.randomUUID()).slice(0,80),
        program:String(item.program||""),
        title:String(item.title||"").trim().slice(0,180),
        summary:String(item.summary||"").trim().slice(0,900),
        body:String(item.body||"").trim().slice(0,20000),
        imageUrl:String(item.imageUrl||"").trim().slice(0,500),
        imageAlt:String(item.imageAlt||"").trim().slice(0,250),
        caption:String(item.caption||"").trim().slice(0,500),
        publishedAt:String(item.publishedAt||"").slice(0,30),
published:false,
        status:prior?.status==="PUBLISHED"&&prior.title===String(item.title||"").trim()&&prior.summary===String(item.summary||"").trim()&&prior.body===String(item.body||"").trim()&&prior.imageUrl===String(item.imageUrl||"").trim()?"PUBLISHED":"PENDING_APPROVAL",
        category_slug:categorySlugFromStory(item)
      };
      if (!/^[1-7]$/.test(story.program) || !story.title || !story.summary || !story.body) return json({error:"Each story needs a program, title, summary and full story."},400);
      if (story.imageUrl && !story.imageUrl.startsWith("/media/uploads/")) return json({error:"Story images must be selected from the GDOF Media Library."},400);
      stories.push(story);
    }
    const aiStories=existing.filter(x=>x.generation_mode);
    await writeStories(D,[...aiStories,...stories]);
    await audit(env,user.email,"program.stories.updated",`Saved ${stories.length} program stories`);
    return json({ok:true,stories});
  }
  if (path==="/api/admin/media" && method==="GET") {
    if (!["super_admin","editor"].includes(user.role||"super_admin")) return json({error:"Your role cannot manage media."},403);
    if (!env.GDOF_MEDIA) return json({error:"Media storage is not configured."},503);
    const listed = await env.GDOF_MEDIA.list({prefix:"uploads/",limit:500});
    const files = (listed.objects||[]).map(object => ({
      key:object.key,
      size:object.size,
      mediaType:object.customMetadata?.mediaType||"image",
      uploaded:object.uploaded,
      url:"/media/"+object.key.split("/").map(encodeURIComponent).join("/")
    }));
    return json({files, truncated:!listed.truncated});
  }
  if (path==="/api/admin/media" && method==="POST") {
    if (!onlySuperAdmin(user)) return json({error:"Only a Super Admin can upload media."},403);
    if (!env.GDOF_MEDIA) return json({error:"Media storage is not configured."},503);
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer!=="function" || !file.size) return json({error:"Choose an image or video to upload."},400);
    const allowed = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"};
    const ext = allowed[file.type];
    if (!ext) return json({error:"Use JPG, PNG, WebP, GIF, MP4, WebM or MOV media."},415);
    const maxSize=file.type.startsWith("video/")?50*1024*1024:8*1024*1024;
    if(file.size>maxSize) return json({error:file.type.startsWith("video/")?"Videos must be 50 MB or smaller.":"Images must be 8 MB or smaller."},413);
    const key = "uploads/"+new Date().toISOString().slice(0,10)+"/"+crypto.randomUUID()+"."+ext;
    await env.GDOF_MEDIA.put(key, file.stream(), {
      httpMetadata:{contentType:file.type,cacheControl:"public, max-age=31536000, immutable"},
      customMetadata:{originalName:String(file.name||"media").slice(0,180),uploadedBy:user.email,mediaType:file.type.startsWith("video/")?"video":"image"}
    });
    await audit(env,user.email,"media.uploaded",key);
    return json({file:{key,url:"/media/"+key.split("/").map(encodeURIComponent).join("/"),size:file.size,type:file.type,mediaType:file.type.startsWith("video/")?"video":"image"}});
  }
  const mediaDelete = path.match(/^\/api\/admin\/media\/(.+)$/);
  if (mediaDelete && method==="DELETE") {
    if (!onlySuperAdmin(user)) return json({error:"Only a Super Admin can delete media."},403);
    if (!env.GDOF_MEDIA) return json({error:"Media storage is not configured."},503);
    let key; try { key=decodeURIComponent(mediaDelete[1]); } catch { return json({error:"Invalid media key."},400); }
    if (!key.startsWith("uploads/") || key.includes("..") || key.includes("\\")) return json({error:"Invalid media key."},400);
    await env.GDOF_MEDIA.delete(key);
    await audit(env,user.email,"media.deleted",key);
    return json({ok:true});
  }
  // GDOF Document Register — metadata is indexed in D1; each immutable document version is stored in R2.
  const documentKey="official_document_register";
  const readDocumentRegister=async()=>{
    const row=await D.prepare("SELECT content_value FROM site_content WHERE content_key=?").bind(documentKey).first();
    let records=[];try{records=JSON.parse(row?.content_value||"[]");}catch{}
    return Array.isArray(records)?records:[];
  };
  const writeDocumentRegister=async(records)=>{
    await D.prepare("INSERT INTO site_content(content_key,content_value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(content_key) DO UPDATE SET content_value=excluded.content_value,updated_at=CURRENT_TIMESTAMP").bind(documentKey,JSON.stringify(records)).run();
  };
  if(path==="/api/admin/documents"&&method==="GET"){
    if(!onlySuperAdmin(user))return json({error:"Only a Super Admin can access the official document register."},403);
    return json({documents:await readDocumentRegister()});
  }
  if(path==="/api/admin/documents"&&method==="POST"){
    if(!onlySuperAdmin(user))return json({error:"Only a Super Admin can create official documents."},403);
    if(!env.GDOF_MEDIA)return json({error:"Document storage is not configured. Add the GDOF_MEDIA R2 binding."},503);
    const body=await request.json().catch(()=>({}));
    const title=String(body.title||"").trim().slice(0,180),html=String(body.html||"");
    if(!title||!html||html.length>1500000)return json({error:"A title and print-ready document content (up to 1.5 MB) are required."},400);
    const id=String(body.id||crypto.randomUUID()).slice(0,80);
    let records=await readDocumentRegister();
    let record=records.find(x=>x.id===id);
    if(record&&record.status==="APPROVED")return json({error:"Approved records are locked. Create a new document or version through an authorized correction process."},409);
    const versionId=crypto.randomUUID(),versionNumber=record?(Math.max(0,...record.versions.map(v=>Number(v.version)||0))+1):1;
    const htmlKey="documents/"+id+"/"+versionId+".html";
    await env.GDOF_MEDIA.put(htmlKey,html,{httpMetadata:{contentType:"text/html; charset=utf-8",cacheControl:"private, no-store"},customMetadata:{documentId:id,versionId,uploadedBy:user.email,kind:"document-html"}});
    const now=new Date().toISOString();
    const version={id:versionId,version:versionNumber,htmlKey,pdfKey:null,pdfName:null,createdAt:now,createdBy:user.email,changeNote:String(body.changeNote||"").slice(0,500)};
    if(!record){
      const stamp=now.slice(0,10).replace(/-/g,"");
      record={id,documentNumber:"GDOF/DOC/"+stamp+"/"+crypto.randomUUID().slice(0,6).toUpperCase(),title,documentType:String(body.documentType||"Custom Document").slice(0,80),reference:String(body.reference||"").slice(0,100),documentDate:String(body.documentDate||now.slice(0,10)).slice(0,10),recipient:String(body.recipient||"").slice(0,240),preparedBy:String(body.preparedBy||"").slice(0,180),status:"DRAFT",createdAt:now,createdBy:user.email,updatedAt:now,updatedBy:user.email,versions:[]};
      records.unshift(record);
    }
    record.title=title;record.documentType=String(body.documentType||record.documentType||"Custom Document").slice(0,80);record.reference=String(body.reference||"").slice(0,100);record.documentDate=String(body.documentDate||"").slice(0,10);record.recipient=String(body.recipient||"").slice(0,240);record.preparedBy=String(body.preparedBy||"").slice(0,180);
    record.status="DRAFT";record.updatedAt=now;record.updatedBy=user.email;record.versions.unshift(version);
    records=records.filter(x=>x.id!==id);records.unshift(record);await writeDocumentRegister(records);
    await audit(env,user.email,"document.version.saved",record.documentNumber+" v"+versionNumber);
    return json({ok:true,document:record});
  }
  const documentPdfMatch=path.match(/^\/api\/admin\/documents\/([^/]+)\/pdf$/);
  if(documentPdfMatch&&method==="POST"){
    if(!onlySuperAdmin(user))return json({error:"Only a Super Admin can attach final PDFs."},403);
    if(!env.GDOF_MEDIA)return json({error:"Document storage is not configured."},503);
    const id=decodeURIComponent(documentPdfMatch[1]),records=await readDocumentRegister(),record=records.find(x=>x.id===id);
    if(!record)return json({error:"Document record not found."},404);
    if(record.status==="APPROVED")return json({error:"Approved documents are locked. Do not replace their signed PDF."},409);
    const form=await request.formData(),file=form.get("file");
    if(!file||typeof file.arrayBuffer!=="function"||file.type!=="application/pdf"||!file.size)return json({error:"Choose a valid PDF file."},415);
    if(file.size>15*1024*1024)return json({error:"PDF files must be 15 MB or smaller."},413);
    const version=record.versions[0];if(!version)return json({error:"Save a document version before attaching its PDF."},409);
    const key="documents/"+id+"/"+version.id+".pdf";
    await env.GDOF_MEDIA.put(key,file.stream(),{httpMetadata:{contentType:"application/pdf",cacheControl:"private, no-store"},customMetadata:{documentId:id,versionId:version.id,uploadedBy:user.email,kind:"document-pdf"}});
    version.pdfKey=key;version.pdfName=String(file.name||"document.pdf").slice(0,180);version.pdfSize=file.size;
    record.updatedAt=new Date().toISOString();record.updatedBy=user.email;await writeDocumentRegister(records);
    await audit(env,user.email,"document.pdf.attached",record.documentNumber+" v"+version.version);
    return json({ok:true,document:record});
  }
  const documentStatusMatch=path.match(/^\/api\/admin\/documents\/([^/]+)\/status$/);
  if(documentStatusMatch&&method==="PATCH"){
    if(!onlySuperAdmin(user))return json({error:"Only a Super Admin can approve official documents."},403);
    const id=decodeURIComponent(documentStatusMatch[1]),body=await request.json().catch(()=>({})),status=String(body.status||"");
    if(!["PENDING_APPROVAL","APPROVED","RETURNED"].includes(status))return json({error:"Choose a valid document status."},400);
    const records=await readDocumentRegister(),record=records.find(x=>x.id===id);if(!record)return json({error:"Document record not found."},404);
    if(status==="PENDING_APPROVAL"&&!record.versions?.[0]?.pdfKey)return json({error:"Attach the final PDF before submitting this document for approval."},409);
    if(status==="APPROVED"&&record.status!=="PENDING_APPROVAL")return json({error:"Only documents awaiting approval can be approved."},409);
    record.status=status;record.updatedAt=new Date().toISOString();record.updatedBy=user.email;
    if(status==="APPROVED"){record.approvedAt=record.updatedAt;record.approvedBy=user.email;}
    if(status==="RETURNED"){record.returnedAt=record.updatedAt;record.returnedBy=user.email;record.returnNote=String(body.note||"").slice(0,500);}
    await writeDocumentRegister(records);await audit(env,user.email,"document.status."+status.toLowerCase(),record.documentNumber);
    return json({ok:true,document:record});
  }
  const documentFileMatch=path.match(/^\/api\/admin\/documents\/([^/]+)\/files\/(html|pdf)$/);
  if(documentFileMatch&&method==="GET"){
    if(!onlySuperAdmin(user))return json({error:"Only a Super Admin can download official documents."},403);
    if(!env.GDOF_MEDIA)return json({error:"Document storage is not configured."},503);
    const id=decodeURIComponent(documentFileMatch[1]),kind=documentFileMatch[2],records=await readDocumentRegister(),record=records.find(x=>x.id===id);
    if(!record)return json({error:"Document record not found."},404);
    const versionId=url.searchParams.get("version")||record.versions?.[0]?.id,version=record.versions?.find(v=>v.id===versionId);
    const key=kind==="pdf"?version?.pdfKey:version?.htmlKey;if(!key)return json({error:"This version has no "+kind.toUpperCase()+" file attached."},404);
    const object=await env.GDOF_MEDIA.get(key);if(!object)return json({error:"Stored document file not found."},404);
    const headers=new Headers();object.writeHttpMetadata(headers);headers.set("Cache-Control","private, no-store");headers.set("Content-Disposition",(kind==="pdf"?"attachment":"inline")+"; filename="+JSON.stringify(kind==="pdf"?(version.pdfName||record.documentNumber+".pdf"):record.documentNumber+"-v"+version.version+".html"));headers.set("X-Content-Type-Options","nosniff");
    return new Response(object.body,{headers});
  }
  if (path==="/api/admin/content" && method==="PUT") {
    if (!["super_admin","editor"].includes(user.role||"super_admin")) return json({error:"Your role cannot edit website content."},403);
    const body=await request.json().catch(()=>({}));
    const allowed=["tagline","about","mission","contactEmail","heroTitleLine1","heroTitleLine2","heroDescription","program1Title","program1Description","program2Title","program2Description","program3Title","program3Description","program4Title","program4Description","program5Title","program5Description","program6Title","program6Description","program7Title","program7Description","leader1Name","leader1Role","leader2Name","leader2Role","leader3Name","leader3Role","leader4Name","leader4Role","leader5Name","leader5Role","heroFoot","aboutSupporting","programsIntro","governanceIntro","approachTitle1","approachText1","approachTitle2","approachText2","approachTitle3","approachText3","donateTitle","donateEmphasis","donateDescription","donateNotice","contactIntro","adminLoginButtonEnabled","announcementEnabled","announcementTitle","announcementText","announcementLinkText","announcementLinkUrl","resource1Title","resource1Description","resource1Url","resource2Title","resource2Description","resource2Url","resource3Title","resource3Description","resource3Url"];
    for (const key of allowed) if (typeof body[key]==="string") await D.prepare("INSERT INTO site_content(content_key,content_value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(content_key) DO UPDATE SET content_value=excluded.content_value,updated_at=CURRENT_TIMESTAMP").bind(key,body[key].slice(0,5000)).run();
    await audit(env,user.email,"website.content.updated","Updated public website content");
    return json({ok:true});
  }
  const enquiryMatch=path.match(/^\/api\/admin\/enquiries\/([^/]+)$/);
  if (enquiryMatch && method==="PATCH") {
    if (!["super_admin","editor"].includes(user.role||"super_admin")) return json({error:"Your role cannot manage enquiries."},403);
    const body=await request.json().catch(()=>({}));
    if (!["new","in_progress","resolved"].includes(body.status)) return json({error:"Invalid enquiry status."},400);
    await D.prepare("UPDATE enquiries SET status=? WHERE id=?").bind(body.status,enquiryMatch[1]).run();
    await audit(env,user.email,"enquiry.status.updated",`Enquiry ${enquiryMatch[1]} marked ${body.status}`);
    return json({ok:true});
  }
  if (path==="/api/admin/admins" && method==="POST") {
    if ((user.role||"super_admin")!=="super_admin") return json({error:"Only a Super Admin can manage administrator accounts."},403);
    const body=await request.json().catch(()=>({}));
    const email=String(body.email||"").trim().toLowerCase(), password=String(body.password||"");
    const role=String(body.role||"viewer");
    if (!["super_admin","editor","finance","viewer"].includes(role)) return json({error:"Choose a valid administrator role."},400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length<12) return json({error:"Enter a valid email and a password of at least 12 characters."},400);
    const salt=b64(crypto.getRandomValues(new Uint8Array(16))), hash=await passwordHash(password,salt);
    try { await D.prepare("INSERT INTO admins(id,email,password_hash,password_salt,active,role) VALUES(?,?,?,?,1,?)").bind(crypto.randomUUID(),email,hash,salt,role).run(); }
    catch { return json({error:"That administrator email may already exist."},409); }
    await audit(env,user.email,"administrator.created",`Created administrator ${email}`);
    return json({ok:true});
  }
  const adminMatch=path.match(/^\/api\/admin\/admins\/([^/]+)$/);
  if (adminMatch && method==="PATCH") {
    if ((user.role||"super_admin")!=="super_admin") return json({error:"Only a Super Admin can manage administrator accounts."},403);
    const body=await request.json().catch(()=>({}));
    if (typeof body.active!=="boolean" && !["super_admin","editor","finance","viewer"].includes(body.role)) return json({error:"Invalid administrator update."},400);
    if (body.role && !["super_admin","editor","finance","viewer"].includes(body.role)) return json({error:"Choose a valid administrator role."},400);
    if (adminMatch[1]===user.id && body.active===false) return json({error:"You cannot disable your own account."},400);
    if (adminMatch[1]===user.id && body.role && body.role!=="super_admin") return json({error:"You cannot remove your own Super Admin role."},400);
    const target = await D.prepare("SELECT id,active,role FROM admins WHERE id=?").bind(adminMatch[1]).first();
    if (!target) return json({error:"Administrator account not found."},404);
    const removesSuperAdmin = (target.active && body.active===false && target.role==="super_admin") || (body.role && body.role!=="super_admin" && target.role==="super_admin");
    if (removesSuperAdmin) {
      const remaining = await D.prepare("SELECT COUNT(*) AS count FROM admins WHERE active=1 AND role='super_admin' AND id<>?").bind(adminMatch[1]).first();
      if ((remaining?.count||0) < 1) return json({error:"You cannot disable or demote the last active Super Admin. Promote another administrator first."},400);
    }
    if (typeof body.active==="boolean") await D.prepare("UPDATE admins SET active=? WHERE id=?").bind(body.active?1:0,adminMatch[1]).run();
    if (body.role) await D.prepare("UPDATE admins SET role=? WHERE id=?").bind(body.role,adminMatch[1]).run();
    const action=body.role?"administrator.role.updated":body.active?"administrator.reactivated":"administrator.disabled";
    await audit(env,user.email,action,`Administrator record ${adminMatch[1]}`);
    return json({ok:true});
  }
  return json({error:"Admin endpoint not found."},404);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/admin/")) {
      try { return await adminApi(request,env,url); }
      catch (error) { return json({error:error.message||"Admin service unavailable."},503); }
    }
    if (url.pathname.startsWith("/media/") && request.method === "GET") {
      if (!env.GDOF_MEDIA) return new Response("Media storage is not configured.",{status:503});
      let key; try { key=url.pathname.slice("/media/".length).split("/").map(decodeURIComponent).join("/"); } catch { return new Response("Invalid media path.",{status:400}); }
      if (!key.startsWith("uploads/") || key.includes("..") || key.includes("\\")) return new Response("Not found.",{status:404});
      const object=await env.GDOF_MEDIA.get(key);
      if (!object) return new Response("Not found.",{status:404});
      const headers=new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag",object.httpEtag);
      headers.set("Cache-Control","public, max-age=31536000, immutable");
      headers.set("X-Content-Type-Options","nosniff");
      return new Response(object.body,{headers});
    }
    if (url.pathname === "/api/public-partnerships" && request.method === "GET") {
      if (!env.GDOF_DB) return json({partnerships:[]});
      try {
        const row=await env.GDOF_DB.prepare("SELECT content_value FROM site_content WHERE content_key='partnership_records'").first();
        const records=JSON.parse(row?.content_value||"[]");
        const partnerships=(Array.isArray(records)?records:[]).filter(x=>x.showPublic&&["Awarded / confirmed","Active","Completed"].includes(x.status)).map(x=>({id:x.id,partnerName:x.partnerName,title:x.title,partnerType:x.partnerType,program:x.program,supportType:x.supportType,startDate:x.startDate,endDate:x.endDate,status:x.status,publicDescription:x.publicDescription}));
        return json({partnerships});
      } catch { return json({partnerships:[]}); }
    }
    const programMatch=url.pathname.match(/^\/api\/programs\/([a-z0-9-]+)$/);
    if(programMatch&&request.method==="GET"){
      const slug=programMatch[1];
      if(!PROGRAMS[slug]) return json({error:"Programme not found."},404);
      if(!env.GDOF_DB) return json({stories:[]});
      try {
        const all=await readStories(env.GDOF_DB);
        const stories=all.filter(s=>s.status==="PUBLISHED"&&categorySlugFromStory(s)===slug).map(s=>({id:s.id,category_slug:slug,program:PROGRAMS[slug].number,published:true,imageUrl:(s.images||s.media?.images||[])[0]?.url||"",imageAlt:(s.images||s.media?.images||[])[0]?.caption||s.title,caption:(s.images||s.media?.images||[])[0]?.caption||"",body:s.full_story||s.body,publishedAt:s.approved_at||s.created_at,title:s.title,summary:s.summary,full_story:s.full_story||s.body,media:s.media||{images:s.images||[],video:s.video_url?{url:s.video_url,source:s.video_source||"none"}:null},images:s.images||s.media?.images||[],video_url:s.video_url||s.media?.video?.url||"",external_reference_url:s.external_reference_url||"",created_at:s.created_at,approved_at:s.approved_at}));
        return json({category:{slug,label:PROGRAMS[slug].label},stories});
      } catch { return json({stories:[]}); }
    }
    if (url.pathname === "/api/public-stories" && request.method === "GET") {
      if (!env.GDOF_DB) return json({stories:[]});
      try {
        const row=await env.GDOF_DB.prepare("SELECT content_value FROM site_content WHERE content_key='program_stories'").first();
        const stories=JSON.parse(row?.content_value||"[]");
        return json({stories:Array.isArray(stories)?stories.filter(story=>story.status==="PUBLISHED") : []});
      } catch { return json({stories:[]}); }
    }
    if (url.pathname === "/api/public-content" && request.method === "GET") {
      if (!env.GDOF_DB) return json({});
      try {
        const rows=await env.GDOF_DB.prepare("SELECT content_key,content_value FROM site_content").all();
        const content={}; for (const row of rows.results||[]) if (!["program_stories","partnership_records"].includes(row.content_key)) content[row.content_key]=row.content_value;
        return json(content);
      } catch { return json({}); }
    }
    if (url.pathname === "/api/contact" && request.method === "POST") {
      try {
        const D=db(env), body=await request.json();
        const name=String(body.name||"").trim(), email=String(body.email||"").trim(), subject=String(body.subject||"").trim(), message=String(body.message||"").trim();
        if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !subject || !message) return json({error:"Please complete all fields with a valid email."},400);
        if (name.length>160 || email.length>254 || subject.length>200 || message.length>10000) return json({error:"One or more fields are too long."},400);
        await D.prepare("INSERT INTO enquiries(id,name,email,subject,message) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),name,email,subject,message).run();
        return json({ok:true});
      } catch(error) { return json({error:error.message||"Unable to submit enquiry."},503); }
    }
    if (url.pathname === "/api/stripe/webhook" && request.method === "POST") {
      if (!env.STRIPE_WEBHOOK_SECRET || !env.GDOF_DB) return json({error:"Webhook is not configured."},503);
      const raw=await request.text(), header=request.headers.get("Stripe-Signature")||"";
      const parts=Object.fromEntries(header.split(",").map(x=>x.split("=",2)));
      const timestamp=Number(parts.t);
      if (!timestamp || Math.abs(Date.now()/1000-timestamp)>300 || !parts.v1) return json({error:"Invalid webhook signature."},400);
      const key=await crypto.subtle.importKey("raw",enc.encode(env.STRIPE_WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
      const signature=await crypto.subtle.sign("HMAC",key,enc.encode(parts.t+"."+raw));
      const expected=Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,"0")).join("");
      if (expected!==parts.v1) return json({error:"Invalid webhook signature."},400);
      let event; try { event=JSON.parse(raw); } catch { return json({error:"Invalid event body."},400); }
      if (event.type==="checkout.session.completed") {
        const session=event.data?.object;
        if (session?.id && session.payment_status==="paid") {
          await env.GDOF_DB.prepare("INSERT OR IGNORE INTO donations(id,stripe_session_id,donor_email,amount_cents,currency,payment_status) VALUES(?,?,?,?,?,?)")
            .bind(crypto.randomUUID(),session.id,session.customer_details?.email||session.customer_email||null,Number(session.amount_total||0),String(session.currency||"usd"),session.payment_status).run();
        }
      }
      return json({received:true});
    }
    if (url.pathname === "/api/create-checkout-session" && request.method === "POST") {
      if (!env.STRIPE_SECRET_KEY) return json({ error: "Donation payments are not configured yet." }, 503);
      let body; try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 1 || amount > 10000) return json({ error: "Enter a donation between $1 and $10,000 USD." }, 400);
      const params = new URLSearchParams();
      params.set("mode", "payment"); params.set("success_url", `${url.origin}/?donation=success&session_id={CHECKOUT_SESSION_ID}#donate`);
      params.set("cancel_url", `${url.origin}/?donation=cancelled#donate`); params.set("line_items[0][price_data][currency]", "usd");
      params.set("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100)));
      params.set("line_items[0][price_data][product_data][name]", "Donation to Global Development and Opportunity Foundation");
      params.set("line_items[0][quantity]", "1"); params.set("submit_type", "donate");
      params.set("metadata[donation_type]", "one_time"); params.set("metadata[organization]", "GDOF");
      try {
        const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", { method:"POST", headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,"Content-Type":"application/x-www-form-urlencoded"}, body:params.toString() });
        const session=await stripeResponse.json();
        if (!stripeResponse.ok) return json({error:"Stripe could not create the checkout session. Please try again."},502);
        return json({url:session.url});
      } catch { return json({error:"Unable to reach the payment service. Please try again."},502); }
    }
    if (url.pathname === "/api/health") return json({ok:true,paymentsConfigured:Boolean(env.STRIPE_SECRET_KEY),adminDatabaseConfigured:Boolean(env.GDOF_DB)});
    return env.ASSETS.fetch(request);
  },
};
