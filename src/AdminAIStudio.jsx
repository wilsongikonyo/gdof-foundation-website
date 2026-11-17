import { useEffect, useMemo, useState } from "react";

const categories = [
  ["food-security-family-support","Food Security & Family Support"],
  ["education-bursaries","Education & Bursaries"],
  ["youth-entrepreneurship","Youth Entrepreneurship"],
  ["employment-livelihoods","Employment & Livelihoods"],
  ["animal-rescue-welfare","Animal Rescue & Welfare"],
  ["community-development","Community Development"],
  ["emergency-relief","Emergency Relief"]
];
async function request(path, options={}) {
  const response=await fetch(path,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||"The request could not be completed.");
  return data;
}
async function upload(file) {
  const form=new FormData(); form.append("file",file);
  const response=await fetch("/api/admin/media",{method:"POST",credentials:"same-origin",body:form});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||"Media upload failed.");
  return {...data.file,source:"superadmin_upload",caption:file.name};
}
export default function AdminAIStudio({view="studio",onNotice=()=>{}}) {
  const [category,setCategory]=useState(categories[0][0]);
  const [notes,setNotes]=useState("");
  const [images,setImages]=useState([]);
  const [video,setVideo]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [drafts,setDrafts]=useState([]);
  const [editing,setEditing]=useState({});
  const [uploading,setUploading]=useState("");
  const [refreshing,setRefreshing]=useState(false);
  const isQueue=view==="queue";
  const categoryName=useMemo(()=>categories.find(x=>x[0]===category)?.[1]||category,[category]);
  const loadQueue=async()=>{setRefreshing(true);try{const r=await request("/api/admin/pending-stories");setDrafts(r.stories||[]);}catch(e){setError(e.message);}finally{setRefreshing(false);}};
  useEffect(()=>{if(isQueue)loadQueue();},[isQueue]);
  const generate=async mode=>{
    setBusy(true);setError("");onNotice("");
    try {
      let uploadedImages=[],uploadedVideo=null;
      if(mode==="notes"){
        for(const file of images) uploadedImages.push(await upload(file));
        if(video) uploadedVideo=await upload(video);
      }
      const result=await request(mode==="auto"?"/api/admin/generate-auto":"/api/admin/generate-from-notes",{method:"POST",body:JSON.stringify(mode==="auto"?{category_slug:category}:{category_slug:category,notes,media:{images:uploadedImages,video:uploadedVideo}})});
      onNotice("Draft added to Pending Approval. It is not public.");
      setNotes("");setImages([]);setVideo(null);
      if(isQueue) await loadQueue();
    } catch(e){setError(e.message);} finally{setBusy(false);}
  };
  const updateDraft=async story=>{
    setBusy(true);setError("");
    try{
      const fields=editing[story.id]||{};
      const result=await request("/api/admin/update-story",{method:"PUT",body:JSON.stringify({id:story.id,...fields})});
      setDrafts(list=>list.map(x=>x.id===story.id?result.story:x));
      setEditing(current=>({...current,[story.id]:{}}));onNotice("Draft changes saved.");
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const replaceMedia=async(story,file,kind)=>{
    setUploading(story.id+kind);setError("");
    try{
      const asset=await upload(file);
      const current=story.media||{images:[],video:null};
      const next=kind==="image"?{...current,images:[asset,...(current.images||[]).slice(1)].slice(0,6)}:{...current,video:asset};
      const result=await request("/api/admin/update-story",{method:"PUT",body:JSON.stringify({id:story.id,media:next})});
      setDrafts(list=>list.map(x=>x.id===story.id?result.story:x));onNotice("Draft media updated.");
    }catch(e){setError(e.message);}finally{setUploading("");}
  };
  const decision=async(id,action)=>{
    const prompt=action==="approve"?"Approve this story and publish it on the public website?":"Reject and permanently remove this draft?";
    if(!window.confirm(prompt))return;
    setBusy(true);setError("");
    try{await request("/api/admin/approve-story",{method:"POST",body:JSON.stringify({id,action})});setDrafts(list=>list.filter(x=>x.id!==id));onNotice(action==="approve"?"Story approved and published.":"Draft rejected and deleted.");}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  if(isQueue) return <section className="admin-panel ai-studio">
    <div className="ai-studio-head"><div><p className="admin-intro">Review AI-assisted stories before they become visible on the public website.</p><h2>Pending approval ({drafts.length})</h2></div><button type="button" className="admin-secondary" onClick={loadQueue} disabled={refreshing}>{refreshing?"Refreshing…":"Refresh queue"}</button></div>
    {error&&<p className="admin-warning" role="alert">{error}</p>}
    {!drafts.length?<p className="admin-muted">There are no stories waiting for approval.</p>:drafts.map(story=>{
      const media=story.media||{images:story.images||[],video:story.video_url?{url:story.video_url,source:story.video_source}:null};
      const fields=editing[story.id]||{};
      return <article className="ai-draft-card" key={story.id}>
        <div className="ai-draft-meta"><span>{categories.find(x=>x[0]===story.category_slug)?.[1]||"GDOF programme"}</span><span>{story.generation_mode==="auto"?"Auto-generated research draft":"Draft from field notes"}</span><span>Pending approval</span></div>
        <label>Title<input value={fields.title??story.title} onChange={e=>setEditing(s=>({...s,[story.id]:{...s[story.id],title:e.target.value}}))}/></label>
        <label>Summary<textarea rows="3" value={fields.summary??story.summary} onChange={e=>setEditing(s=>({...s,[story.id]:{...s[story.id],summary:e.target.value}}))}/></label>
        <label>Full story<textarea rows="9" value={fields.full_story??story.full_story??story.body} onChange={e=>setEditing(s=>({...s,[story.id]:{...s[story.id],full_story:e.target.value}}))}/></label>
        {story.field_notes&&<details><summary>Original field notes</summary><p>{story.field_notes}</p></details>}
        {((media.images||[]).some(m=>m.source==="pexels_open_source")||media.video?.source==="pexels_open_source")&&<p className="pexels-credit"><a href="https://www.pexels.com/" target="_blank" rel="noreferrer">Photos and videos provided by Pexels ↗</a> · </p>}<div className="ai-media-preview">{(media.images||[]).map((m,i)=><figure key={m.url+i}><img src={m.url} alt={m.caption||"Story media preview"}/><figcaption>{m.source==="superadmin_upload"?"Uploaded by Super Admin":"Pexels photo"} · {m.photographer?m.photographer+" · ":""}{m.caption||""}{m.source_url&&<a href={m.source_url} target="_blank" rel="noreferrer"> Source ↗</a>}</figcaption></figure>)}</div>
        {media.video?.url&&<div className="ai-video-preview"><video controls preload="metadata" src={media.video.url}/><small>{media.video.source==="superadmin_upload"?"Super Admin video":"Pexels video"} {media.video.source_url&&<a href={media.video.source_url} target="_blank" rel="noreferrer">Source ↗</a>}</small></div>}
        {story.research_sources?.length>0&&<div className="ai-sources"><strong>Research references</strong>{story.research_sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a>)}</div>}
        <div className="ai-media-actions"><label className="media-upload-button">＋ Add / replace image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>e.target.files?.[0]&&replaceMedia(story,e.target.files[0],"image")}/></label><label className="media-upload-button">＋ Add / replace video<input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e=>e.target.files?.[0]&&replaceMedia(story,e.target.files[0],"video")}/></label>{uploading.startsWith(story.id)&&<small>Uploading…</small>}</div>
        <div className="story-actions"><button type="button" className="admin-secondary" disabled={busy} onClick={()=>updateDraft(story)}>Save edits</button><button type="button" disabled={busy} onClick={()=>decision(story.id,"approve")}>Approve & Publish</button><button type="button" className="admin-danger" disabled={busy} onClick={()=>decision(story.id,"reject")}>Reject / Delete</button></div>
      </article>;
    })}
  </section>;
  return <section className="admin-panel ai-studio">
    <p className="admin-intro">Create evidence-aware programme stories. Every generated item is saved as a private draft and must be approved before publication.</p>
    {error&&<p className="admin-warning" role="alert">{error}</p>}
    <label>GDOF programme category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(([slug,label])=><option key={slug} value={slug}>{label}</option>)}</select></label>
    <div className="ai-mode-grid">
      <article className="ai-mode-card"><span className="ai-mode-number">MODE 01</span><h2>Auto-Generate Story</h2><p>Research recent public ReliefWeb reports, prepare a source-grounded external initiative story, and find related Pexels stock images and video.</p><p className="admin-help">The result is clearly marked as an external example, not a GDOF activity or partnership.</p><button type="button" disabled={busy} onClick={()=>generate("auto")}>{busy?"Generating…":"Auto-Generate Story"}</button></article>
      <article className="ai-mode-card"><span className="ai-mode-number">MODE 02</span><h2>What do you have?</h2><label>What have you done or what idea do you have?<textarea rows="6" value={notes} maxLength="12000" onChange={e=>setNotes(e.target.value)} placeholder="Share your field notes, what happened, who was involved (only if appropriate), what was achieved, or describe the idea you want to develop…"/></label><label>Upload your photos (optional)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={e=>setImages(Array.from(e.target.files||[]).slice(0,6))}/></label><small>{images.length} image(s) selected</small><label>Upload a video (optional)<input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e=>setVideo(e.target.files?.[0]||null)}/></label><small>{video?.name||"No video selected; stock fallback will be used"}</small><button type="button" disabled={busy||notes.trim().length<12} onClick={()=>generate("notes")}>{busy?"Preparing draft…":"Create From My Update"}</button></article>
    </div>
    <p className="admin-help">Media fallback is handled per media type. Uploaded files are labelled as Super Admin uploads; Pexels assets are included in the proposed story package. Review the selected media before approval; approving the story also approves its accompanying media for publication.</p>
    <p className="admin-help">Selected category: <strong>{categoryName}</strong>. Drafts remain private until a Super Admin approves them in Pending Approval.</p>
  </section>;
}
