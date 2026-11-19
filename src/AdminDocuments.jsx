import { useEffect, useMemo, useState } from "react";
import "./documents.css";

const templates = {
  "Board Resolution": "RESOLUTION\n\nWHEREAS, [insert background and purpose];\n\nNOW, THEREFORE, BE IT RESOLVED THAT:\n1. [Insert resolution]\n2. [Insert delegated authority and any limits]\n\nFURTHER RESOLVED, that this resolution shall be entered into the official records of the Corporation.",
  "Board Meeting Minutes": "1. CALL TO ORDER\n[Record the chairperson and time]\n\n2. ATTENDANCE AND QUORUM\n[List directors present and absent; confirm quorum]\n\n3. APPROVAL OF PRIOR MINUTES\n[Record decision]\n\n4. AGENDA ITEMS AND DISCUSSION\n[Record material discussion and decisions]\n\n5. RESOLUTIONS AND ACTION ITEMS\n[Record exact resolutions, responsible persons and deadlines]\n\n6. ADJOURNMENT\n[Record closing time]",
  "Members' Meeting Minutes": "1. CALL TO ORDER\n[Record convenor and time]\n\n2. NOTICE AND QUORUM\n[Record notice and members present]\n\n3. MATTERS CONSIDERED\n[Record discussion]\n\n4. VOTES AND RESOLUTIONS\n[Record motions and results accurately]\n\n5. ADJOURNMENT\n[Record closing time]",
  "Official Letter": "Dear [Recipient],\n\n[Write the purpose of this letter and the relevant details.]\n\nPlease contact the Foundation if any further information is required.\n\nYours sincerely,",
  "Policy / Procedure": "1. PURPOSE\n[Explain why this policy exists]\n\n2. SCOPE\n[Who and what it applies to]\n\n3. POLICY STATEMENT\n[State the policy]\n\n4. ROLES AND RESPONSIBILITIES\n[Set out responsibilities]\n\n5. PROCEDURE\n[Describe the steps]\n\n6. RECORDS AND REVIEW\n[State recordkeeping and review arrangements]\n\n7. APPROVAL\n[Record approving authority and effective date]",
  "Programme / Activity Report": "1. EXECUTIVE SUMMARY\n[Summarise the activity]\n\n2. OBJECTIVES\n[List approved objectives]\n\n3. ACTIVITIES COMPLETED\n[Describe verified activities]\n\n4. RESULTS AND EVIDENCE\n[Report confirmed outputs and outcomes]\n\n5. FINANCIAL SUMMARY\n[Include approved figures and explain variances]\n\n6. CHALLENGES AND LESSONS\n[Describe issues and learning]\n\n7. NEXT STEPS\n[List actions and responsible persons]",
  "GDOF Corporate Bylaws": `GLOBAL DEVELOPMENT AND OPPORTUNITY FOUNDATION, INC.
BYLAWS
A Delaware Nonstock, Nonprofit Corporation
Delaware File No. 10829286 | Incorporated November 4, 2026
Empowering People. Transforming Communities.

BOARD-APPROVED GOVERNING DOCUMENT
Board approval date: November 19, 2026
These Bylaws are approved by the Board of Directors, subject to confirmation that all provisions are consistent with the filed Certificate of Incorporation and the Delaware General Corporation Law. The Secretary shall enter the signed adoption record in the corporate minute book.

ARTICLE I — NAME, STATUS AND OFFICES
1.01 Name. The name of the corporation is Global Development and Opportunity Foundation, Inc. (the “Corporation” or “Foundation”).
1.02 Legal status. The Corporation is a Delaware nonstock corporation with no capital stock. It shall operate exclusively for charitable and educational purposes within Section 501(c)(3) of the Internal Revenue Code (“Code”), subject to its Certificate of Incorporation and applicable law.
1.03 Offices. The Corporation shall maintain a registered office and registered agent in Delaware and may maintain offices or conduct programs elsewhere as authorized by the Board, subject to applicable registration, licensing, fundraising and other laws.
1.04 Governing authority. The Certificate of Incorporation controls over these Bylaws in the event of conflict. These Bylaws are subject to the Delaware General Corporation Law (“DGCL”) and other applicable law.

ARTICLE II — PURPOSES AND TAX-EXEMPTION RESTRICTIONS
2.01 Exempt purposes. The Corporation is organized and shall be operated exclusively for charitable and educational purposes within Section 501(c)(3) of the Code, including relief of poverty and distress; advancement of education; youth development and livelihoods; community improvement; emergency and humanitarian relief; and prevention of cruelty to animals and promotion of animal welfare.
2.02 Programs. Activities may include food security and family support; scholarships and bursaries; youth entrepreneurship; employment and livelihood initiatives; community development; emergency relief; and animal rescue and welfare assistance. The Corporation may operate directly or through grants and partnerships with appropriate due diligence, oversight and records.
2.03 No private inurement. No part of the Corporation’s net earnings shall inure to the benefit of any director, officer, member or private person, except reasonable compensation for actual services and payments furthering exempt purposes. The Corporation shall not be operated for private interests.
2.04 Political campaigns and lobbying. The Corporation shall not participate or intervene in any political campaign for or against a candidate for public office. No substantial part of its activities shall consist of attempting to influence legislation, except as permitted by law.
2.05 Limitation. The Corporation shall not carry on activities that are not permitted for an organization exempt under Section 501(c)(3).
2.06 Tax representations. The Corporation shall not represent that contributions are deductible under Section 170 of the Code unless and until it has obtained IRS recognition or has another valid legal basis to make that representation.

ARTICLE III — MEMBERS
3.01 Voting membership. The Corporation shall have voting members. The initial members recorded in the organizational records are Wilson Maira Gikonyo, Rachael Maina, Mourene Maina, Samson Kibe and Morris Kyalo. The Secretary shall maintain the membership register.
3.02 Admission. Additional members may be admitted by majority Board vote, subject to the Certificate and law. Admission shall be recorded in the register. Membership is not transferable.
3.03 Rights. Each member in good standing has one vote on matters submitted to members by law, the Certificate or these Bylaws, including election of directors and amendments where member approval is required. Members have no ownership interest in assets and no right to distributions.
3.04 Term and resignation. Membership continues until resignation, death, removal or dissolution. A member may resign by written notice to the Secretary. Resignation does not entitle the member to any distribution or return of contributions.
3.05 Removal. A member may be removed for serious misconduct or material harm to the Corporation by a two-thirds vote of disinterested directors after written notice and a reasonable opportunity to respond, subject to any mandatory requirements of the Certificate and DGCL.
3.06 Annual meetings. Members shall hold an annual meeting at a date fixed by the Board to elect directors and transact proper business. Meetings may be held in person or by remote communication as permitted by law.
3.07 Special meetings. Special meetings may be called by the President, the Board, or members holding at least ten percent of votes entitled to be cast, or any different threshold required by the Certificate or DGCL.
3.08 Notice. Notice shall state place, date, time and, for a special meeting, its purpose, and shall be delivered within the statutory period by a permitted method. Electronic notice may be used where lawful.
3.09 Quorum and voting. Unless the Certificate or DGCL requires otherwise, members holding a majority of votes entitled to be cast constitute a quorum. Each member has one vote. Unless a greater vote is required, a majority of votes cast at a meeting with a quorum approves the matter.
3.10 Proxies and remote participation. Members may vote by proxy and participate remotely to the extent permitted by the DGCL.
3.11 Action without meeting. Member action may be taken by written or electronic consent to the extent permitted by the DGCL. Consents shall be retained with corporate records.

ARTICLE IV — BOARD OF DIRECTORS
4.01 Authority. The Board manages or directs the management of the Corporation’s affairs, subject to law and the Certificate.
4.02 Number and initial composition. The Board shall consist of five (5) directors. The initial directors elected in the organizational records are Wilson Maira Gikonyo, Rachael Maina, Mourene Maina, Samson Kibe and Morris Kyalo.
4.03 Election and term. Directors are elected by voting members at the annual meeting. Each serves until the next annual meeting and until a successor is elected and qualified, unless earlier resigned or removed. Directors may be reelected.
4.04 Qualifications and independence. Directors must be natural persons committed to the Corporation’s mission. The Board should, where practicable, maintain a majority of directors independent of paid management and material financial relationships.
4.05 Resignation and removal. A director may resign by written notice. Directors may be removed by the members entitled to elect them, with or without cause, to the extent permitted by the DGCL and Certificate.
4.06 Vacancies. Vacancies shall be filled in the manner permitted by the DGCL and Certificate. Any director appointed to fill a vacancy serves as provided by those governing authorities.
4.07 Meetings. The Board shall meet at least quarterly. Special meetings may be called by the President or any two directors. Notice shall be given at least two days in advance unless waived or a lawful emergency procedure applies.
4.08 Quorum and vote. A majority of directors then in office constitutes a quorum; with five directors, three constitute a quorum. Unless a greater vote is required, a majority of directors present at a meeting with a quorum is the act of the Board.
4.09 Remote participation and written consent. Directors may participate by communications equipment through which all can hear one another. Board action without a meeting requires the consent prescribed by the DGCL.
4.10 Compensation. Directors receive no compensation solely for Board service but may receive reasonable documented expense reimbursement. Separate services may be compensated only after disclosure and approval by disinterested directors based on reasonable terms.
4.11 Committees. The Board may create committees by resolution and delegate only powers permitted by the DGCL. Committees shall report to the Board and keep records.

ARTICLE V — OFFICERS
5.01 Officers. Officers shall include a President/Board Chairperson, Treasurer and Secretary. The Board may appoint additional officers as needed.
5.02 Election and tenure. Officers are elected by the Board and serve at its pleasure until successors are appointed, subject to law and contractual rights.
5.03 President and Chairperson. The President chairs Board and member meetings, provides Board leadership and helps ensure implementation of Board resolutions. The President may not override Board decisions.
5.04 Treasurer. The Treasurer oversees financial reporting, budgeting, internal controls, books of account and timely financial and tax reporting, and reports to the Board.
5.05 Secretary. The Secretary ensures notices, minutes, written consents, membership and director registers, governing documents and official records are properly maintained.
5.06 Resignation and removal. An officer may resign by written notice and may be removed by the Board subject to applicable law and contractual rights. The Board fills vacancies.
5.07 Initial officers. The organizational records identify Rachael Maina as President and Board Chairperson, Mourene Maina as Treasurer, and Samson Kibe as Secretary. These appointments remain subject to any subsequent valid Board action.

ARTICLE VI — EXECUTIVE DIRECTOR AND MANAGEMENT
6.01 Appointment. The Board may appoint an Executive Director to manage daily operations under Board oversight. The organizational records identify Wilson Maira Gikonyo as the initial Executive Director.
6.02 Duties. The Executive Director implements Board-approved strategy, programs and budgets; supervises staff and volunteers; develops partnerships and fundraising proposals; maintains operational records; and reports to the Board.
6.03 Delegated authority. The Executive Director may sign contracts and incur expenses only within authority and limits delegated by the Board.
6.04 Accountability and conflicts. The Board retains ultimate oversight and may evaluate, compensate, suspend or remove the Executive Director. An Executive Director who is also a director shall not participate in deliberation or voting on their own compensation, performance review or personal conflict matter.

ARTICLE VII — CONFLICTS OF INTEREST AND ETHICS
7.01 Policy. The Corporation shall maintain a written Conflict of Interest Policy. Directors, officers, key employees and committee members shall promptly disclose actual, potential or perceived conflicts.
7.02 Interested transactions. A conflicted person shall disclose material facts and shall not vote on the matter. Disinterested directors shall determine whether the transaction is fair, reasonable and in the Corporation’s best interests.
7.03 Related parties. Transactions involving insiders or related persons/entities require advance review and approval by disinterested directors, documentation in minutes and evidence of fair terms where appropriate.
7.04 Annual disclosure. Covered persons shall complete an annual disclosure statement and update it when circumstances change.
7.05 Confidentiality and safeguarding. Covered persons shall protect confidential information, beneficiary dignity, personal data and charitable assets.

ARTICLE VIII — FINANCES, PROPERTY AND RECORDS
8.01 Fiscal year. The fiscal year shall be set by Board resolution; unless changed, it shall end December 31.
8.02 Budget. The Board approves an annual budget and reviews financial performance periodically.
8.03 Bank accounts. Funds shall be held in accounts titled in the Corporation’s legal name at institutions approved by the Board. Corporate funds shall be kept separate from personal funds and from funds of any separate business or entity.
8.04 Financial controls. The Board shall adopt written controls for receiving, depositing, disbursing and reconciling funds, designate authorized signatories and establish dual-approval thresholds. No person may approve a payment to themselves.
8.05 Restricted funds. Lawful donor restrictions and grant conditions shall be honored and tracked separately. The Corporation may decline gifts inconsistent with its mission or legal obligations.
8.06 Records. The Corporation shall maintain accurate accounting records, minutes, consents, registers, governing documents, contracts, grant files, donor restrictions and tax and regulatory records.
8.07 Inspection. Members and directors may inspect records as provided by law, subject to reasonable procedures protecting confidential, privileged or sensitive information.
8.08 Financial review. The Treasurer shall provide periodic reports. The Board may require an independent review or audit where appropriate or legally required.
8.09 Separation of entities. GDOF assets, donations, accounts, contracts and records shall remain separate from Wilmarteckh LLC and every other separate legal person or business.

ARTICLE IX — INDEMNIFICATION AND INSURANCE
9.01 Indemnification. The Corporation may indemnify directors, officers, employees and agents to the fullest extent permitted by the DGCL, subject to statutory procedures and limitations.
9.02 Insurance. The Corporation may purchase directors’ and officers’ liability and other insurance as the Board considers appropriate.
9.03 Non-exclusivity. These rights do not exclude other rights available under law, the Certificate, Board resolution or agreement.

ARTICLE X — NOTICES AND ELECTRONIC COMMUNICATIONS
10.01 Notices. Notices may be delivered personally, by mail, courier or electronic transmission as permitted by law.
10.02 Waiver. A person entitled to notice may waive it in writing or electronic transmission. Attendance waives notice except where the person attends solely to object to the legality of the meeting.
10.03 Electronic records. Electronic records, signatures, notices and remote meetings may be used to the extent permitted by law. Records shall be retained in reproducible form.

ARTICLE XI — AMENDMENTS
11.01 Authority. These Bylaws may be amended by the voting members as provided by the DGCL and Certificate. The Board may amend them only to the extent expressly authorized by the Certificate or applicable law, without impairing member rights.
11.02 Notice. Notice of a proposed amendment shall describe the change with reasonable detail.
11.03 Tax restrictions. No amendment may authorize private inurement, prohibited political campaign activity or operation for a non-exempt purpose.

ARTICLE XII — DISSOLUTION
12.01 Procedure. Dissolution shall occur only in accordance with the DGCL, Certificate and applicable law.
12.02 Distribution. After payment or provision for liabilities, remaining assets shall be distributed exclusively for one or more exempt purposes within Section 501(c)(3) of the Code, or to the federal government or a state or local government for a public purpose. No assets shall be distributed to members, directors, officers or private persons.
12.03 Recipient. The Board shall select eligible charitable recipients consistent with this Article and applicable law.

ARTICLE XIII — GENERAL
13.01 Severability. If any provision is invalid, the remainder remains effective to the fullest extent permitted by law.
13.02 Construction. Headings are for convenience only. References to the Code and DGCL include amendments and successor provisions.
13.03 Policies. The Board may adopt policies consistent with these Bylaws, including conflict of interest, financial controls, document retention, whistleblower, safeguarding, grants, procurement and data protection policies.
13.04 Effective date. These Bylaws take effect upon valid adoption by the body authorized under the Certificate and DGCL. The Secretary shall record the adoption date and preserve the signed copy.

BOARD ADOPTION RECORD
The Board of Directors has approved these Bylaws on November 19, 2026. The Secretary shall record the approval in the official minutes and retain the executed adoption certificate with the corporate records. This statement does not substitute for signatures or any member approval required by the Certificate or Delaware law.

ADOPTION CERTIFICATE
Adoption date: November 19, 2026
Board Chairperson: Rachael Maina
Signature: ____________________________________  Date: ______________
Secretary: Samson Kibe
Signature: ____________________________________  Date: ______________
Treasurer: Mourene Maina
Signature: ____________________________________  Date: ______________
Director: Wilson Maira Gikonyo
Signature: ____________________________________  Date: ______________
Director: Morris Kyalo
Signature: ____________________________________  Date: ______________

SECRETARY’S CERTIFICATION
I, Samson Kibe, Secretary of the Corporation, certify that this is a true copy of the Bylaws approved by the Board on the date stated above, subject to completion of the Corporation’s formal adoption record and any approvals required by the Certificate and applicable law.
Signature: ____________________________________  Date: ______________`,
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
  const [manualTitle,setManualTitle]=useState("");
  const [manualType,setManualType]=useState("Supporting Document");
  const [manualReference,setManualReference]=useState("");
  const [manualDate,setManualDate]=useState(new Date().toISOString().slice(0,10));
  const [manualFile,setManualFile]=useState(null);
  const [manualUploading,setManualUploading]=useState(false);
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
  const uploadManualDocument=async()=>{
    if(!manualTitle.trim()||!manualFile){setLocalNotice("Enter a document title and choose a PDF.");return;}
    if(manualFile.type!=="application/pdf"){setLocalNotice("Only PDF files are accepted.");return;}
    if(manualFile.size>15*1024*1024){setLocalNotice("PDF files must be 15 MB or smaller.");return;}
    setManualUploading(true);
    try{
      const safeTitle=esc(manualTitle.trim());
      const html='<!doctype html><html><head><meta charset="utf-8"><title>'+safeTitle+'</title></head><body><h1>'+safeTitle+'</h1><p>Manually uploaded official document. The original PDF is attached to this register record.</p></body></html>';
      const saved=await api("/api/admin/documents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:manualTitle.trim(),documentType:manualType,reference:manualReference,documentDate:manualDate,preparedBy:"Manually uploaded by authorized administrator",html,changeNote:"Original PDF manually uploaded"})});
      const form=new FormData();form.append("file",manualFile);
      const response=await fetch("/api/admin/documents/"+encodeURIComponent(saved.document.id)+"/pdf",{method:"POST",credentials:"same-origin",body:form});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"PDF upload failed.");
      setActiveDocument(result.document);setManualTitle("");setManualReference("");setManualFile(null);await loadDocuments();setLocalNotice("PDF uploaded and added to the Official Document Register as a draft.");
    }catch(err){setLocalNotice(err.message);}
    finally{setManualUploading(false);}
  };
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
    <section className="gdof-manual-upload">
      <div><h2>Manually upload an existing document</h2><p>Upload a PDF created outside the Document Centre, such as signed bylaws, board minutes, certificates, policies or official correspondence.</p></div>
      <div className="gdof-manual-grid">
        <label>Document title<input value={manualTitle} onChange={e=>setManualTitle(e.target.value)} placeholder="e.g. Signed GDOF Corporate Bylaws" maxLength="180"/></label>
        <label>Document category<select value={manualType} onChange={e=>setManualType(e.target.value)}>{["Supporting Document","Governing Document","Board Resolution","Board Meeting Minutes","Members' Meeting Minutes","Policy / Procedure","Official Letter","Certificate / Filing","Financial Record","Grant / Partnership Agreement","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Reference number (optional)<input value={manualReference} onChange={e=>setManualReference(e.target.value)} placeholder="e.g. GDOF/GOV/2026/001"/></label>
        <label>Document date<input type="date" value={manualDate} onChange={e=>setManualDate(e.target.value)}/></label>
        <label className="gdof-manual-file">Choose PDF file<input type="file" accept="application/pdf,.pdf" onChange={e=>setManualFile(e.target.files?.[0]||null)}/>{manualFile&&<small>{manualFile.name} · {(manualFile.size/1024/1024).toFixed(2)} MB</small>}</label>
      </div>
      <div className="gdof-doc-actions"><button type="button" onClick={uploadManualDocument} disabled={manualUploading}>{manualUploading?"Uploading…":"Upload to Document Register"}</button></div>
      <p className="admin-help">PDF only · Maximum 15 MB. The upload is saved as a draft and must be reviewed and approved through the normal register workflow.</p>
    </section>
    <section className="gdof-register"><div className="gdof-register-head"><div><h2>Official Document Register</h2><p>Saved drafts, version history, approvals and final PDFs.</p></div><button type="button" className="admin-secondary" onClick={loadDocuments} disabled={loadingDocuments}>{loadingDocuments?"Refreshing…":"Refresh register"}</button></div>{loadingDocuments?<p>Loading documents…</p>:documents.length===0?<p className="admin-muted">No documents have been saved yet.</p>:<div className="admin-table-wrap"><table><thead><tr><th>Document</th><th>Versions</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{documents.map(doc=><tr key={doc.id}><td><b>{doc.title}</b><small>{doc.documentNumber}</small></td><td>{doc.versions?.length||0}</td><td>{String(doc.status||"DRAFT").replace("_"," ")}</td><td>{doc.updatedAt?new Date(doc.updatedAt).toLocaleString():"—"}</td><td><div className="gdof-register-actions"><button type="button" className="admin-secondary" onClick={()=>editDocument(doc)}>Open</button>{doc.versions?.[0]?.pdfKey&&<button type="button" className="admin-secondary" onClick={()=>downloadFile(doc,"pdf",doc.versions[0])}>PDF</button>}{doc.status==="PENDING_APPROVAL"&&<button type="button" onClick={()=>updateStatus(doc,"APPROVED")} disabled={saving}>Approve</button>}{doc.status==="PENDING_APPROVAL"&&<button type="button" className="admin-secondary" onClick={()=>updateStatus(doc,"RETURNED")} disabled={saving}>Return</button>}</div>{doc.versions?.length>1&&<details><summary>Version history</summary>{doc.versions.map(v=><div className="gdof-version" key={v.id}>v{v.version} · {new Date(v.createdAt).toLocaleString()} · {v.createdBy} <button type="button" className="admin-secondary" onClick={()=>downloadFile(doc,"html",v)}>Source</button>{v.pdfKey&&<button type="button" className="admin-secondary" onClick={()=>downloadFile(doc,"pdf",v)}>PDF</button>}</div>)}</details>}</td></tr>)}</tbody></table></div>}</section>
  </section>;
}
