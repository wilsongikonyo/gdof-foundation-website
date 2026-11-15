import { useEffect, useState } from "react";
import "./admin.css";

const tabs = ["Overview", "Website content", "Enquiries", "Donations", "Administrators", "Audit log"];
const defaults = {
  tagline: "Empowering People. Transforming Communities.",
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
  const [newAdmin, setNewAdmin] = useState({ email: "", password: "" });

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

  const login = async e => {
    e.preventDefault(); setBusy(true); setNotice("");
    try { const r = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ email, password }) }); setUser(r.user); setPassword(""); await refresh(); }
    catch (err) { setNotice(err.message); } finally { setBusy(false); }
  };
  const logout = async () => { await api("/api/admin/logout", { method: "POST", body: "{}" }).catch(() => {}); setUser(null); setData({ enquiries: [], donations: [], admins: [], auditLogs: [], content: defaults }); };
  const saveContent = async e => { e.preventDefault(); setBusy(true); setNotice(""); try { await api("/api/admin/content", { method: "PUT", body: JSON.stringify(data.content) }); setNotice("Website content saved."); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const setMessageStatus = async (id, status) => { try { await api("/api/admin/enquiries/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ status }) }); await refresh(); } catch (err) { setNotice(err.message); } };
  const addAdmin = async e => { e.preventDefault(); setBusy(true); try { await api("/api/admin/admins", { method: "POST", body: JSON.stringify(newAdmin) }); setNewAdmin({ email: "", password: "" }); await refresh(); setNotice("Administrator added."); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const toggleAdmin = async (id, active) => { try { await api("/api/admin/admins/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ active: !active }) }); await refresh(); } catch (err) { setNotice(err.message); } };

  if (!user) return <div className="admin-shell"><div className="admin-login"><a className="admin-back" href="/">← Back to GDOF website</a><div className="admin-mark">GDOF</div><p className="admin-eyebrow">SECURE ADMINISTRATION</p><h1>Welcome back.</h1><p className="admin-muted">Sign in to manage the foundation website and records.</p><form onSubmit={login}><label>Administrator email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label><button disabled={busy}>{busy ? "Signing in…" : "Sign in securely →"}</button>{notice && <p className="admin-notice">{notice}</p>}</form><small>Access is restricted to authorized GDOF administrators.</small></div></div>;

  return <div className="admin-app"><aside className="admin-sidebar"><a href="/" className="admin-brand"><span>GDOF</span><b>ADMINISTRATION</b></a><div className="admin-nav-label">WORKSPACE</div>{tabs.map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t}</button>)}<div className="admin-side-bottom"><small>Signed in as</small><b>{user.email}</b><button onClick={logout}>Sign out ↗</button><a href="/">← View public website</a></div></aside>
  <main className="admin-main"><header className="admin-top"><div><span>GDOF / ADMIN</span><h1>{tab}</h1></div><div className="admin-online"><i/> Secure session</div></header>{notice && <div className="admin-banner">{notice}</div>}
  {tab==="Overview" && <><p className="admin-intro">A snapshot of your foundation website and activity.</p><div className="admin-stats"><article><small>ENQUIRIES</small><strong>{data.enquiries.length}</strong><span>Contact submissions</span></article><article><small>DONATIONS RECORDED</small><strong>{data.donations.length}</strong><span>Verified payment records</span></article><article><small>ADMINISTRATORS</small><strong>{data.admins.length}</strong><span>Accounts with access</span></article></div><section className="admin-panel"><h2>Administration checklist</h2><p>Keep public information accurate, review incoming enquiries and confirm donation records against your payment provider.</p><p className="admin-warning">Donation records appear here only after a verified payment webhook has been connected. Never treat a checkout redirect as proof of payment.</p></section></>}
  {tab==="Website content" && <form className="admin-panel admin-editor" onSubmit={saveContent}>
    <p className="admin-intro">Edit the content displayed on your public GDOF website. Save your changes to publish them to the homepage.</p>
    <h2>Homepage introduction</h2>
    <label>Brand tagline<input value={data.content.tagline||""} onChange={e=>setData({...data,content:{...data.content,tagline:e.target.value}})}/></label>
    <label>Hero headline — first line<input value={data.content.heroTitleLine1||""} onChange={e=>setData({...data,content:{...data.content,heroTitleLine1:e.target.value}})}/></label>
    <label>Hero headline — emphasized second line<input value={data.content.heroTitleLine2||""} onChange={e=>setData({...data,content:{...data.content,heroTitleLine2:e.target.value}})}/></label>
    <label>Hero introductory text<textarea rows="3" value={data.content.heroDescription||""} onChange={e=>setData({...data,content:{...data.content,heroDescription:e.target.value}})}/></label>
    <label>About the foundation<textarea rows="5" value={data.content.about||""} onChange={e=>setData({...data,content:{...data.content,about:e.target.value}})}/></label>
    <label>Mission statement<textarea rows="4" value={data.content.mission||""} onChange={e=>setData({...data,content:{...data.content,mission:e.target.value}})}/></label>
    <h2>Our six programs</h2>
    {[1,2,3,4,5,6].map(i=><div className="admin-content-group" key={i}><h3>Program {String(i).padStart(2,"0")}</h3><label>Program title<input value={data.content["program"+i+"Title"]||""} onChange={e=>setData({...data,content:{...data.content,["program"+i+"Title"]:e.target.value}})}/></label><label>Program description<textarea rows="3" value={data.content["program"+i+"Description"]||""} onChange={e=>setData({...data,content:{...data.content,["program"+i+"Description"]:e.target.value}})}/></label></div>)}
    <h2>Leadership and board profiles</h2>
    {[1,2,3,4,5].map(i=><div className="admin-content-group" key={i}><h3>Board member {i}</h3><label>Full name<input value={data.content["leader"+i+"Name"]||""} onChange={e=>setData({...data,content:{...data.content,["leader"+i+"Name"]:e.target.value}})}/></label><label>Position / role<input value={data.content["leader"+i+"Role"]||""} onChange={e=>setData({...data,content:{...data.content,["leader"+i+"Role"]:e.target.value}})}/></label></div>)}
    <h2>Contact information</h2>
    <label>Public contact email<input type="email" value={data.content.contactEmail||""} onChange={e=>setData({...data,content:{...data.content,contactEmail:e.target.value}})}/></label>
    <button disabled={busy}>{busy?"Saving…":"Save and publish website content"}</button>
    <p className="admin-help">Changes are stored in the GDOF database and displayed on the public homepage after saving. Images and the remaining design sections are not yet editable here.</p>
  </form>}
  {tab==="Enquiries" && <section className="admin-panel"><h2>Contact submissions</h2>{data.enquiries.length===0?<p className="admin-muted">No enquiries have been received yet.</p>:<div className="admin-table-wrap"><table><thead><tr><th>Received</th><th>Sender</th><th>Subject / message</th><th>Status</th></tr></thead><tbody>{data.enquiries.map(x=><tr key={x.id}><td>{new Date(x.created_at).toLocaleString()}</td><td><b>{x.name}</b><small>{x.email}</small></td><td><b>{x.subject}</b><p>{x.message}</p></td><td><select value={x.status} onChange={e=>setMessageStatus(x.id,e.target.value)}><option value="new">New</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></td></tr>)}</tbody></table></div>}</section>}
  {tab==="Donations" && <section className="admin-panel"><h2>Donation records</h2><p className="admin-muted">Only payments confirmed by Stripe's signed webhook should be recorded here.</p>{data.donations.length===0?<p>No confirmed donations are recorded yet.</p>:<div className="admin-table-wrap"><table><thead><tr><th>Date</th><th>Donor email</th><th>Amount</th><th>Payment status</th></tr></thead><tbody>{data.donations.map(x=><tr key={x.id}><td>{new Date(x.created_at).toLocaleString()}</td><td>{x.donor_email||"Not provided"}</td><td>{(x.amount_cents/100).toFixed(2)} {x.currency.toUpperCase()}</td><td>{x.payment_status}</td></tr>)}</tbody></table></div>}</section>}
  {tab==="Audit log" && <section className="admin-panel"><h2>Recent administrative activity</h2><p className="admin-muted">A record of important actions performed in the administration system.</p>{!data.auditLogs?.length?<p>No activity has been recorded yet.</p>:<div className="admin-table-wrap"><table><thead><tr><th>Time</th><th>Administrator</th><th>Action</th><th>Details</th></tr></thead><tbody>{data.auditLogs.map(x=><tr key={x.id}><td>{new Date(x.created_at+"Z").toLocaleString()}</td><td>{x.actor_email}</td><td><b>{x.action}</b></td><td>{x.details||"—"}</td></tr>)}</tbody></table></div>}</section>}
  {tab==="Administrators" && <><section className="admin-panel"><h2>Add an administrator</h2><form className="admin-add-form" onSubmit={addAdmin}><label>Email<input type="email" required value={newAdmin.email} onChange={e=>setNewAdmin({...newAdmin,email:e.target.value})}/></label><label>Temporary password<input type="password" minLength="12" required value={newAdmin.password} onChange={e=>setNewAdmin({...newAdmin,password:e.target.value})}/></label><button disabled={busy}>Create account</button></form><p className="admin-help">Use a unique password of at least 12 characters. Share credentials securely and ask the new administrator to change their password after first sign-in.</p></section><section className="admin-panel"><h2>Administrator accounts</h2>{data.admins.map(a=><div className="admin-user" key={a.id}><span><b>{a.email}</b><small>{a.active?"Active":"Disabled"} · Added {new Date(a.created_at).toLocaleDateString()}</small></span><button className="admin-secondary" onClick={()=>toggleAdmin(a.id,!!a.active)}>{a.active?"Disable":"Reactivate"}</button></div>)}</section></>}
  </main></div>;
}
