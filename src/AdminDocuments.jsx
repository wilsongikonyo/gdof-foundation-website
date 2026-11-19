import { useMemo, useState } from "react";
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
  const formattedDate=useMemo(()=>documentDate?new Date(documentDate+"T00:00:00").toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"}):"",[documentDate]);

  const chooseTemplate=value=>{
    setKind(value); setTitle(value==="Custom Document"?"":value);
    setBody(templates[value]||"");
    setLocalNotice("");
  };
  const esc=value=>String(value||"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  const printDocument=()=>{
    if(!title.trim()||!body.trim()){setLocalNotice("Add a document title and content before printing.");return;}
    const paragraphs=body.split(/\n\s*\n/).map(part=>'<p>'+esc(part).replace(/\n/g,"<br>")+'</p>').join("");
    const html='<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>'+
      '@page{size:A4;margin:25mm 20mm 22mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#23384b;font-size:11pt;line-height:1.55;margin:0}header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #247447;padding-bottom:10px;margin-bottom:28px}header img{width:205px;max-height:70px;object-fit:contain;object-position:left center}.brandtext{text-align:right;font-size:9pt;font-weight:bold;color:#17324f}.brandtext small{display:block;color:#247447;font-weight:normal;font-style:italic;margin-top:4px}.meta{font-size:9pt;color:#5b6570;margin:0 0 20px}.meta span{display:inline-block;margin-right:22px}.doc-title{text-align:center;color:#17324f;font-size:19pt;line-height:1.25;margin:28px 0 22px;text-transform:uppercase}.recipient{margin:16px 0}.body p{white-space:normal;margin:0 0 12px;min-height:1em}.signature{margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:34px}.sigline{border-top:1px solid #7d8790;padding-top:8px;margin-top:36px;font-size:9pt}.prepared{margin-top:28px;font-size:9pt;color:#536575}.footer{position:fixed;bottom:-14mm;left:0;right:0;border-top:1px solid #247447;padding-top:6px;color:#697986;font-size:8pt;display:flex;justify-content:space-between}.footer .right{color:#17324f}@media screen{body{max-width:210mm;margin:20px auto;padding:18mm 20mm;box-shadow:0 2px 22px #0002}}'+
      '</style></head><body><header><img src="/gdof-logo.svg" alt="GDOF logo"><div class="brandtext">GLOBAL DEVELOPMENT AND<br>OPPORTUNITY FOUNDATION<small>Empowering People. Transforming Communities.</small></div></header>'+
      '<div class="meta">'+(reference?'<span><b>Reference:</b> '+esc(reference)+'</span>':'')+(formattedDate?'<span><b>Date:</b> '+esc(formattedDate)+'</span>':'')+'</div>'+
      '<h1 class="doc-title">'+esc(title)+'</h1>'+
      (includeRecipient&&recipient?'<div class="recipient"><b>To:</b> '+esc(recipient)+'</div>':'')+
      '<main class="body">'+paragraphs+'</main>'+
      (includePreparedBy?'<div class="prepared"><b>Prepared by:</b> '+esc(preparedBy)+'</div>':'')+
      (includeSignatureLines?'<div class="signature"><div class="sigline">Name / Title<br>Signature: __________________________<br>Date: __________________</div><div class="sigline">Name / Title<br>Signature: __________________________<br>Date: __________________</div></div>':'')+
      '<div class="footer"><span>GDOF | Global Development and Opportunity Foundation</span><span class="right">Delaware Non-Stock Nonprofit Corporation</span></div>'+
      '<script>window.onload=()=>{setTimeout(()=>window.print(),350)};<\/script></body></html>';
    const win=window.open("","_blank");
    if(!win){setLocalNotice("Your browser blocked the print window. Allow pop-ups for the admin site and try again.");return;}
    win.document.open();win.document.write(html);win.document.close();
    setLocalNotice("Print-ready document opened. Choose your printer or Save as PDF in the print dialog.");
    onNotice?.("GDOF document opened in the print-ready template.");
  };

  return <section className="admin-panel gdof-doc-centre">
    <p className="admin-intro">Create a print-ready GDOF document using the Foundation’s standard logo, letterhead, colours, typography and footer. Choose a document type, edit the content and print or save as PDF.</p>
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
        <div className="gdof-doc-actions"><button type="button" onClick={printDocument}>Preview / Print document ↗</button><button type="button" className="admin-secondary" onClick={()=>{chooseTemplate(kind);setReference("");setDocumentDate(new Date().toISOString().slice(0,10));setRecipient("");setIncludeRecipient(false);setLocalNotice("Template reset.");}}>Reset template</button></div>
        {notice&&<p className="admin-help" role="status">{notice}</p>}
      </div>
      <aside className="gdof-doc-info">
        <h2>GDOF document standard</h2>
        <ul><li>Official GDOF logo and letterhead</li><li>Navy, green and gold brand palette</li><li>Consistent title and document metadata</li><li>Standard corporate footer</li><li>A4 print layout with signature fields</li></ul>
        <p><b>Printing:</b> Select “Preview / Print document”, then choose a printer or “Save as PDF” in your browser’s print dialog.</p>
        <p><b>Recordkeeping:</b> This first version generates the document in your browser. It does not yet save drafts or final PDFs into the GDOF document register.</p>
        <p className="gdof-doc-warning">Only use signature images or execute a document after the relevant signatories have approved that specific document. This template provides blank signature fields by default.</p>
      </aside>
    </div>
  </section>;
}
