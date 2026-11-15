import { useEffect, useState } from "react";
import "./admin.css";

const roleTabs = { super_admin: ["Overview", "Website content", "Program stories", "Partners & grants", "Media library", "Enquiries", "Donations", "Administrators", "Audit log"], editor: ["Overview", "Website content", "Program stories", "Media library", "Enquiries"], finance: ["Overview", "Donations"], viewer: ["Overview"] };
const roleLabels = { super_admin: "Super Admin", editor: "Editor", finance: "Finance", viewer: "Viewer" };
const defaults = {
  tagline: "Empowering People. Transforming Communities.",
  heroFoot: "A foundation focused on people and lasting progress.", programsIntro: "Our programs are designed around the needs people face and the potential every community holds.", governanceIntro: "GDOF is overseen by its Board of Directors, with day-to-day leadership responsible for implementing board-approved priorities.",
  announcementEnabled: "false", announcementTitle: "", announcementText: "", announcementLinkText: "", announcementLinkUrl: "",
  adminLoginButtonEnabled: "false",
  resource1Title: "", resource1Description: "", resource1Url: "", resource2Title: "", resource2Description: "", resource2Url: "", resource3Title: "", resource3Description: "", resource3Url: "",
  about: "Global Development and Opportunity Foundation (GDOF) is a Delaware-incorporated nonprofit organization working to advance human wellbeing and sustainable community development.",
  mission: "We believe lasting development begins when people have access to the support, resources and opportunities to shape their own future.",
  contactEmail: "",
  heroTitleLine1: "Opportunity can",
  heroTitleLine2: "change everything.",
  heroDescription: "We work to expand opportunity, strengthen communities and help people build more secure, hopeful futures.",
  program1Title: "Food Security & Family Support",
  program1Description: "Helping households facing hardship access essential food and practical support, with dignity and care.",
  program2Title: "Education & Bursaries",
  program2Description: "Expanding access to learning through education assistance for deserving secondary, college and university students.",
  program3Title: "Youth Entrepreneurship",
  program3Description: "Supporting promising youth-led ideas through charitable grants, mentorship and pathways to sustainable enterprise.",
  program4Title: "Employment & Livelihoods",
  program4Description: "Helping people overcome barriers to work and build stable livelihoods through practical opportunity and support.",
  program5Title: "Community Development",
  program5Description: "Working with communities and partners on locally relevant initiatives that strengthen resilience and wellbeing.",
  program6Title: "Emergency Relief",
  program6Description: "Coordinating responsive assistance for communities affected by emergencies and unexpected hardship.",
  program7Title: "Animal Rescue & Welfare",
  program7Description: "Providing occasional donations or practical assistance to responsible individuals and community rescuers who care for animals in need, including help with food, veterinary treatment and safe shelter.",
  leader1Name: "Wilson Maira Gikonyo", leader1Role: "Founder & Executive Director",
  leader2Name: "Rachael Maina", leader2Role: "President & Board Chairperson",
  leader3Name: "Mourene Maina", leader3Role: "Treasurer",
  leader4Name: "Samson Kibe", leader4Role: "Secretary",
  leader5Name: "Morris Kyalo", leader5Role: "Independent Director",
};

export default function Admin() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState("Overview");
  const [data, setData] = useState({ enquiries: [], donations: [], admins: [], auditLogs: [], content: defaults });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: "", password: "", role: "editor" });
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [stories, setStories] = useState([]);
  const [storyForm, setStoryForm] = useState({id:"",program:"1",title:"",summary:"",body:"",imageUrl:"",imageAlt:"",caption:"",publishedAt:new Date().toISOString().slice(0,10),published:false});
  const [storyBusy, setStoryBusy] = useState(false);
  const [partnerships,setPartnerships]=useState([]);
  const [partnerBusy,setPartnerBusy]=useState(false);
  const [partnerForm,setPartnerForm]=useState({id:"",partnerName:"",partnerType:"Foundation / charitable trust",title:"",program:"",supportType:"Grant funding",amount:"",currency:"USD",startDate:"",endDate:"",status:"Active",publicDescription:"",internalNotes:"",showPublic:false});
  const tabs = roleTabs[user?.role || "super_admin"] || roleTabs.viewer;

  const api = async (path, options = {}) => {
    const response = await fetch(path, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "The request could not be completed.");
    return result;
  };
  const refresh = async () => {
    const result = await api("/api/admin/data");
    setData({ ...result, content: { ...defaults, ...(result.content || {}) } });
  };
  useEffect(() => { api("/api/admin/me").then(r => { setUser(r.user); return refresh(); }).catch(() => {}); }, []);

  const loadMedia = async () => {
    setMediaBusy(true);
    try { const result=await api("/api/admin/media"); setMediaFiles(result.files||[]); }
    catch(err) { setNotice(err.message); }
    finally { setMediaBusy(false); }
  };
  useEffect(() => { if (user && (tab==="Media library" || tab==="Program stories")) loadMedia(); }, [user,tab]);
  const loadStories = async () => {
    try { const result=await api("/api/admin/stories"); setStories(result.stories||[]); }
    catch(err) { setNotice(err.message); }
  };
  useEffect(() => { if (user && tab==="Program stories") loadStories(); }, [user,tab]);
  const loadPartnerships=async()=>{try{const result=await api("/api/admin/partnerships");setPartnerships(result.partnerships||[]);}catch(err){setNotice(err.message);}};
  useEffect(()=>{if(user&&tab==="Partners & grants")loadPartnerships();},[user,tab]);
  const savePartnership=async e=>{e.preventDefault();setPartnerBusy(true);setNotice("");try{const item={...partnerForm,id:partnerForm.id||crypto.randomUUID()};const next=partnerForm.id?partnerships.map(x=>x.id===partnerForm.id?item:x):[item,...partnerships];const result=await api("/api/admin/partnerships",{method:"PUT",body:JSON.stringify({partnerships:next})});setPartnerships(result.partnerships||next);setPartnerForm({id:"",partnerName:"",partnerType:"Foundation / charitable trust",title:"",program:"",supportType:"Grant funding",amount:"",currency:"USD",startDate:"",endDate:"",status:"Active",publicDescription:"",internalNotes:"",showPublic:false});setNotice(item.id&&partnerships.some(x=>x.id===item.id)?"Partnership record updated.":"Partnership record added.");}catch(err){setNotice(err.message);}finally{setPartnerBusy(false);}};
  const editPartnership=item=>{setPartnerForm({...item});window.scrollTo({top:0,behavior:"smooth"});};
  const deletePartnership=async id=>{if(!window.confirm("Delete this partner/grant record?"))return;setPartnerBusy(true);try{const next=partnerships.filter(x=>x.id!==id);const result=await api("/api/admin/partnerships",{method:"PUT",body:JSON.stringify({partnerships:next})});setPartnerships(result.partnerships||next);setNotice("Partnership record deleted.");}catch(err){setNotice(err.message);}finally{setPartnerBusy(false);}};
  const uploadStoryImage = async e => {
    const file=e.target.files?.[0]; if(!file) return;
    setStoryBusy(true); setNotice("");
    try {
      const form=new FormData(); form.append("file",file);
      const response=await fetch("/api/admin/media",{method:"POST",credentials:"same-origin",body:form});
      const result=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(result.error||"Image upload failed.");
      setStoryForm(current=>({...current,imageUrl:result.file.url,imageAlt:current.imageAlt||file.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," ")}));
      await loadMedia();
      setNotice("Image uploaded and saved in the Media Library, and attached to this story.");
    } catch(err) { setNotice(err.message); }
    finally { setStoryBusy(false); e.target.value=""; }
  };
  const saveStory = async e => {
    e.preventDefault(); setStoryBusy(true); setNotice("");
    try {
      const item={...storyForm,id:storyForm.id||crypto.randomUUID()};
      const next=storyForm.id?stories.map(x=>x.id===storyForm.id?item:x):[item,...stories];
      const result=await api("/api/admin/stories",{method:"PUT",body:JSON.stringify({stories:next})});
      setStories(result.stories||next);
      setStoryForm({id:"",program:"1",title:"",summary:"",body:"",imageUrl:"",imageAlt:"",caption:"",publishedAt:new Date().toISOString().slice(0,10),published:false});
      setNotice(item.published?"Story published successfully.":"Story saved as a draft.");
    } catch(err) { setNotice(err.message); }
    finally { setStoryBusy(false); }
  };
  const editStory = story => { setStoryForm({...story}); window.scrollTo({top:0,behavior:"smooth"}); };
  const deleteStory = async id => {
    if(!window.confirm("Delete this program story?")) return;
    setStoryBusy(true);
    try { const next=stories.filter(x=>x.id!==id); const result=await api("/api/admin/stories",{method:"PUT",body:JSON.stringify({stories:next})}); setStories(result.stories||next); setNotice("Story deleted."); }
    catch(err) { setNotice(err.message); } finally { setStoryBusy(false); }
  };
  const uploadMedia = async e => {
    const file=e.target.files?.[0]; if(!file) return;
    setMediaBusy(true); setNotice("");
    try {
      const form=new FormData(); form.append("file",file);
      const response=await fetch("/api/admin/media",{method:"POST",credentials:"same-origin",body:form});
      const result=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(result.error||"Image upload failed.");
      await loadMedia(); setNotice("Image uploaded successfully.");
    } catch(err) { setNotice(err.message); }
    finally { setMediaBusy(false); e.target.value=""; }
  };
  const deleteMedia = async key => {
    if(!window.confirm("Delete this image permanently? Any page using its URL will no longer display it.")) return;
    setMediaBusy(true); setNotice("");
    try {
      const response=await fetch("/api/admin/media/"+key.split("/").map(encodeURIComponent).join("/"),{method:"DELETE",credentials:"same-origin"});
      const result=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(result.error||"Could not delete image.");
      setMediaFiles(files=>files.filter(file=>file.key!==key)); setNotice("Image deleted.");
    } catch(err) { setNotice(err.message); }
    finally { setMediaBusy(false); }
  };
  const login = async e => {
    e.preventDefault(); setBusy(true); setNotice("");
    try { const r = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ email, password }) }); setUser(r.user); setPassword(""); await refresh(); }
    catch (err) { setNotice(err.message); } finally { setBusy(false); }
  };
  const logout = async () => { await api("/api/admin/logout", { method: "POST", body: "{}" }).catch(() => {}); setUser(null); setData({ enquiries: [], donations: [], admins: [], auditLogs: [], content: defaults }); };
  const saveContent = async e => { e.preventDefault(); setBusy(true); setNotice(""); try { await api("/api/admin/content", { method: "PUT", body: JSON.stringify(data.content) }); setNotice("Website content saved."); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const setMessageStatus = async (id, status) => { try { await api("/api/admin/enquiries/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ status }) }); await refresh(); } catch (err) { setNotice(err.message); } };
  const addAdmin = async e => { e.preventDefault(); setBusy(true); try { await api("/api/admin/admins", { method: "POST", body: JSON.stringify(newAdmin) }); setNewAdmin({ email: "", password: "", role: "editor" }); await refresh(); setNotice("Administrator added."); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const changeAdminRole = async (id, role) => { try { await api("/api/admin/admins/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ role }) }); await refresh(); setNotice("Administrator role updated."); } catch (err) { setNotice(err.message); } };
  const toggleAdmin = async (id, active) => { try { await api("/api/admin/admins/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ active: !active }) }); await refresh(); } catch (err) { setNotice(err.message); } };

  if (!user) return <div className="admin-shell"><div className="admin-login"><a className="admin-back" href="/">← Back to GDOF website</a><div className="admin-mark">GDOF</div><p className="admin-eyebrow">SECURE ADMINISTRATION</p><h1>Welcome back.</h1><p className="admin-muted">Sign in to manage the foundation website and records.</p><form onSubmit={login}><label>Administrator email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label><button disabled={busy}>{busy ? "Signing in…" : "Sign in securely →"}</button>{notice && <p className="admin-notice">{notice}</p>}</form><small>Access is restricted to authorized GDOF administrators.</small></div></div>;

  return <div className="admin-app"><aside className="admin-sidebar"><a href="/" className="admin-brand"><span>GDOF</span><b>ADMINISTRATION</b></a><div className="admin-nav-label">WORKSPACE</div><div className="admin-role-label">{roleLabels[user.role] || "Viewer"}</div>{tabs.map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t}</button>)}<div className="admin-side-bottom"><small>Signed in as</small><b>{user.email}</b><button onClick={logout}>Sign out ↗</button><a href="/">← View public website</a></div></aside>
  <main className="admin-main"><header className="admin-top"><div><span>GDOF / ADMIN</span><h1>{tab}</h1></div><div className="admin-online"><i/> Secure session</div></header>{notice && <div className="admin-banner">{notice}</div>}
  {tab==="Overview" && <><p className="admin-intro">A snapshot of your foundation website and activity.</p><div className="admin-stats"><article><small>ENQUIRIES</small><strong>{data.counts?.enquiries ?? data.enquiries.length}</strong><span>Contact submissions</span></article><article><small>DONATIONS RECORDED</small><strong>{data.counts?.donations ?? data.donations.length}</strong><span>Verified payment records</span></article><article><small>ADMINISTRATORS</small><strong>{data.counts?.admins ?? "—"}</strong><span>Accounts with access</span></article></div><section className="admin-panel"><h2>Administration checklist</h2><p>Keep public information accurate, review incoming enquiries and confirm donation records against your payment provider.</p><p className="admin-warning">Donation records appear here only after a verified payment webhook has been connected. Never treat a checkout redirect as proof of payment.</p></section></>}
  {tab==="Website content" && <form className="admin-panel admin-editor" onSubmit={saveContent}>
    <p className="admin-intro">Edit the content displayed on your public GDOF website. Save your changes to publish them to the homepage.</p>
    <h2>Homepage introduction</h2>
    <label>Brand tagline<input value={data.content.tagline||""} onChange={e=>setData({...data,content:{...data.content,tagline:e.target.value}})}/></label>
    <label>Hero headline — first line<input value={data.content.heroTitleLine1||""} onChange={e=>setData({...data,content:{...data.content,heroTitleLine1:e.target.value}})}/></label>
    <label>Hero headline — emphasized second line<input value={data.content.heroTitleLine2||""} onChange={e=>setData({...data,content:{...data.content,heroTitleLine2:e.target.value}})}/></label>
    <label>Hero introductory text<textarea rows="3" value={data.content.heroDescription||""} onChange={e=>setData({...data,content:{...data.content,heroDescription:e.target.value}})}/></label>
    <label>About the foundation<textarea rows="5" value={data.content.about||""} onChange={e=>setData({...data,content:{...data.content,about:e.target.value}})}/></label>
    <label>Mission statement<textarea rows="4" value={data.content.mission||""} onChange={e=>setData({...data,content:{...data.content,mission:e.target.value}})}/></label>

    <h2>Additional homepage content</h2>
    <label>Hero supporting line<input value={data.content.heroFoot||""} onChange={e=>setData({...data,content:{...data.content,heroFoot:e.target.value}})}/></label>
    <label>Programs introduction<textarea rows="2" value={data.content.programsIntro||""} onChange={e=>setData({...data,content:{...data.content,programsIntro:e.target.value}})}/></label>
    <label>Governance introduction<textarea rows="2" value={data.content.governanceIntro||""} onChange={e=>setData({...data,content:{...data.content,governanceIntro:e.target.value}})}/></label>
    <h2>Admin access link</h2>
    <p className="admin-help">The administration dashboard remains available at /admin whether or not its public navigation link is displayed.</p>
    <label><span><input type="checkbox" checked={data.content.adminLoginButtonEnabled==="true"} onChange={e=>setData({...data,content:{...data.content,adminLoginButtonEnabled:e.target.checked?"true":"false"}})}/> Show Admin Login link in the public website navigation</span></label>
    <h2>Homepage announcement</h2>
    <label><span><input type="checkbox" checked={data.content.announcementEnabled==="true"} onChange={e=>setData({...data,content:{...data.content,announcementEnabled:e.target.checked?"true":"false"}})}/> Display announcement banner</span></label>
    <label>Announcement heading<input value={data.content.announcementTitle||""} onChange={e=>setData({...data,content:{...data.content,announcementTitle:e.target.value}})}/></label>
    <label>Announcement message<textarea rows="2" value={data.content.announcementText||""} onChange={e=>setData({...data,content:{...data.content,announcementText:e.target.value}})}/></label>
    <label>Link label<input value={data.content.announcementLinkText||""} onChange={e=>setData({...data,content:{...data.content,announcementLinkText:e.target.value}})}/></label>
    <label>Link URL (HTTPS)<input type="url" value={data.content.announcementLinkUrl||""} onChange={e=>setData({...data,content:{...data.content,announcementLinkUrl:e.target.value}})}/></label>
    <h2>Public documents and resources</h2>
    <p className="admin-help">Paste public HTTPS links to approved policies, annual reports or other documents hosted securely.</p>
    {[1,2,3].map(i=><div className="admin-content-group" key={i}><h3>Resource {i}</h3><label>Title<input value={data.content["resource"+i+"Title"]||""} onChange={e=>setData({...data,content:{...data.content,["resource"+i+"Title"]:e.target.value}})}/></label><label>Description<input value={data.content["resource"+i+"Description"]||""} onChange={e=>setData({...data,content:{...data.content,["resource"+i+"Description"]:e.target.value}})}/></label><label>Public URL<input type="url" value={data.content["resource"+i+"Url"]||""} onChange={e=>setData({...data,content:{...data.content,["resource"+i+"Url"]:e.target.value}})}/></label></div>)}
    <h2>Our seven programs</h2>
    {[1,2,3,4,5,6,7].map(i=><div className="admin-content-group" key={i}><h3>Program {String(i).padStart(2,"0")}</h3><label>Program title<input value={data.content["program"+i+"Title"]||""} onChange={e=>setData({...data,content:{...data.content,["program"+i+"Title"]:e.target.value}})}/></label><label>Program description<textarea rows="3" value={data.content["program"+i+"Description"]||""} onChange={e=>setData({...data,content:{...data.content,["program"+i+"Description"]:e.target.value}})}/></label></div>)}
    <h2>Leadership and board profiles</h2>
    {[1,2,3,4,5].map(i=><div className="admin-content-group" key={i}><h3>Board member {i}</h3><label>Full name<input value={data.content["leader"+i+"Name"]||""} onChange={e=>setData({...data,content:{...data.content,["leader"+i+"Name"]:e.target.value}})}/></label><label>Position / role<input value={data.content["leader"+i+"Role"]||""} onChange={e=>setData({...data,content:{...data.content,["leader"+i+"Role"]:e.target.value}})}/></label></div>)}
    <h2>Contact information</h2>
    <label>Public contact email<input type="email" value={data.content.contactEmail||""} onChange={e=>setData({...data,content:{...data.content,contactEmail:e.target.value}})}/></label>
    <button disabled={busy}>{busy?"Saving…":"Save and publish website content"}</button>
    <p className="admin-help">Changes are stored in the GDOF database and displayed on the public homepage after saving. Images and the remaining design sections are not yet editable here.</p>
  </form>}
  {tab==="Program stories" && <section className="admin-panel admin-stories">
    <p className="admin-intro">Create project updates and activity stories under one of GDOF's six program categories. Images uploaded here are also saved in the Media Library.</p>
    <form className="story-editor" onSubmit={saveStory}>
      <h2>{storyForm.id?"Edit program story":"Add a program story"}</h2>
      <label>Program category<select value={storyForm.program} onChange={e=>setStoryForm({...storyForm,program:e.target.value})}>{["Food Security & Family Support","Education & Bursaries","Youth Entrepreneurship","Employment & Livelihoods","Community Development","Emergency Relief","Animal Rescue & Welfare"].map((name,i)=><option value={String(i+1)} key={name}>{name}</option>)}</select></label>
      <label>Story title<input required maxLength="180" value={storyForm.title} onChange={e=>setStoryForm({...storyForm,title:e.target.value})} placeholder="e.g. Supporting young entrepreneurs through mobility"/></label>
      <label>Short summary<textarea required rows="2" maxLength="900" value={storyForm.summary} onChange={e=>setStoryForm({...storyForm,summary:e.target.value})} placeholder="A short introduction visitors will see before opening the story."/></label>
      <label>Full story<textarea required rows="7" maxLength="20000" value={storyForm.body} onChange={e=>setStoryForm({...storyForm,body:e.target.value})} placeholder="Describe the activity, its purpose, participants and verified outcomes."/></label>
      <div className="story-image-upload"><h3>Story photograph</h3>{storyForm.imageUrl&&<img src={storyForm.imageUrl} alt={storyForm.imageAlt||"Story preview"}/>}<label className="media-upload-button">＋ Upload photograph<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadStoryImage} disabled={storyBusy}/></label><p className="admin-help">The photograph uploads directly to R2 and appears in your Media Library automatically. JPG, PNG, WebP or GIF; maximum 8 MB.</p><label>Or choose an existing Media Library image<select value={storyForm.imageUrl} onChange={e=>setStoryForm({...storyForm,imageUrl:e.target.value})}><option value="">No image selected</option>{mediaFiles.map(file=><option key={file.key} value={file.url}>{file.key.split("/").pop()}</option>)}</select></label><label>Image description (alt text)<input value={storyForm.imageAlt} onChange={e=>setStoryForm({...storyForm,imageAlt:e.target.value})} placeholder="Describe what the photograph shows"/></label><label>Photo caption<input value={storyForm.caption} onChange={e=>setStoryForm({...storyForm,caption:e.target.value})} placeholder="Optional caption"/></label></div>
      <label>Activity / publication date<input type="date" value={storyForm.publishedAt} onChange={e=>setStoryForm({...storyForm,publishedAt:e.target.value})}/></label>
      <label className="story-publish"><input type="checkbox" checked={storyForm.published} onChange={e=>setStoryForm({...storyForm,published:e.target.checked})}/> Publish this story on the public website</label>
      <div className="story-actions"><button disabled={storyBusy}>{storyBusy?"Saving…":storyForm.id?"Save story changes":"Save program story"}</button>{storyForm.id&&<button type="button" className="admin-secondary" onClick={()=>setStoryForm({id:"",program:"1",title:"",summary:"",body:"",imageUrl:"",imageAlt:"",caption:"",publishedAt:new Date().toISOString().slice(0,10),published:false})}>Cancel edit</button>}</div>
    </form>
    <h2>Existing program stories ({stories.length})</h2>
    {stories.length===0?<p className="admin-muted">No stories yet. Add your first story above.</p>:<div className="admin-table-wrap"><table><thead><tr><th>Story</th><th>Program</th><th>Status</th><th>Actions</th></tr></thead><tbody>{stories.map(story=><tr key={story.id}><td><b>{story.title}</b><small>{story.publishedAt||"No date"}</small></td><td>{["Food Security","Education","Youth Entrepreneurship","Employment","Community Development","Emergency Relief","Animal Rescue"][Number(story.program)-1]}</td><td>{story.published?"Published":"Draft"}</td><td><div className="story-actions"><button type="button" className="admin-secondary" onClick={()=>editStory(story)}>Edit</button><button type="button" className="admin-danger" onClick={()=>deleteStory(story.id)} disabled={storyBusy}>Delete</button></div></td></tr>)}</tbody></table></div>}
  </section>}
  {tab==="Partners & grants" && <section className="admin-panel admin-stories">
    <p className="admin-intro">Keep an internal register of GDOF grants, institutional partners, sponsorships, programme collaborations and in-kind support. Only records marked for public display appear on the website. Internal notes and funding amounts are never published publicly.</p>
    <form className="story-editor" onSubmit={savePartnership}>
      <h2>{partnerForm.id?"Edit partner / grant record":"Add a partner or grant"}</h2>
      <div className="admin-partner-grid">
        <label>Partner / funder name<input required maxLength="180" value={partnerForm.partnerName} onChange={e=>setPartnerForm({...partnerForm,partnerName:e.target.value})} placeholder="Organisation, government agency or individual"/></label>
        <label>Partner type<select value={partnerForm.partnerType} onChange={e=>setPartnerForm({...partnerForm,partnerType:e.target.value})}>{["Government / public institution","Philanthropist / individual donor","Foundation / charitable trust","NGO / nonprofit organisation","Corporate / business","Development agency / multilateral","University / research institution","Community-based organisation","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Grant / partnership / project title<input required maxLength="180" value={partnerForm.title} onChange={e=>setPartnerForm({...partnerForm,title:e.target.value})} placeholder="e.g. Youth enterprise support partnership"/></label>
        <label>GDOF programme<select value={partnerForm.program} onChange={e=>setPartnerForm({...partnerForm,program:e.target.value})}><option value="">Cross-programme / not specified</option>{["Food Security & Family Support","Education & Bursaries","Youth Entrepreneurship","Employment & Livelihoods","Community Development","Emergency Relief","Animal Rescue & Welfare"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Type of support<select value={partnerForm.supportType} onChange={e=>setPartnerForm({...partnerForm,supportType:e.target.value})}>{["Grant funding","Programme sponsorship","Co-funded project","Implementation partnership","Technical assistance","In-kind support","Research / knowledge partnership","Volunteer collaboration","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Amount / estimated value (internal)<input type="number" min="0" step="0.01" value={partnerForm.amount} onChange={e=>setPartnerForm({...partnerForm,amount:e.target.value})} placeholder="Optional"/></label>
        <label>Currency<select value={partnerForm.currency} onChange={e=>setPartnerForm({...partnerForm,currency:e.target.value})}>{["USD","KES","EUR","GBP","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Start date<input type="date" value={partnerForm.startDate} onChange={e=>setPartnerForm({...partnerForm,startDate:e.target.value})}/></label>
        <label>End date / expected completion<input type="date" value={partnerForm.endDate} onChange={e=>setPartnerForm({...partnerForm,endDate:e.target.value})}/></label>
        <label>Status<select value={partnerForm.status} onChange={e=>setPartnerForm({...partnerForm,status:e.target.value})}>{["Prospective","Under discussion","Application submitted","Awarded / confirmed","Active","Completed","On hold","Declined","Terminated"].map(x=><option key={x}>{x}</option>)}</select></label>
      </div>
      <label>Public description<textarea rows="4" maxLength="3000" value={partnerForm.publicDescription} onChange={e=>setPartnerForm({...partnerForm,publicDescription:e.target.value})} placeholder="Describe the confirmed partnership and what it supports. Only use information approved for public sharing."/></label>
      <label>Internal notes (not public)<textarea rows="3" maxLength="5000" value={partnerForm.internalNotes} onChange={e=>setPartnerForm({...partnerForm,internalNotes:e.target.value})} placeholder="Private administrative notes, follow-ups, reporting requirements, agreement references, etc."/></label>
      <label className="story-publish"><input type="checkbox" checked={partnerForm.showPublic} onChange={e=>setPartnerForm({...partnerForm,showPublic:e.target.checked})}/> Display this confirmed partnership on the public website</label>
      <p className="admin-help">Only publish a partner's name, relationship and description after permission and details have been verified. Prospective or unconfirmed discussions should remain private.</p>
      <div className="story-actions"><button disabled={partnerBusy}>{partnerBusy?"Saving…":partnerForm.id?"Save partnership changes":"Save partner / grant record"}</button>{partnerForm.id&&<button type="button" className="admin-secondary" onClick={()=>setPartnerForm({id:"",partnerName:"",partnerType:"Foundation / charitable trust",title:"",program:"",supportType:"Grant funding",amount:"",currency:"USD",startDate:"",endDate:"",status:"Active",publicDescription:"",internalNotes:"",showPublic:false})}>Cancel edit</button>}</div>
    </form>
    <h2>Partner & grant register ({partnerships.length})</h2>
    {!partnerships.length?<p className="admin-muted">No partner or grant records have been added yet.</p>:<div className="admin-table-wrap"><table><thead><tr><th>Partner / project</th><th>Support</th><th>Duration</th><th>Status</th><th>Website</th><th>Actions</th></tr></thead><tbody>{partnerships.map(item=><tr key={item.id}><td><b>{item.partnerName}</b><small>{item.title}</small></td><td>{item.supportType}<small>{item.program||"Cross-programme"}</small></td><td>{item.startDate||"—"}<small>to {item.endDate||"Open-ended"}</small></td><td>{item.status}</td><td>{item.showPublic?"Public":"Private"}</td><td><div className="story-actions"><button type="button" className="admin-secondary" onClick={()=>editPartnership(item)}>Edit</button><button type="button" className="admin-danger" disabled={partnerBusy} onClick={()=>deletePartnership(item.id)}>Delete</button></div></td></tr>)}</tbody></table></div>}
  </section>}
  {tab==="Media library" && <section className="admin-panel admin-media">
    <p className="admin-intro">Upload and manage approved GDOF photographs. Supported formats: JPG, PNG, WebP and GIF. Maximum file size: 8 MB.</p>
    <div className="media-upload"><label className="media-upload-button">＋ Upload image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadMedia} disabled={mediaBusy}/></label><button className="admin-secondary" type="button" onClick={loadMedia} disabled={mediaBusy}>Refresh library</button><span>{mediaFiles.length} image{mediaFiles.length===1?"":"s"}</span></div>
    {mediaBusy&&<p className="admin-muted">Working…</p>}
    {!mediaBusy&&mediaFiles.length===0?<p className="admin-muted">No images uploaded yet. Upload your first GDOF photograph to get started.</p>:<div className="media-grid">{mediaFiles.map(file=><article className="media-card" key={file.key}><a href={file.url} target="_blank" rel="noreferrer"><img src={file.url} alt="GDOF media" loading="lazy"/></a><small>{file.key.split("/").pop()}</small><div><button type="button" className="admin-secondary" onClick={()=>{navigator.clipboard?.writeText(new URL(file.url,window.location.origin).href);setNotice("Image URL copied.");}}>Copy URL</button><button type="button" className="admin-danger" onClick={()=>deleteMedia(file.key)} disabled={mediaBusy}>Delete</button></div></article>)}</div>}
    <p className="admin-help">Uploaded images are stored privately in the GDOF R2 bucket and delivered through the website. Deleting an image breaks any page or document that uses its URL.</p>
  </section>}
  {tab==="Enquiries" && <section className="admin-panel"><h2>Contact submissions</h2>{data.enquiries.length===0?<p className="admin-muted">No enquiries have been received yet.</p>:<div className="admin-table-wrap"><table><thead><tr><th>Received</th><th>Sender</th><th>Subject / message</th><th>Status</th></tr></thead><tbody>{data.enquiries.map(x=><tr key={x.id}><td>{new Date(x.created_at).toLocaleString()}</td><td><b>{x.name}</b><small>{x.email}</small></td><td><b>{x.subject}</b><p>{x.message}</p></td><td><select value={x.status} onChange={e=>setMessageStatus(x.id,e.target.value)}><option value="new">New</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></td></tr>)}</tbody></table></div>}</section>}
  {tab==="Donations" && <section className="admin-panel"><h2>Donation records</h2><p className="admin-muted">Only payments confirmed by Stripe's signed webhook should be recorded here.</p>{data.donations.length===0?<p>No confirmed donations are recorded yet.</p>:<div className="admin-table-wrap"><table><thead><tr><th>Date</th><th>Donor email</th><th>Amount</th><th>Payment status</th></tr></thead><tbody>{data.donations.map(x=><tr key={x.id}><td>{new Date(x.created_at).toLocaleString()}</td><td>{x.donor_email||"Not provided"}</td><td>{(x.amount_cents/100).toFixed(2)} {x.currency.toUpperCase()}</td><td>{x.payment_status}</td></tr>)}</tbody></table></div>}</section>}
  {tab==="Audit log" && <section className="admin-panel"><h2>Recent administrative activity</h2><p className="admin-muted">A record of important actions performed in the administration system.</p>{!data.auditLogs?.length?<p>No activity has been recorded yet.</p>:<div className="admin-table-wrap"><table><thead><tr><th>Time</th><th>Administrator</th><th>Action</th><th>Details</th></tr></thead><tbody>{data.auditLogs.map(x=><tr key={x.id}><td>{new Date(x.created_at+"Z").toLocaleString()}</td><td>{x.actor_email}</td><td><b>{x.action}</b></td><td>{x.details||"—"}</td></tr>)}</tbody></table></div>}</section>}
  {tab==="Administrators" && <><section className="admin-panel"><h2>Add an administrator</h2><form className="admin-add-form" onSubmit={addAdmin}><label>Email<input type="email" required value={newAdmin.email} onChange={e=>setNewAdmin({...newAdmin,email:e.target.value})}/></label><label>Temporary password<input type="password" minLength="12" required value={newAdmin.password} onChange={e=>setNewAdmin({...newAdmin,password:e.target.value})}/></label><label>Administrator role<select value={newAdmin.role} onChange={e=>setNewAdmin({...newAdmin,role:e.target.value})}><option value="editor">Editor</option><option value="finance">Finance</option><option value="viewer">Viewer</option><option value="super_admin">Super Admin</option></select></label><button disabled={busy}>Create account</button></form><p className="admin-help">Use a unique password of at least 12 characters. Share credentials securely and ask the new administrator to change their password after first sign-in.</p></section><section className="admin-panel"><h2>Administrator accounts</h2>{data.admins.map(a=><div className="admin-user" key={a.id}><span><b>{a.email}</b><small>{a.active?"Active":"Disabled"} · {roleLabels[a.role] || "Super Admin"} · Added {new Date(a.created_at).toLocaleDateString()}</small></span><div className="admin-user-actions"><select aria-label={"Role for "+a.email} value={a.role||"super_admin"} onChange={e=>changeAdminRole(a.id,e.target.value)}><option value="super_admin">Super Admin</option><option value="editor">Editor</option><option value="finance">Finance</option><option value="viewer">Viewer</option></select><button className="admin-secondary" onClick={()=>toggleAdmin(a.id,!!a.active)}>{a.active?"Disable":"Reactivate"}</button></div></div>)}</section></>}
  </main></div>;
}
