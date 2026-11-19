import { useEffect, useMemo, useState } from "react";
import "./documents.css";

const templates = {
  "Board Resolution": "RESOLUTION\n\nWHEREAS, [insert background and purpose];\n\nNOW, THEREFORE, BE IT RESOLVED THAT:\n1. [Insert resolution]\n2. [Insert delegated authority and any limits]\n\nFURTHER RESOLVED, that this resolution shall be entered into the official records of the Corporation.",
  "Board Meeting Minutes": "1. CALL TO ORDER\n[Record the chairperson and time]\n\n2. ATTENDANCE AND QUORUM\n[List directors present and absent; confirm quorum]\n\n3. APPROVAL OF PRIOR MINUTES\n[Record decision]\n\n4. AGENDA ITEMS AND DISCUSSION\n[Record material discussion and decisions]\n\n5. RESOLUTIONS AND ACTION ITEMS\n[Record exact resolutions, responsible persons and deadlines]\n\n6. ADJOURNMENT\n[Record closing time]",
  "Members' Meeting Minutes": "1. CALL TO ORDER\n[Record convenor and time]\n\n2. NOTICE AND QUORUM\n[Record notice and members present]\n\n3. MATTERS CONSIDERED\n[Record discussion]\n\n4. VOTES AND RESOLUTIONS\n[Record motions and results accurately]\n\n5. ADJOURNMENT\n[Record closing time]",
  "Official Letter": "Dear [Recipient],\n\n[Write the purpose of this letter and the relevant details.]\n\nPlease contact the Foundation if any further information is required.\n\nYours sincerely,",
  "Policy / Procedure": "1. PURPOSE\n[Explain why this policy exists]\n\n2. SCOPE\n[Who and what it applies to]\n\n3. POLICY STATEMENT\n[State the policy]\n\n4. ROLES AND RESPONSIBILITIES\n[Set out responsibilities]\n\n5. PROCEDURE\n[Describe the steps]\n\n6. RECORDS AND REVIEW\n[State recordkeeping and review arrangements]\n\n7. APPROVAL\n[Record approving authority and effective date]",
  "Programme / Activity Report": "1. EXECUTIVE SUMMARY\n[Summarise the activity]\n\n2. OBJECTIVES\n[List approved objectives]\n\n3. ACTIVITIES COMPLETED\n[Describe verified activities]\n\n4. RESULTS AND EVIDENCE\n[Report confirmed outputs and outcomes]\n\n5. FINANCIAL SUMMARY\n[Include approved figures and explain variances]\n\n6. CHALLENGES AND LESSONS\n[Describe issues and learning]\n\n7. NEXT STEPS\n[List actions and responsible persons]",
  "Custom Document": ""
};

export default function AdminDocuments({ onNotice }) {
  const [kind,setKind]=useState("Board Resolution");
  const [title,setTitle]=useState("Board Resolution");
  const [reference,setReference]=useState("");
  const [documentDate,setDocumentDate]=useState(new Date().toISOString().slice(0,10));
  const [recipient,setRecipient]=useState("");
  const [preparedBy,setPreparedBy]=useState("Wilson Maira Gikonyo — Founder & Executive Director");
  const [body,setBody]=useState(templates["Board Resolution"]);
  const [includeSignatureLines,setIncludeSignatureLines]=useState(true);
  const [includeRecipient,setIncludeRecipient]=useState(false);
  const [includePreparedBy,setIncludePreparedBy]=useState(true);
  const [notice,setLocalNotice]=useState("");
  const [documents,setDocuments]=useState([]); const [activeDocument,setActiveDocument]=useState(null); const [loadingDocuments,setLoadingDocuments]=useState(false); const [saving,setSaving]=useState(false); const [changeNote,setChangeNote]=useState("");
  const formattedDate=useMemo(()=>documentDate?new Date(documentDate+"T00:00:00").toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"}):"",[documentDate]);

  const chooseTemplate=value=>{
    setKind(value); setTitle(value==="Custom Document"?"":value);
    setBody(templates[value]||"");
    setLocalNotice("");
  };
  const esc=value=>String(value||"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  const buildHtml=()=>{
    const paragraphs=body.split(/\\n\\s*\\n/).map(part=>'<p>'+esc(part).replace(/\\n/g,"<br>")+'</p>').join("");
    return '<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>@page{size:A4;margin:25mm 20mm 22mm}body{font-family:Arial,sans-serif;color:#23384b;font-size:11pt;line-height:1.55}header{display:flex;justify-content:space-between;border-bottom:2px solid #247447;padding-bottom:10px;margin-bottom:28px}header img{width:205px;max-height:70px;object-fit:contain}.brandtext{text-align:right;font-size:9pt;font-weight:bold;color:#17324f}.brandtext small{display:block;color:#247447;font-weight:normal;font-style:italic;margin-top:4px}.meta{font-size:9pt;color:#5b6570;margin-bottom:20px}.doc-title{text-align:center;color:#17324f;font-size:19pt;margin:28px 0 22px;text-transform:uppercase}.body p{margin:0 0 12px}.signature{margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:34px}.sigline{border-top:1px solid #7d8790;padding-top:8px;margin-top:36px;font-size:9pt}.prepared{margin-top:28px;font-size:9pt;color:#536575}.footer{position:fixed;bottom:0;left:0;right:0;border-top:1px solid #247447;padding-top:6px;color:#697986;font-size:8pt;display:flex;justify-content:space-between}</style></head><body><header><img src="/gdof-logo.svg" alt="GDOF logo"><div class="brandtext">GLOBAL DEVELOPMENT AND<br>OPPORTUNITY FOUNDATION<small>Empowering People. Transforming Communities.</small></div></header><div class="meta"><b>Reference:</b> '+esc(reference||"To be assigned")+' &nbsp; <b>Date:</b> '+esc(formattedDate)+'</div><h1 class="doc-title">'+esc(title)+'</h1>'+(includeRecipient&&recipient?'<p><b>To:</b> '+esc(recipient)+'</p>':'')+'<main class="body">'+paragraphs+'</main>'+(includePreparedBy?'<div class="prepared"><b>Prepared by:</b> '+esc(preparedBy)+'</div>':'')+(includeSignatureLines?'<div class="signature"><div class="sigline">Name / Title<br>Signature: __________________________<br>Date: __________________</div><div class="sigline">Name / Title<br>Signature: __________________________<br>Date: __________________</div></div>':'')+'<div class="footer"><span>GDOF | Global Development and Opportunity Foundation</span><span>Delaware Non-Stock Nonprofit Corporation</span></div></body></html>';
  };
  const api=async(path,options={})=>{const response=await fetch(path,{credentials:"same-origin",...options,headers:{...(options.headers||{})}});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"The document request failed.");return result;};
  const loadDocuments=async()=>{setLoadingDocuments(true);try{const result=await api("/api/admin/documents");setDocuments(result.documents||[]);}catch(err){setLocalNotice(err.message);}finally{setLoadingDocuments(false);}};
  useEffect(()=>{loadDocuments();},[]);
  const printDocument=()=>{if(!title.trim()||!body.trim()){setLocalNotice("Add a document title and content before printing.");return;}const win=window.open("","_blank");if(!win){setLocalNotice("Allow pop-ups for the admin site and try again.");return;}win.document.open();win.document.write(buildHtml().replace("</body>","<script>window.onload=()=>setTimeout(()=>window.print(),350);<\\/script></body>"));win.document.close();setLocalNotice("Choose your printer or Save as PDF.");};
  const saveDraft=async()=>{if(!title.trim()||!body.trim()){setLocalNotice("A title and document content are required.");return;}setSaving(true);try{const result=await api("/api/admin/documents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:activeDocument?.id,title,documentType:kind,reference,documentDate,recipient:includeRecipient?recipient:"",preparedBy:includePreparedBy?preparedBy:"",html:buildHtml(),changeNote})});setActiveDocument(result.document);setChangeNote("");await loadDocuments();setLocalNotice("Draft version saved in the GDOF register.");}catch(err){setLocalNotice(err.message);}finally{setSaving(false);}};
  const uploadPdf=async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;if(!activeDocument){setLocalNotice("Save the draft first.");return;}const form=new FormData();form.append("file",file);setSaving(true);try{const response=await fetch("/api/admin/documents/"+encodeURIComponent(activeDocument.id)+"/pdf",{method:"POST",credentials:"same-origin",body:form});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"PDF upload failed.");setActiveDocument(result.document);await loadDocuments();setLocalNotice("PDF attached to this document version.");}catch(err){setLocalNotice(err.message);}finally{setSaving(false);}};
  const updateStatus=async(doc,status)=>{setSaving(true);try{const result=await api("/api/admin/documents/"+encodeURIComponent(doc.id)+"/status",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});setActiveDocument(result.document);await loadDocuments();setLocalNotice("Document status updated.");}catch(err){setLocalNotice(err.message);}finally{setSaving(false);}};
  const downloadFile=(doc,type,v)=>window.open("/api/admin/documents/"+encodeURIComponent(doc.id)+"/files/"+type+"?version="+encodeURIComponent(v.id),"_blank");
  const editDocument=async doc=>{try{const v=doc.versions?.[0];const response=await fetch("/api/admin/documents/"+encodeURIComponent(doc.id)+"/files/html?version="+encodeURIComponent(v.id),{credentials:"same-origin"});if(!response.ok)throw new Error("Could not load saved version.");const html=await response.text(),parsed=new DOMParser().parseFromString(html,"text/html");setActiveDocument(doc);setTitle(doc.title);setKind(doc.documentType||"Custom Document");setReference(doc.reference||"");setDocumentDate(doc.documentDate||"");setRecipient(doc.recipient||"");setPreparedBy(doc.preparedBy||"");setBody(parsed.querySelector("main.body")?.innerText||"");setIncludeRecipient(Boolean(doc.recipient));setIncludePreparedBy(Boolean(doc.preparedBy));setLocalNotice("Loaded latest version. Saving creates a new version.");}catch(err){setLocalNotice(err.message);}};


  return <section className="admin-panel gdof-doc-centre">
    <p className="admin-intro">Create, version, review and retain official GDOF documents. Drafts and final PDFs are stored in Cloudflare R2 with a searchable register in the admin database.</p>
    <div className="gdof-doc-grid">
      <div className="gdof-doc-form">
        <label>Document template<select value={kind} onChange={e=>chooseTemplate(e.target.value)}>{Object.keys(templates).map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Document title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Enter document title"/></label>
        <div className="gdof-doc-row">
          <label>Reference number<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="e.g. GDOF/BR/2026/001"/></label>
          <label>Document date<input type="date" value={documentDate} onChange={e=>setDocumentDate(e.target.value)}/></label>
        </div>
        <label className="gdof-doc-check"><input type="checkbox" checked={includeRecipient} onChange={e=>setIncludeRecipient(e.target.checked)}/> Include recipient field</label>
        {includeRecipient&&<label>Recipient<input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="Person or organisation"/></label>}
        <label>Document content<textarea rows="18" value={body} onChange={e=>setBody(e.target.value)} placeholder="Write the document content here…"/></label>
        <label className="gdof-doc-check"><input type="checkbox" checked={includePreparedBy} onChange={e=>setIncludePreparedBy(e.target.checked)}/> Include prepared-by line</label>
        {includePreparedBy&&<label>Prepared by<input value={preparedBy} onChange={e=>setPreparedBy(e.target.value)}/></label>}
        <label className="gdof-doc-check"><input type="checkbox" checked={includeSignatureLines} onChange={e=>setIncludeSignatureLines(e.target.checked)}/> Include signature lines</label>
        <label>Version note<input value={changeNote} onChange={e=>setChangeNote(e.target.value)} placeholder="Describe this version"/></label><div className="gdof-doc-actions"><button type="button" onClick={saveDraft} disabled={saving}>{saving?"Saving…":"Save draft / new version"}</button><button type="button" onClick={printDocument}>Preview / Print ↗</button><button type="button" className="admin-secondary" onClick={()=>{chooseTemplate(kind);setActiveDocument(null);setReference("");setDocumentDate(new Date().toISOString().slice(0,10));setRecipient("");setIncludeRecipient(false);}}>New document</button></div><label>Attach exported final PDF<input type="file" accept="application/pdf,.pdf" onChange={uploadPdf} disabled={saving||!activeDocument}/></label><p className="admin-help">Print and save as PDF first, then attach the exported PDF above. Save the draft before uploading.</p>{activeDocument&&<p className="gdof-active-record"><b>{activeDocument.documentNumber}</b> · {activeDocument.status} · {activeDocument.versions?.length||0} version(s) {activeDocument.versions?.[0]?.pdfKey&&<button type="button" className="admin-secondary" onClick={()=>downloadFile(activeDocument,"pdf",activeDocument.versions[0])}>Download PDF</button>} {activeDocument.status==="DRAFT"&&activeDocument.versions?.[0]?.pdfKey&&<button type="button" onClick={()=>updateStatus(activeDocument,"PENDING_APPROVAL")}>Submit for approval</button>}</p>}
        {notice&&<p className="admin-help" role="status">{notice}</p>}
      </div>
      <aside className="gdof-doc-info">
        <h2>GDOF document standard</h2>
        <ul><li>Official GDOF logo and letterhead</li><li>Navy, green and gold brand palette</li><li>Consistent title and document metadata</li><li>Standard corporate footer</li><li>A4 print layout with signature fields</li></ul>
        <p><b>Printing:</b> Select “Preview / Print document”, then choose a printer or “Save as PDF” in your browser’s print dialog.</p>
        <p><b>Secure storage:</b> Draft versions and final PDF attachments are stored in GDOF R2. Register metadata is stored in D1.</p><p><b>Approval:</b> Attach the final PDF before submitting it. Approved records are locked.</p>
        <p className="gdof-doc-warning">Only use signature images or execute a document after the relevant signatories have approved that specific document. This template provides blank signature fields by default.</p>
      </aside>
    </div>
  </section>;
}
