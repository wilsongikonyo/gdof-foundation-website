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
  return Array.isArray(values)?values:[];
}
async function writeStories(D,stories) {
  await D.prepare("INSERT INTO site_content(content_key,content_value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(content_key) DO UPDATE SET content_value=excluded.content_value,updated_at=CURRENT_TIMESTAMP").bind(storyKey,JSON.stringify(stories)).run();
}
function categorySlugFromStory(story) {
  if (PROGRAMS[story.category_slug]) return story.category_slug;
  const number=String(story.program||"");
  return Object.entries(PROGRAMS).find(([,v])=>v.number===number)?.[0]||"";
}
async function reliefWebResearch(env,slug) {
  const p=PROGRAMS[slug];
  const appname=env.RELIEFWEB_APPNAME||"gdof-foundation";
  const response=await fetch("https://api.reliefweb.int/v1/reports?appname="+encodeURIComponent(appname),{
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
    fetch("https://api.pexels.com/videos/search?"+new URLSearchParams({query,per_page:"1",orientation:"landscape"}),{headers})
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
  const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:env.OPENAI_MODEL||"gpt-4.1-mini",response_format:{type:"json_object"},messages:[{role:"system",content:system},{role:"user",content:user}],temperature:0.2})});
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
    const research=await reliefWebResearch(env,slug);
    if (!research.length) return json({error:"No relevant ReliefWeb source records were found. No draft was created."},422);
    const media=await pexelsMedia(env,PROGRAMS[slug].query);
    const draft=await draftWithOpenAI(env,{slug,research});
    const story={id:crypto.randomUUID(),category_slug:slug,program:PROGRAMS[slug].number,generation_mode:"auto",title:draft.title,summary:draft.summary,body:draft.full_story,full_story:draft.full_story,media,images:media.images,video_url:media.video.url,video_source:media.video.source,external_reference_url:research[0].url,research_sources:research.map(x=>({title:x.title,url:x.url,date:x.date,source:x.source})),status:"PENDING_APPROVAL",published:false,created_at:new Date().toISOString(),approved_at:null,created_by:user.email};
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
  if (path==="/api/admin/stories" && method==="GET") {
    if (!["super_admin","editor"].includes(user.role||"super_admin")) return json({error:"Your role cannot manage program stories."},403);
    const row=await D.prepare("SELECT content_value FROM site_content WHERE content_key='program_stories'").first();
    let stories=[]; try { stories=JSON.parse(row?.content_value||"[]"); } catch {}
    return json({stories:Array.isArray(stories)?stories:[]});
  }
  if (path==="/api/admin/stories" && method==="PUT") {
    if (!["super_admin","editor"].includes(user.role||"super_admin")) return json({error:"Your role cannot manage program stories."},403);
    const body=await request.json().catch(()=>({}));
    if (!Array.isArray(body.stories) || body.stories.length>300) return json({error:"Submit a valid list of up to 300 stories."},400);
    const stories=[];
    for (const item of body.stories) {
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
        published:Boolean(item.published)
      };
      if (!/^[1-7]$/.test(story.program) || !story.title || !story.summary || !story.body) return json({error:"Each story needs a program, title, summary and full story."},400);
      if (story.imageUrl && !story.imageUrl.startsWith("/media/uploads/")) return json({error:"Story images must be selected from the GDOF Media Library."},400);
      stories.push(story);
    }
    await D.prepare("INSERT INTO site_content(content_key,content_value,updated_at) VALUES('program_stories',?,CURRENT_TIMESTAMP) ON CONFLICT(content_key) DO UPDATE SET content_value=excluded.content_value,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(stories)).run();
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
    if (!["super_admin","editor"].includes(user.role||"super_admin")) return json({error:"Your role cannot delete media."},403);
    if (!env.GDOF_MEDIA) return json({error:"Media storage is not configured."},503);
    let key; try { key=decodeURIComponent(mediaDelete[1]); } catch { return json({error:"Invalid media key."},400); }
    if (!key.startsWith("uploads/") || key.includes("..") || key.includes("\\")) return json({error:"Invalid media key."},400);
    await env.GDOF_MEDIA.delete(key);
    await audit(env,user.email,"media.deleted",key);
    return json({ok:true});
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
        const stories=all.filter(s=>s.status==="PUBLISHED"&&categorySlugFromStory(s)===slug).map(s=>({id:s.id,category_slug:slug,title:s.title,summary:s.summary,full_story:s.full_story||s.body,media:s.media||{images:s.images||[],video:s.video_url?{url:s.video_url,source:s.video_source||"none"}:null},images:s.images||s.media?.images||[],video_url:s.video_url||s.media?.video?.url||"",external_reference_url:s.external_reference_url||"",created_at:s.created_at,approved_at:s.approved_at}));
        return json({category:{slug,label:PROGRAMS[slug].label},stories});
      } catch { return json({stories:[]}); }
    }
    const programMatch=url.pathname.match(/^\/api\/programs\/([a-z0-9-]+)$/);
    if(programMatch&&request.method==="GET"){
      const slug=programMatch[1];
      if(!PROGRAMS[slug]) return json({error:"Programme not found."},404);
      if(!env.GDOF_DB) return json({stories:[]});
      try {
        const all=await readStories(env.GDOF_DB);
        const stories=all.filter(s=>s.status==="PUBLISHED"&&categorySlugFromStory(s)===slug).map(s=>({id:s.id,category_slug:slug,title:s.title,summary:s.summary,full_story:s.full_story||s.body,media:s.media||{images:s.images||[],video:s.video_url?{url:s.video_url,source:s.video_source||"none"}:null},images:s.images||s.media?.images||[],video_url:s.video_url||s.media?.video?.url||"",external_reference_url:s.external_reference_url||"",created_at:s.created_at,approved_at:s.approved_at}));
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
