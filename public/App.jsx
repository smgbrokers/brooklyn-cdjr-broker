import{useState,useEffect,useMemo,useCallback,useRef}from"react";
const API="/api";
async function apiFetch(e,t={}){const n=localStorage.getItem("auth_token"),r=await fetch(`${API}/${e}`,{...t,headers:{"Content-Type":"application/json",...(n?{Authorization:`Bearer ${n}`}:{}),...(t.headers||{})},body:t.body?JSON.stringify(t.body):undefined}),o=await r.json();if(!r.ok)throw new Error(o.error||"Request failed");return o;}
const BROKER_STATUSES=["All","Request","Application","Approved","Declined","All Docs In","eDocs Sent","Ready to Pick Up","Completed"];
const ADMIN_STATUSES=["Request","Application","Approved","Declined","All Docs In","eDocs Sent","Ready to Pick Up","Completed","Dead"];
const SC={Request:{color:"#3B82F6",bg:"#EFF6FF"},Application:{color:"#F59E0B",bg:"#FFFBEB"},Approved:{color:"#DC2626",bg:"#FEE2E2"},Declined:{color:"#EF4444",bg:"#FEF2F2"},"All Docs In":{color:"#0D9488",bg:"#F0FDFA"},"eDocs Sent":{color:"#8B5CF6",bg:"#F5F3FF"},"Docs Sent":{color:"#8B5CF6",bg:"#F5F3FF"},"Ready to Pick Up":{color:"#F97316",bg:"#FFF7ED"},Completed:{color:"#059669",bg:"#D1FAE5"},Dead:{color:"#6B7280",bg:"#F9FAFB"}};
const sLabel=s=>s==="Approved"?"Approved, awaiting Docs":s;
function SBadge({status}){const c=SC[status]||{color:'#6B7280',bg:'#F9FAFB'};const red=status==='Approved';return <span style={{display:'inline-block',padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:700,color:red?'#fff':c.color,background:red?'#DC2626':c.bg,border:red?'1px solid #B91C1C':`1px solid ${c.color}30`}}>{sLabel(status)}</span>}
function Card({label,value,sub,accent}){return <div style={{background:"#fff",borderRadius:12,padding:"20px 24px",borderLeft:`4px solid ${accent}`,boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}><div style={{fontSize:32,fontWeight:800,color:accent}}>{value}</div><div style={{fontSize:14,fontWeight:600,color:"#1F2937",marginTop:2}}>{label}</div>{sub&&<div style={{fontSize:12,color:"#6B7280",marginTop:2}}>{sub}</div>}</div>}
function Modal({title,onClose,children,wide,extraWide}){return <div className="modal-ov" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16,overflowY:"auto"}}><div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:extraWide?1000:wide?860:620,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",display:"flex",flexDirection:"column",margin:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 28px",borderBottom:"1px solid #E5E7EB",position:"sticky",top:0,background:"#fff",zIndex:10}}><h2 style={{margin:0,fontSize:20,fontWeight:700,color:"#111827"}}>{title}</h2><button onClick={onClose} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",color:"#6B7280",lineHeight:1}}>✕</button></div><div style={{padding:28,flex:1,overflowY:"auto"}}>{children}</div></div></div>}
function Inp({label,value,onChange,type="text",required,placeholder,options,hint,half,error}){const base={width:"100%",padding:"10px 12px",borderRadius:8,fontSize:14,border:`1.5px solid ${error?"#EF4444":"#D1D5DB"}`,outline:"none",boxSizing:"border-box",fontFamily:"inherit",color:"#111827",background:"#fff"};return <div style={{marginBottom:14,flex:half?"0 0 calc(50% - 8px)":"1 1 100%"}}>{label&&<label style={{display:"block",marginBottom:4,fontSize:13,fontWeight:600,color:"#374151"}}>{label}{required&&<span style={{color:"#EF4444"}}> *</span>}</label>}{options?<select value={value} onChange={e=>onChange(e.target.value)} style={base}><option value="">— Select —</option>{options.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}</select>:type==="textarea"?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={3} style={{...base,resize:"vertical"}}/>:type==='number'?<input type='number' inputMode='numeric' min={0} max={/month/i.test(label||'')?11:99} step={1} value={value} onKeyDown={e=>{if(['-','+','e','E','.',','].includes(e.key))e.preventDefault();}} onChange={e=>{let v=String(e.target.value).replace(/[^0-9]/g,'');if(v!==''){const mx=/month/i.test(label||'')?11:99;if(Number(v)>mx)v=String(mx);}onChange(v);}} placeholder={placeholder} style={base} autoComplete='new-password'/>:<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={base} autoComplete='new-password'/>}{error&&<div style={{fontSize:11,color:"#EF4444",marginTop:3}}>⚠ {error}</div>}{hint&&!error&&<div style={{fontSize:11,color:"#9CA3AF",marginTop:3}}>{hint}</div>}</div>}
function Btn({children,onClick,variant="primary",size="md",disabled,loading,style:sx}){const base={border:"none",borderRadius:8,cursor:disabled||loading?"not-allowed":"pointer",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s",opacity:disabled||loading?0.6:1};const v={primary:{background:"#1D4ED8",color:"#fff",padding:size==="sm"?"6px 14px":"11px 22px",fontSize:size==="sm"?13:14},success:{background:"#10B981",color:"#fff",padding:size==="sm"?"6px 14px":"11px 22px",fontSize:size==="sm"?13:14},danger:{background:"#EF4444",color:"#fff",padding:size==="sm"?"6px 14px":"11px 22px",fontSize:size==="sm"?13:14},outline:{background:"#fff",color:"#374151",border:"1.5px solid #D1D5DB",padding:size==="sm"?"5px 13px":"10px 21px",fontSize:size==="sm"?13:14},ghost:{background:"transparent",color:"#6B7280",padding:size==="sm"?"6px 14px":"11px 22px",fontSize:size==="sm"?13:14}};return <button onClick={onClick} disabled={disabled||loading} style={{...base,...v[variant],...sx}}>{loading?"…":children}</button>}
function Toast({msg,type}){return <div style={{position:"fixed",bottom:24,right:24,background:type==="error"?"#EF4444":"#10B981",color:"#fff",padding:"14px 20px",borderRadius:10,fontWeight:600,fontSize:14,boxShadow:"0 8px 24px rgba(0,0,0,0.2)",zIndex:3000}}>{type==="error"?"✕ ":"✓ "}{msg}</div>}

function AddressInput({value,onChange,onSelect}){const[suggs,setSuggs]=useState([]),[show,setShow]=useState(false);const debounce=useRef(null);function handleChange(v){onChange(v);clearTimeout(debounce.current);if(v.length<4){setSuggs([]);return;}debounce.current=setTimeout(async()=>{try{const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(v)}&countrycodes=us`);const d=await r.json();setSuggs(d);setShow(true);}catch{}},400);}function pick(item){const a=item.address;onSelect({address:(a.house_number?(a.house_number+" "):"")+((a.road||a.pedestrian||"")),city:a.city||a.town||a.village||a.county||"",state:a.state||"",zip:a.postcode||""});setSuggs([]);setShow(false);}return <div style={{position:"relative",flex:"1 1 100%",marginBottom:14}}><label style={{display:"block",marginBottom:4,fontSize:13,fontWeight:600,color:"#374151"}}>Street Address</label><input value={value} onChange={e=>handleChange(e.target.value)} onBlur={()=>setTimeout(()=>setShow(false),200)} placeholder="Start typing address…" autoComplete="new-password" style={{width:"100%",padding:"10px 12px",borderRadius:8,fontSize:14,border:"1.5px solid #D1D5DB",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/><div style={{fontSize:11,color:"#9CA3AF",marginTop:3}}>Type to auto-complete</div>{show&&suggs.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1.5px solid #D1D5DB",borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:100,maxHeight:200,overflowY:"auto"}}>{suggs.map((s,i)=><div key={i} onMouseDown={()=>pick(s)} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,borderBottom:"1px solid #F3F4F6"}} onMouseEnter={e=>e.target.style.background="#F8FAFC"} onMouseLeave={e=>e.target.style.background=""}>📍 {s.display_name}</div>)}</div>}</div>}

function validateSSN(v){return /^\d{3}-?\d{2}-?\d{4}$/.test(v.replace(/\s/g,""));}
function validateDOB(v){if(!v)return false;const d=new Date(v);const age=(new Date()-d)/(1000*60*60*24*365.25);return!isNaN(d)&&age>=18&&age<=100;}
function validateEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}
function validatePhone(v){return v===''||/^[\d\s\-\(\)\+\.]{7,15}$/.test(v);}

function CreditAppForm({onSubmit,onCancel,loading}){
  const[appType,setAppType]=useState("individual");
  const emptyApplicant=()=>({first_name:"",last_name:"",cell_phone:"",work_phone:"",email:"",dob:"",ssn:"",address:"",city:"",state:"",zip:"",housing_status:"",housing_years:"",housing_months:"",housing_monthly_pmt:"",prev_address:"",prev_city:"",prev_state:"",prev_zip:"",prev_years:"",prev_months:"",employer:"",job_title:"",years_on_job:"",months_on_job:"",monthly_income:"",employment_type:""});
  const emptyBiz=()=>({business_name:"",business_type:"",ein:"",business_phone:"",business_address:"",business_city:"",business_state:"",business_zip:"",years_in_business:"",annual_revenue:""});
  const[primary,setPrimary]=useState(emptyApplicant());
  const[cosigner,setCosigner]=useState(emptyApplicant());
  const[biz,setBiz]=useState(emptyBiz());
  const[notes,setNotes]=useState("");
  const[idFile,setIdFile]=useState(null),[idErr,setIdErr]=useState("");
  const[wsFile,setWsFile]=useState(null),[wsErr,setWsErr]=useState('');
  async function handleWsPick(e){const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;setWsErr('');try{setWsFile(await readUploadFile(f));}catch(ex){setWsErr(ex.message);}}
  async function handleIdPick(e){
    const f=e.target.files&&e.target.files[0];e.target.value="";
    if(!f)return;setIdErr("");
    if(!["image/jpeg","image/png","application/pdf"].includes(f.type)){setIdErr("Please choose a JPG, PNG or PDF file.");return;}
    try{
      let blob=f,type=f.type;
      if(f.type!=="application/pdf"){
        const bmp=await createImageBitmap(f);
        const scale=Math.min(1,1800/Math.max(bmp.width,bmp.height));
        const cv=document.createElement("canvas");cv.width=Math.round(bmp.width*scale);cv.height=Math.round(bmp.height*scale);
        cv.getContext("2d").drawImage(bmp,0,0,cv.width,cv.height);
        type="image/jpeg";
        blob=await new Promise(r=>cv.toBlob(r,"image/jpeg",0.85));
      }
      if(blob.size>3000000){setIdErr(f.type==="application/pdf"?"That PDF is over 3 MB. Please upload a photo (JPG/PNG) or a smaller PDF.":"That image is too large. Please try a smaller photo.");return;}
      const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=rej;r.readAsDataURL(blob);});
      setIdFile({name:f.name,type,size:blob.size,data});
    }catch(ex){setIdErr("Could not read that file. Please try another.");}
  }
  const[errors,setErrors]=useState({});
  const[submitted,setSubmitted]=useState(false);
  const isBiz=appType==="business"||appType==="business_cosigner";
  const hasCosigner=appType==="individual_cosigner"||appType==="business_cosigner";
  const EP=(f,v)=>setPrimary(p=>({...p,[f]:v}));
  const EC=(f,v)=>setCosigner(p=>({...p,[f]:v}));
  const EB=(f,v)=>setBiz(p=>({...p,[f]:v}));
  const showPrevAddress=(a)=>{const y=parseInt(a.housing_years)||0;const m=parseInt(a.housing_months)||0;return(y*12+m)<24;};
  function validateApplicant(a,prefix){const e={};if(!a.first_name)e[prefix+"first_name"]="Required";if(!a.last_name)e[prefix+"last_name"]="Required";if(!a.ssn)e[prefix+"ssn"]="Required";else if(!validateSSN(a.ssn))e[prefix+"ssn"]="Must be 9 digits (XXX-XX-XXXX)";if(!a.dob)e[prefix+"dob"]="Required";else if(!validateDOB(a.dob))e[prefix+"dob"]="Valid date required (must be 18-100)";if(a.cell_phone&&!validatePhone(a.cell_phone))e[prefix+"cell_phone"]="Invalid phone";if(a.work_phone&&!validatePhone(a.work_phone))e[prefix+"work_phone"]="Invalid phone";if(a.email&&!validateEmail(a.email))e[prefix+"email"]="Invalid email";return e;}
  function validate(){let e={...validateApplicant(primary,"p_")};if(hasCosigner){e={...e,...validateApplicant(cosigner,"c_")};}if(isBiz&&!biz.business_name)e.biz_business_name="Required";return e;}
  function handleSubmit(){setSubmitted(true);const e=validate();setErrors(e);if(Object.keys(e).length>0)return;onSubmit({app_type:appType,primary,cosigner:hasCosigner?cosigner:null,business:isBiz?biz:null,notes,id_file:idFile,worksheet:wsFile});}
  useEffect(()=>{if(submitted)setErrors(validate());},[primary,cosigner,biz,submitted]);
  const SHP=(k)=>submitted?errors["p_"+k]:undefined;
  const SHC=(k)=>submitted?errors["c_"+k]:undefined;
  const SHB=(k)=>submitted?errors["biz_"+k]:undefined;
  const row={display:"flex",gap:16,flexWrap:"wrap"};
  const typeButtons=[{k:"individual",l:"Individual"},{k:"individual_cosigner",l:"Individual + Co-Signer"},{k:"business",l:"Business"},{k:"business_cosigner",l:"Business + Co-Signer"}];
  function ApplicantSection({data,onChange,prefix,label,SHfn}){
    const showPrev=showPrevAddress(data);
    return <div style={{background:prefix==="co"?"#F8FAFC":"transparent",borderRadius:prefix==="co"?12:0,padding:prefix==="co"?"16px 16px 8px":0,border:prefix==="co"?"1.5px solid #E5E7EB":"none",marginBottom:16}}>
      {label&&<div style={{fontWeight:700,color:"#1D4ED8",fontSize:13,marginBottom:12,display:"flex",alignItems:"center",gap:8}}><span style={{background:"#DBEAFE",borderRadius:6,padding:"2px 10px"}}>{label}</span></div>}
      <h4 style={{margin:"0 0 12px",color:"#374151",fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:"2px solid #F3F4F6",paddingBottom:6}}>Personal Information</h4>
      <div style={row}>
        <Inp half label="First Name" value={data.first_name} onChange={v=>onChange("first_name",v)} required error={SHfn("first_name")}/>
        <Inp half label="Last Name" value={data.last_name} onChange={v=>onChange("last_name",v)} required error={SHfn("last_name")}/>
        <Inp half label="Date of Birth" value={data.dob} onChange={v=>onChange("dob",v)} type="date" required error={SHfn("dob")} hint="Must be 18+"/>
        <Inp half label="Social Security Number" value={data.ssn} onChange={v=>onChange("ssn",v)} required placeholder="XXX-XX-XXXX" error={SHfn("ssn")} hint="Full 9-digit SSN"/>
        <Inp half label="Cell Phone" value={data.cell_phone} onChange={v=>onChange("cell_phone",v)} placeholder="718-555-0000" error={SHfn("cell_phone")}/>
        <Inp half label="Work Phone" value={data.work_phone} onChange={v=>onChange("work_phone",v)} placeholder="718-555-0000" error={SHfn("work_phone")}/>
        <Inp label="Email Address" value={data.email} onChange={v=>onChange("email",v)} type="email" placeholder="customer@email.com" error={SHfn("email")}/>
      </div>
      <h4 style={{margin:"8px 0 12px",color:"#374151",fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:"2px solid #F3F4F6",paddingBottom:6}}>Housing</h4>
      <div style={row}>
        <AddressInput value={data.address} onChange={v=>onChange("address",v)} onSelect={s=>onChange("__addr",s)}/>
        <Inp half label="City" value={data.city} onChange={v=>onChange("city",v)}/>
        <Inp half label="State" value={data.state} onChange={v=>onChange("state",v)}/>
        <Inp half label="Zip" value={data.zip} onChange={v=>onChange("zip",v)}/>
        <Inp half label="Housing Status" value={data.housing_status} onChange={v=>onChange("housing_status",v)} options={["Rent","Mortgage","Own Outright","Lives with Relatives"]}/>
        <Inp half label="Monthly Payment" value={data.housing_monthly_pmt} onChange={v=>onChange("housing_monthly_pmt",String(v).replace(/-/g,""))} placeholder="$0,000"/>
        <Inp half label="Years at Address" value={data.housing_years} onChange={v=>onChange("housing_years",v)} type="number" placeholder="0"/>
        <Inp half label="Months at Address" value={data.housing_months} onChange={v=>onChange("housing_months",v)} type="number" placeholder="0"/>
      </div>
      {showPrev&&<>
        <h4 style={{margin:"8px 0 12px",color:"#92400E",fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:"2px solid #FDE68A",paddingBottom:6}}>⚠ Previous Address <span style={{fontWeight:400,fontSize:11,color:"#B45309"}}>(required — less than 2 years at current)</span></h4>
        <div style={row}>
          <Inp label="Previous Street Address" value={data.prev_address} onChange={v=>onChange("prev_address",v)} placeholder="123 Main St"/>
          <Inp half label="City" value={data.prev_city} onChange={v=>onChange("prev_city",v)}/>
          <Inp half label="State" value={data.prev_state} onChange={v=>onChange("prev_state",v)}/>
          <Inp half label="Zip" value={data.prev_zip} onChange={v=>onChange("prev_zip",v)}/>
          <Inp half label="Years There" value={data.prev_years} onChange={v=>onChange("prev_years",v)} type="number" placeholder="0"/>
          <Inp half label="Months There" value={data.prev_months} onChange={v=>onChange("prev_months",v)} type="number" placeholder="0"/>
        </div>
      </>}
      <h4 style={{margin:"8px 0 12px",color:"#374151",fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:"2px solid #F3F4F6",paddingBottom:6}}>Employment</h4>
      <div style={row}>
        <Inp half label="Employer" value={data.employer} onChange={v=>onChange("employer",v)}/>
        <Inp half label="Job Title" value={data.job_title} onChange={v=>onChange("job_title",v)} placeholder="e.g. Manager"/>
        <Inp half label="Years on Job" value={data.years_on_job} onChange={v=>onChange("years_on_job",v)} type="number" placeholder="0"/>
        <Inp half label="Months on Job" value={data.months_on_job} onChange={v=>onChange("months_on_job",v)} type="number" placeholder="0"/>
        <Inp half label="Monthly Income" value={data.monthly_income} onChange={v=>onChange("monthly_income",String(v).replace(/-/g,""))} placeholder="$0,000"/>
        <Inp half label="Employment Type" value={data.employment_type} onChange={v=>onChange("employment_type",v)} options={["Full-Time","Part-Time","Self-Employed","Retired","Other"]}/>
      </div>
    </div>;
  }
  function makeHandler(setter){return (f,v)=>{if(f==="__addr"){setter(p=>({...p,...v}));}else{setter(p=>({...p,[f]:v}));}};}
  const[parsing,setParsing]=useState(false);
  const[parseMsg,setParseMsg]=useState("");
  const parseRef=useRef(null);
  async function handleParseUpload(e){
    const file=e.target.files[0];if(!file)return;
    const allowed=['application/pdf','image/jpeg','image/png','image/gif','image/webp'];
    if(!allowed.includes(file.type)){setParseMsg("Please upload a PDF or image file.");return;}
    if(file.size>20*1024*1024){setParseMsg("File too large (max 20MB).");return;}
    setParsing(true);setParseMsg("Analyzing document with AI…");
    try{
      const reader=new FileReader();
      const b64=await new Promise((res,rej)=>{reader.onload=()=>res(reader.result.split(",")[1]);reader.onerror=rej;reader.readAsDataURL(file);});
      const result=await apiFetch("parse",{method:"POST",body:{fileData:b64,fileType:file.type}});
      const p=result.parsed;
      if(p.app_type)setAppType(p.app_type);
      if(p.primary)setPrimary(prev=>({...prev,...Object.fromEntries(Object.entries(p.primary).filter(([,v])=>v!==""))}));
      if(p.cosigner)setCosigner(prev=>({...prev,...Object.fromEntries(Object.entries(p.cosigner).filter(([,v])=>v!==""))}));
      if(p.business)setBiz(prev=>({...prev,...Object.fromEntries(Object.entries(p.business).filter(([,v])=>v!==""))}));
      if(p.notes)setNotes(p.notes);
      setParseMsg("✓ Fields extracted! Please review and correct any errors before submitting.");
    }catch(ex){setParseMsg("Could not extract data: "+ex.message);}
    finally{setParsing(false);if(parseRef.current)parseRef.current.value="";}
  }

  return <div>
    <div style={{background:"#F0F9FF",border:"2px dashed #38BDF8",borderRadius:12,padding:"14px 18px",marginBottom:20}}>
      <div style={{fontWeight:700,color:"#0369A1",fontSize:13,marginBottom:6}}>📎 Auto-Fill from Existing Credit App</div>
      <div style={{fontSize:12,color:"#0284C7",marginBottom:10}}>Upload a PDF or photo of an existing credit application and we'll pre-fill the form automatically.</div>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <input ref={parseRef} type="file" accept=".pdf,image/*" onChange={handleParseUpload} style={{display:"none"}} id="parse-upload"/>
        <label htmlFor="parse-upload" style={{padding:"8px 18px",background:parsing?"#94A3B8":"#0EA5E9",color:"#fff",borderRadius:8,fontWeight:700,fontSize:13,cursor:parsing?"not-allowed":"pointer",display:"inline-block"}}>
          {parsing?"⏳ Analyzing…":"⬆ Upload PDF or Image"}
        </label>
        {parseMsg&&<div style={{fontSize:12,color:parseMsg.startsWith("✓")?"#059669":"#B45309",fontWeight:600}}>{parseMsg}</div>}
      </div>
    </div>
    <div style={{marginBottom:20}}>
      <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>Application Type</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {typeButtons.map(({k,l})=><button key={k} onClick={()=>setAppType(k)} style={{padding:"8px 16px",borderRadius:8,border:"2px solid",borderColor:appType===k?"#1D4ED8":"#E5E7EB",background:appType===k?"#1D4ED8":"#fff",color:appType===k?"#fff":"#374151",fontWeight:600,fontSize:13,cursor:"pointer",transition:"all 0.15s"}}>{l}</button>)}
      </div>
    </div>
    {isBiz&&<>
      <h4 style={{margin:"0 0 12px",color:"#374151",fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:"2px solid #F3F4F6",paddingBottom:6}}>Business Information</h4>
      <div style={{...row,marginBottom:16}}>
        <Inp label="Business Name" value={biz.business_name} onChange={v=>EB("business_name",v)} required error={SHB("business_name")}/>
        <Inp half label="Business Type" value={biz.business_type} onChange={v=>EB("business_type",v)} options={["LLC","Corporation","Partnership","Sole Proprietor","Other"]}/>
        <Inp half label="EIN / Tax ID" value={biz.ein} onChange={v=>EB("ein",v)} placeholder="XX-XXXXXXX"/>
        <Inp half label="Business Phone" value={biz.business_phone} onChange={v=>EB("business_phone",v)} placeholder="718-555-0000"/>
        <Inp half label="Years in Business" value={biz.years_in_business} onChange={v=>EB("years_in_business",v)} type="number" placeholder="0"/>
        <Inp label="Business Address" value={biz.business_address} onChange={v=>EB("business_address",v)}/>
        <Inp half label="City" value={biz.business_city} onChange={v=>EB("business_city",v)}/>
        <Inp half label="State" value={biz.business_state} onChange={v=>EB("business_state",v)}/>
        <Inp half label="Zip" value={biz.business_zip} onChange={v=>EB("business_zip",v)}/>
        <Inp half label="Annual Revenue" value={biz.annual_revenue} onChange={v=>EB("annual_revenue",String(v).replace(/-/g,""))} placeholder="$000,000"/>
      </div>
    </>}
    <ApplicantSection data={primary} onChange={makeHandler(setPrimary)} prefix="pri" label={hasCosigner?(isBiz?"Authorized Signer / Primary":"Primary Applicant"):null} SHfn={SHP}/>
    {hasCosigner&&<ApplicantSection data={cosigner} onChange={makeHandler(setCosigner)} prefix="co" label="Co-Signer" SHfn={SHC}/>}
    <div style={{marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:"0.05em",borderBottom:"2px solid #F3F4F6",paddingBottom:6,margin:"8px 0 12px"}}>Customer ID</div>
      <div style={{background:"#F8FAFC",border:"1.5px dashed #94A3B8",borderRadius:12,padding:"14px 16px"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:6}}>Please upload customer's ID</div>
        <div style={{fontSize:12,color:"#6B7280",marginBottom:10}}>Driver's license or state ID. JPG, PNG or PDF. Photos are resized automatically; PDFs up to 3 MB.</div>
        <input id="id-upload" type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={handleIdPick} style={{display:"none"}}/>
        <label htmlFor="id-upload" style={{display:"inline-block",padding:"8px 18px",background:"#1D4ED8",color:"#fff",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer"}}>{idFile?"Replace file":"Choose file"}</label>
        {idFile&&<span style={{marginLeft:12,fontSize:13,color:"#065F46",fontWeight:600}}>✓ {idFile.name} ({Math.max(1,Math.round(idFile.size/1024))} KB)<button type="button" onClick={()=>setIdFile(null)} style={{marginLeft:8,background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:12,textDecoration:"underline"}}>Remove</button></span>}
        {idErr&&<div style={{marginTop:8,fontSize:12,color:"#DC2626"}}>{idErr}</div>}
      </div>
    </div>
    <div style={{marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'2px solid #F3F4F6',paddingBottom:6,margin:'8px 0 12px'}}>Worksheet</div>
      <div style={{background:'#F8FAFC',border:'1.5px dashed #94A3B8',borderRadius:12,padding:'14px 16px'}}>
        <div style={{fontSize:13,fontWeight:700,color:'#374151',marginBottom:6}}>Please upload the deal worksheet</div>
        <div style={{fontSize:12,color:'#6B7280',marginBottom:10}}>JPG, PNG or PDF. Photos are resized automatically; PDFs up to 3 MB. If you do not have it yet, you can add it later from the Docs tab of your deal.</div>
        <input id='ws-upload' type='file' accept='.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf' onChange={handleWsPick} style={{display:'none'}}/>
        <label htmlFor='ws-upload' style={{display:'inline-block',padding:'8px 18px',background:'#1D4ED8',color:'#fff',borderRadius:8,fontWeight:700,fontSize:13,cursor:'pointer'}}>{wsFile?'Replace file':'Choose file'}</label>
        {wsFile&&<span style={{marginLeft:12,fontSize:13,color:'#065F46',fontWeight:600}}>✓ {wsFile.name} ({Math.max(1,Math.round(wsFile.size/1024))} KB)<button type='button' onClick={()=>setWsFile(null)} style={{marginLeft:8,background:'none',border:'none',color:'#DC2626',cursor:'pointer',fontSize:12,textDecoration:'underline'}}>Remove</button></span>}
        {wsErr&&<div style={{marginTop:8,fontSize:12,color:'#DC2626'}}>{wsErr}</div>}
      </div>
    </div>
    
<Inp label="Notes" value={notes} onChange={setNotes} type="textarea" placeholder="Additional info…"/>
    {submitted&&Object.keys(errors).length>0&&<div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#DC2626"}}>⚠ Please fix the errors above.</div>}
    <div style={{display:"flex",gap:12,justifyContent:"flex-end",paddingTop:16,borderTop:"1px solid #F3F4F6"}}><Btn variant="outline" onClick={onCancel}>Cancel</Btn><Btn variant="success" onClick={handleSubmit} loading={loading}>Submit Application</Btn></div>
  </div>;
}


function CreditAppViewer({dealNumber,onClose}){
  const[app,setApp]=useState(null),[loading,setL]=useState(true),[error,setErr]=useState(null);
  useEffect(()=>{apiFetch(`deals?action=credit_app&deal_number=${dealNumber}`).then(d=>{setApp(d);setL(false);}).catch(e=>{setErr(e.message);setL(false);});},[dealNumber]);
  const field=(label,value)=><div style={{marginBottom:12}}><div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:2}}>{label}</div><div style={{fontWeight:600,color:"#111827",fontSize:14}}>{value||"—"}</div></div>;
  const section=(title,children)=><div style={{background:"#F8FAFC",borderRadius:12,padding:20,marginBottom:16}}><div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:16,paddingBottom:8,borderBottom:"1px solid #E5E7EB"}}>{title}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 24px"}}>{children}</div></div>;
  const token=localStorage.getItem("auth_token");
  return <Modal title={`Credit Application — Deal #${dealNumber}`} onClose={onClose} extraWide>
    {loading&&<div style={{textAlign:"center",padding:60,color:"#9CA3AF"}}>Loading…</div>}
    {error&&<div style={{color:"#EF4444",padding:20}}>{error}</div>}
    {app&&<>
      <div style={{marginBottom:20}}><a href={`/api/deals?action=credit_app_html&deal_number=${dealNumber}&_t=${token}`} target="_blank" rel="noreferrer"><Btn variant="primary">📄 View / Print as PDF</Btn></a>{app.id_file_path&&<a href={`/api/deals?action=id_file&deal_number=${dealNumber}&_t=${token}`} target="_blank" rel="noreferrer" style={{marginLeft:10}}><Btn variant="outline">📎 View Customer ID</Btn></a>}</div>
      {section("Personal",<>{field("First Name",app.first_name)}{field("Last Name",app.last_name)}{field("DOB",app.dob)}{field("SSN","XXX-XX-"+String(app.ssn||"").slice(-4))}{field("Cell",app.cell_phone)}{field("Work",app.work_phone)}<div style={{gridColumn:"1/-1"}}>{field("Email",app.email)}</div></>)}
      {section("Housing",<><div style={{gridColumn:"1/-1"}}>{field("Address",`${app.address}, ${app.city}, ${app.state} ${app.zip}`)}</div>{field("Status",app.housing_status)}{field("Monthly Pmt",app.housing_monthly_pmt)}{field("Time at Address",`${app.housing_years||0}y ${app.housing_months||0}m`)}</>)}
      {section("Employment",<>{field("Employer",app.employer)}{field("Title",app.job_title)}{field("Time on Job",`${app.years_on_job||0}y ${app.months_on_job||0}m`)}{field("Income",app.monthly_income)}{field("Type",app.employment_type)}</>)}
      {app.notes&&section("Notes",<div style={{gridColumn:"1/-1"}}>{field("",app.notes)}</div>)}
    </>}
  </Modal>;
}

// ---- declined deals: the note pop-up, the red card in the message box, and the Message broker button ----
// ---- the invoice for a car: attached by the office when the car is available, downloaded by the broker ----
const invoiceUrl=dn=>API+'/deals?action=invoice&deal_number='+encodeURIComponent(dn)+'&_t='+encodeURIComponent(localStorage.getItem('auth_token')||'');
function InvoiceChip({deal}){
  return <button type='button' onClick={e=>{if(e&&e.stopPropagation)e.stopPropagation();window.open(invoiceUrl(deal.deal_number),'_blank');}} title={'Download the invoice ('+deal.invoice_name+')'} style={{background:'#1D4ED8',color:'#fff',border:'none',borderRadius:10,padding:'3px 10px',fontSize:12,fontWeight:700,cursor:'pointer',letterSpacing:'0.03em'}}>📎 INVOICE</button>;
}
function InvoiceSlot({deal,onDealPatch}){
  const[busy,setBusy]=useState(false),[err,setErr]=useState(''),[rm,setRm]=useState(false);
  const fileRef=useRef(null);
  async function pick(e){const f=e.target&&e.target.files&&e.target.files[0];if(e.target)e.target.value='';if(!f)return;setBusy(true);setErr('');try{const p=await prepareInspection(f);const r=await apiFetch('deals?action=invoice',{method:'POST',body:{deal_number:deal.deal_number,name:p.name,data:p.data}});if(onDealPatch&&r&&r.invoice)onDealPatch(deal.deal_number,r.invoice);}catch(ex){setErr(ex.message);}finally{setBusy(false);}}
  async function remove(){setBusy(true);setErr('');try{await apiFetch('deals?action=invoice_remove',{method:'POST',body:{deal_number:deal.deal_number}});if(onDealPatch)onDealPatch(deal.deal_number,{invoice_name:null,invoice_path:null,invoice_size:null,invoice_mime:null,invoice_uploaded_at:null});setRm(false);}catch(ex){setErr(ex.message);setRm(false);}finally{setBusy(false);}}
  const label={fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6};
  return <div style={{marginTop:14,paddingTop:14,borderTop:'1px dashed #D1D5DB'}}>
    <div style={label}>Invoice</div>
    <input ref={fileRef} type='file' accept={'.'+inspExts.join(',.')} onChange={pick} style={{display:'none'}}/>
    {deal.invoice_name?<div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
      <span style={{fontSize:13,fontWeight:700,wordBreak:'break-word'}}>📎 <button type='button' onClick={()=>window.open(invoiceUrl(deal.deal_number),'_blank')} style={{background:'none',border:'none',padding:0,cursor:'pointer',color:'#1D4ED8',fontWeight:700,fontSize:13,textDecoration:'underline'}}>{deal.invoice_name}</button>{deal.invoice_size?<span style={{fontWeight:500,color:'#6B7280'}}> ({inspSize(deal.invoice_size)})</span>:null}</span>
      <Btn size='sm' variant='outline' onClick={()=>fileRef.current&&fileRef.current.click()} loading={busy}>Replace</Btn>
      {rm?<><Btn size='sm' variant='danger' onClick={remove}>Confirm remove</Btn><Btn size='sm' variant='outline' onClick={()=>setRm(false)}>Keep</Btn></>:<Btn size='sm' variant='outline' onClick={()=>setRm(true)} style={{color:'#DC2626',borderColor:'#FCA5A5'}}>Remove</Btn>}
    </div>:<Btn size='sm' variant='outline' onClick={()=>fileRef.current&&fileRef.current.click()} loading={busy}>+ Attach invoice</Btn>}
    <div style={{fontSize:11,color:'#6B7280',marginTop:6,lineHeight:1.5}}>{deal.vehicle_available?'The broker can download it from their portal.':'Attach it before you mark the vehicle available: it is emailed to the broker and shown in their portal.'}</div>
    {err&&<div style={{color:'#DC2626',fontSize:13,marginTop:6}}>{err}</div>}
  </div>;
}

function splitAvailable(body){let rest=String(body||'').slice('CAR AVAILABLE'.length).trim();if(rest.startsWith('-'))rest=rest.slice(1).trim();let invoice='';const ii=rest.indexOf('Invoice:');if(ii>=0){invoice=rest.slice(ii+8).trim();rest=rest.slice(0,ii).trim();}let note='';const ni=rest.indexOf('Note:');if(ni>=0){note=rest.slice(ni+5).trim();rest=rest.slice(0,ni).trim();}return{what:rest,note,invoice};}
function splitDecline(body){let rest=String(body||'').slice('DEAL DECLINED'.length).trim();if(rest.startsWith('-'))rest=rest.slice(1).trim();const i=rest.indexOf('Note:');return{what:(i>=0?rest.slice(0,i):rest).trim(),why:i>=0?rest.slice(i+5).trim():''};}
const canMsgDeal=d=>!!d&&d.status!=='Dead'&&(d.status==='Request'?!!d.vehicle_available:(!!d.assigned_to||d.status==='Declined'));
function MessageBrokerButton({deal,small}){
  const open=canMsgDeal(deal);
  return <button type='button' disabled={!open} title={open?'Open the message box for this deal':'Messaging opens once the credit application is in and a team member has claimed the deal'} onClick={e=>{if(e&&e.stopPropagation)e.stopPropagation();window.dispatchEvent(new CustomEvent('open-chat',{detail:{dealNumber:deal.deal_number}}));}} style={{background:open?'#1D4ED8':'#E5E7EB',color:open?'#fff':'#9CA3AF',border:'none',borderRadius:8,padding:small?'3px 9px':'6px 12px',fontSize:small?11:12,fontWeight:700,cursor:open?'pointer':'not-allowed',whiteSpace:'nowrap'}}>💬 Message broker</button>;
}
function DeclinePrompt({deal,onClose,onChoose}){
  const[note,setNote]=useState('');
  return <Modal title={'Decline deal #'+deal.deal_number+'?'} onClose={onClose}>
    <div style={{fontSize:14,color:'#374151',lineHeight:1.6,marginBottom:14}}>The broker gets a <b>DEAL DECLINED</b> message in their message box and an email. Add a note if you want them to know why.</div>
    <div style={{fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',marginBottom:4}}>Note for the broker (optional)</div>
    <textarea value={note} onChange={e=>setNote(e.target.value)} rows={4} maxLength={500} placeholder='For example: the lender could not approve this one. A co-signer or a larger down payment may help.' style={{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:14,fontFamily:'inherit',resize:'vertical'}}/>
    <div style={{textAlign:'right',fontSize:11,color:'#9CA3AF',margin:'4px 0 14px'}}>{note.length}/500</div>
    <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><Btn variant='ghost' onClick={onClose}>Cancel</Btn><Btn variant='danger' onClick={()=>onChoose(note.trim())}>Decline deal</Btn></div>
  </Modal>;
}

function splitRejection(body){const rest=String(body||'').replace(/^REJECTED DOCUMENT\s*-?\s*/,'');const i=rest.indexOf('Reason:');return{what:(i>=0?rest.slice(0,i):rest).trim(),why:i>=0?rest.slice(i+7).trim():''};}
function ChatWidget(){
  const isStaff=localStorage.getItem('auth_role')==='admin';
  const[open,setOpen]=useState(false),[convos,setConvos]=useState([]),[meInfo,setMeInfo]=useState(null),[listErr,setListErr]=useState(''),[active,setActive]=useState(null),[filter,setFilter]=useState(localStorage.getItem('chat_filter')||'me'),[staff,setStaff]=useState([]),[msgs,setMsgs]=useState([]),[text,setText]=useState(''),[sending,setSending]=useState(false),[tErr,setTErr]=useState('');
  const scrollRef=useRef(null),marked=useRef({});
  const loadList=useCallback(async()=>{try{const r=await apiFetch('messages?action=conversations');setConvos(r.conversations||[]);setMeInfo(r.me||null);setListErr('');}catch(e){setListErr(e.message);}},[]);
  const loadThread=useCallback(async(dn)=>{try{const m=await apiFetch('messages?deal_number='+encodeURIComponent(dn));setMsgs(m);setTErr('');const lastId=m.length?m[m.length-1].id:0;if(marked.current[dn]!==lastId){marked.current[dn]=lastId;apiFetch('messages?action=read',{method:'POST',body:{deal_number:dn}}).then(()=>loadList()).catch(()=>{});}}catch(e){setTErr(e.message);}},[loadList]);
  useEffect(()=>{loadList();const t=setInterval(loadList,45000);return()=>clearInterval(t);},[loadList]);
  useLive(['msgs','events'],()=>{loadList();});
  useEffect(()=>{if(isStaff)apiFetch('admins').then(r=>setStaff(Array.isArray(r)?r:[])).catch(()=>{});},[isStaff]);
  useEffect(()=>{const h=e=>{const dn=e.detail&&e.detail.dealNumber;setOpen(true);if(dn)setActive(dn);};window.addEventListener('open-chat',h);return()=>window.removeEventListener('open-chat',h);},[]);
  useEffect(()=>{if(!open||!active)return;setMsgs([]);setTErr('');loadThread(active);const t=setInterval(()=>loadThread(active),6000);return()=>clearInterval(t);},[open,active,loadThread]);
  useEffect(()=>{const el=scrollRef.current;if(el)el.scrollTop=el.scrollHeight;},[msgs.length,active,open]);
  function chooseFilter(v){setFilter(v);localStorage.setItem('chat_filter',v);}
  function back(){setActive(null);setMsgs([]);setTErr('');loadList();}
  async function send(){const t=text.trim();if(!t||!active)return;setSending(true);try{await apiFetch('messages',{method:'POST',body:{deal_number:active,body:t}});setText('');await loadThread(active);}catch(e){setTErr(e.message);}finally{setSending(false);}}
  const meId=meInfo?String(meInfo.id):'';
  const visible=convos.filter(c=>!isStaff||filter==='all'||(filter==='me'?String(c.assigned_to)===meId:String(c.assigned_to)===String(filter)));
  const unreadVisible=visible.reduce((n,c)=>n+(c.unread||0),0);
  const mineMsg=m=>!!meInfo&&m.sender_role===meInfo.role&&String(m.sender_id)===meId;
  const fmt=t=>new Date(t).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const cur=active?convos.find(c=>c.deal_number===active):null;
  return <>
    <style>{'@keyframes chatPulse{0%,100%{box-shadow:0 6px 20px rgba(29,78,216,.45),0 0 0 0 rgba(239,68,68,.6)}50%{box-shadow:0 6px 20px rgba(29,78,216,.45),0 0 0 10px rgba(239,68,68,0)}}'}</style>
    {open&&<div style={{position:'fixed',right:24,bottom:92,width:380,maxWidth:'calc(100vw - 32px)',height:'min(560px, calc(100vh - 120px))',background:'#fff',borderRadius:16,boxShadow:'0 20px 60px rgba(0,0,0,.35)',zIndex:1500,display:'flex',flexDirection:'column',overflow:'hidden',border:'1px solid #E5E7EB'}}>
      <div className='navy-keep' style={{background:'#0F172A',color:'#fff',padding:'12px 14px',display:'flex',alignItems:'center',gap:10}}>
        {active&&<button onClick={back} style={{background:'none',border:'none',color:'#93C5FD',cursor:'pointer',fontSize:18,padding:0}}>←</button>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{active?('#'+active+(cur?' · '+cur.customer_name:'')):'Messages'}</div>
          {active&&cur&&<div style={{fontSize:11,color:'#93C5FD'}}>{cur.vehicle_desc}{cur.assigned_to_name?' · Handled by '+cur.assigned_to_name:''}</div>}
        </div>
        <button onClick={()=>setOpen(false)} style={{background:'none',border:'none',color:'#94A3B8',cursor:'pointer',fontSize:16,padding:0}}>✕</button>
      </div>
      {!active&&<>
        {isStaff&&<div style={{padding:'10px 12px',borderBottom:'1px solid #F3F4F6',background:'#fff'}}><select value={filter} onChange={e=>chooseFilter(e.target.value)} style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:13,background:'#fff'}}><option value='all'>See all conversations</option><option value='me'>My deals</option>{staff.filter(a=>String(a.id)!==meId).map(a=><option key={a.id} value={String(a.id)}>{a.name}{a.role==='fleet_manager'?' (Fleet Manager)':''}</option>)}</select></div>}
        <div style={{flex:1,overflowY:'auto'}}>
          {listErr&&<div style={{padding:16,color:'#DC2626',fontSize:13}}>{listErr}</div>}
          {!listErr&&visible.length===0&&<div style={{padding:30,textAlign:'center',color:'#9CA3AF',fontSize:13}}>No conversations here yet. Messaging opens once a credit application is received and claimed by a team member.</div>}
          {visible.map(c=><div key={c.deal_number} onClick={()=>setActive(c.deal_number)} style={{padding:'12px 14px',borderBottom:'1px solid #F3F4F6',cursor:'pointer',display:'flex',gap:10,alignItems:'center'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:'#111827'}}>#{c.deal_number} · {c.customer_name}</div>
              <div style={{fontSize:11,color:'#6B7280'}}>{isStaff?((c.broker_name||'')+' · '+(c.assigned_to_name||'Unassigned')):(c.vehicle_desc||'')}</div>
              <div style={{fontSize:12,color:(c.last&&String(c.last.body).startsWith('CAR AVAILABLE'))?'#047857':(c.last&&(String(c.last.body).startsWith('REJECTED DOCUMENT')||String(c.last.body).startsWith('DEAL DECLINED')))?'#DC2626':'#374151',fontWeight:(c.last&&(String(c.last.body).startsWith('REJECTED DOCUMENT')||String(c.last.body).startsWith('DEAL DECLINED')||String(c.last.body).startsWith('CAR AVAILABLE')))?700:400,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginTop:2}}>{c.last?((c.last.sender_role==='system'?'':(c.last.sender_name||'')+': ')+c.last.body):'No messages yet'}</div>
            </div>
            <div style={{textAlign:'right'}}>{c.last&&<div style={{fontSize:10,color:'#9CA3AF'}}>{fmt(c.last.created_at)}</div>}{c.unread>0&&<span style={{display:'inline-block',marginTop:4,background:'#EF4444',color:'#fff',borderRadius:10,fontSize:11,fontWeight:800,padding:'1px 7px'}}>{c.unread}</span>}</div>
          </div>)}
        </div>
      </>}
      {active&&<>
        <div ref={scrollRef} style={{flex:1,overflowY:'auto',padding:14,background:'#F8FAFC'}}>
          {tErr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:8}}>{tErr}</div>}
          {!tErr&&msgs.length===0&&<div style={{color:'#9CA3AF',fontSize:13,textAlign:'center',marginTop:30}}>No messages yet. Say hello!</div>}
          {msgs.map(m=>m.sender_role==='system'?(String(m.body).startsWith('REJECTED DOCUMENT')?<div key={m.id} style={{background:'#FEE2E2',border:'3px solid #DC2626',borderRadius:14,padding:'14px 16px',margin:'14px 0',boxShadow:'0 4px 14px rgba(220,38,38,0.25)'}}><div style={{display:'inline-block',background:'#DC2626',color:'#fff',fontWeight:900,fontSize:15,letterSpacing:'0.06em',padding:'4px 12px',borderRadius:8,marginBottom:10}}>{'\u26a0\ufe0f '}REJECTED DOCUMENT</div><div style={{fontSize:17,fontWeight:800,color:'#7F1D1D',lineHeight:1.35}}>{splitRejection(m.body).what}</div>{splitRejection(m.body).why&&<div style={{fontSize:15,color:'#991B1B',marginTop:8,lineHeight:1.4}}><b style={{fontWeight:900}}>Reason:</b> {splitRejection(m.body).why}</div>}<div style={{fontSize:11,fontWeight:500,color:'#B91C1C',marginTop:8}}>{fmt(m.created_at)}</div>{!isStaff&&<button type='button' onClick={()=>{setOpen(false);window.dispatchEvent(new CustomEvent('open-deal',{detail:{deal_number:active,tab:'docs'}}));}} style={{display:'block',marginTop:12,padding:'9px 18px',borderRadius:8,border:'none',background:'#B91C1C',color:'#fff',fontWeight:800,fontSize:13,letterSpacing:'0.05em',cursor:'pointer'}}>OPEN DEAL</button>}</div>:(!isStaff&&String(m.body).startsWith('Documents requested:'))?<div key={m.id} style={{background:'#EFF6FF',border:'2px solid #3B82F6',borderRadius:14,padding:'12px 14px',margin:'14px 0'}}><div style={{display:'inline-block',background:'#1D4ED8',color:'#fff',fontWeight:800,fontSize:12,letterSpacing:'0.06em',padding:'3px 10px',borderRadius:8,marginBottom:8}}>DOCUMENTS REQUESTED</div><div style={{fontSize:14,fontWeight:700,color:'#1E3A8A',lineHeight:1.4}}>{String(m.body).slice('Documents requested:'.length).trim()}</div><div style={{fontSize:11,color:'#3B82F6',marginTop:6}}>{fmt(m.created_at)}</div>{!isStaff&&<button type='button' onClick={()=>{setOpen(false);window.dispatchEvent(new CustomEvent('open-deal',{detail:{deal_number:active,tab:'docs'}}));}} style={{display:'block',marginTop:12,padding:'9px 18px',borderRadius:8,border:'none',background:'#1D4ED8',color:'#fff',fontWeight:800,fontSize:13,letterSpacing:'0.05em',cursor:'pointer'}}>OPEN DEAL</button>}</div>:String(m.body).startsWith('CAR AVAILABLE')?<div key={m.id} style={{background:'#ECFDF5',border:'3px solid #047857',borderRadius:14,padding:'14px 16px',margin:'14px 0',boxShadow:'0 4px 14px rgba(4,120,87,0.25)'}}><div style={{display:'inline-block',background:'#047857',color:'#fff',fontWeight:900,fontSize:15,letterSpacing:'0.06em',padding:'4px 12px',borderRadius:8,marginBottom:10}}>{'🚗 '}CAR AVAILABLE!</div><div style={{fontSize:17,fontWeight:800,color:'#064E3B',lineHeight:1.35}}>{splitAvailable(m.body).what}</div>{splitAvailable(m.body).note&&<div style={{fontSize:14,color:'#065F46',marginTop:8,lineHeight:1.4}}>{splitAvailable(m.body).note}</div>}{splitAvailable(m.body).invoice&&<div style={{marginTop:10,background:'#fff',border:'1.5px solid #6EE7B7',borderRadius:10,padding:'10px 12px',fontSize:14,fontWeight:700,color:'#065F46'}}>{'📎 '}{splitAvailable(m.body).invoice}</div>}<div style={{fontSize:11,fontWeight:500,color:'#059669',marginTop:8}}>{fmt(m.created_at)}</div>{!isStaff&&<button type='button' onClick={()=>{setOpen(false);window.dispatchEvent(new CustomEvent('open-deal',{detail:{deal_number:active,tab:'overview'}}));}} style={{display:'block',marginTop:12,padding:'9px 18px',borderRadius:8,border:'none',background:'#047857',color:'#fff',fontWeight:800,fontSize:13,letterSpacing:'0.05em',cursor:'pointer'}}>OPEN DEAL</button>}</div>:String(m.body).startsWith('DEAL DECLINED')?<div key={m.id} style={{background:'#FEF2F2',border:'3px solid #991B1B',borderRadius:14,padding:'14px 16px',margin:'14px 0',boxShadow:'0 4px 14px rgba(153,27,27,0.25)'}}><div style={{display:'inline-block',background:'#991B1B',color:'#fff',fontWeight:900,fontSize:15,letterSpacing:'0.06em',padding:'4px 12px',borderRadius:8,marginBottom:10}}>{'⛔ '}DEAL DECLINED</div><div style={{fontSize:16,fontWeight:800,color:'#7F1D1D',lineHeight:1.35}}>{splitDecline(m.body).what}</div>{splitDecline(m.body).why&&<div style={{fontSize:15,color:'#991B1B',marginTop:8,lineHeight:1.4}}><b style={{fontWeight:900}}>Note from the team:</b> {splitDecline(m.body).why}</div>}<div style={{fontSize:11,fontWeight:500,color:'#B91C1C',marginTop:8}}>{fmt(m.created_at)}</div>{!isStaff&&<button type='button' onClick={()=>{setOpen(false);window.dispatchEvent(new CustomEvent('open-deal',{detail:{deal_number:active,tab:'overview'}}));}} style={{display:'block',marginTop:12,padding:'9px 18px',borderRadius:8,border:'none',background:'#7F1D1D',color:'#fff',fontWeight:800,fontSize:13,letterSpacing:'0.05em',cursor:'pointer'}}>OPEN DEAL</button>}</div>:<div key={m.id} style={{textAlign:'center',fontSize:11,color:'#9CA3AF',margin:'10px 0'}}>{m.body} · {fmt(m.created_at)}</div>):<div key={m.id} style={{display:'flex',justifyContent:mineMsg(m)?'flex-end':'flex-start',marginBottom:10}}><div style={{maxWidth:'80%'}}>{!mineMsg(m)&&<div style={{fontSize:11,color:'#6B7280',marginBottom:2}}>{m.sender_name}</div>}<div style={{background:mineMsg(m)?'#1D4ED8':'#fff',color:mineMsg(m)?'#fff':'#111827',border:mineMsg(m)?'none':'1px solid #E5E7EB',borderRadius:14,padding:'8px 12px',fontSize:14,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{m.body}</div><div style={{fontSize:10,color:'#9CA3AF',marginTop:2,textAlign:mineMsg(m)?'right':'left'}}>{fmt(m.created_at)}</div></div></div>)}
        </div>
        <div style={{padding:10,borderTop:'1px solid #E5E7EB',display:'flex',gap:8,alignItems:'flex-end',background:'#fff'}}>
          <textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} rows={2} maxLength={2000} placeholder='Type a message...' style={{flex:1,boxSizing:'border-box',padding:'8px 10px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:14,fontFamily:'inherit',resize:'none'}}/>
          <Btn size='sm' onClick={send} loading={sending} disabled={!text.trim()}>Send</Btn>
        </div>
      </>}
    </div>}
    <button onClick={()=>setOpen(o=>!o)} title='Messages' style={{position:'fixed',right:24,bottom:24,width:56,height:56,borderRadius:28,border:'none',background:'#1D4ED8',color:'#fff',fontSize:24,cursor:'pointer',zIndex:1500,boxShadow:'0 6px 20px rgba(29,78,216,.45)',animation:(unreadVisible>0&&!open)?'chatPulse 1.6s infinite':'none'}}>{open?'✕':'💬'}{unreadVisible>0&&<span style={{position:'absolute',top:-4,right:-4,background:'#EF4444',color:'#fff',borderRadius:10,fontSize:11,fontWeight:800,padding:'2px 7px'}}>{unreadVisible}</span>}</button>
  </>;
}
async function readUploadFile(f){
  if(!['image/jpeg','image/png','application/pdf'].includes(f.type))throw new Error('Please choose a JPG, PNG or PDF file.');
  let blob=f,type=f.type;
  if(f.type!=='application/pdf'){const bmp=await createImageBitmap(f);const scale=Math.min(1,1800/Math.max(bmp.width,bmp.height));const cv=document.createElement('canvas');cv.width=Math.round(bmp.width*scale);cv.height=Math.round(bmp.height*scale);cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);type='image/jpeg';blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',0.85));}
  if(blob.size>3000000)throw new Error(f.type==='application/pdf'?'That PDF is over 3 MB. Please upload a photo (JPG or PNG) or a smaller PDF.':'That image is too large. Please try a smaller photo.');
  const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(blob);});
  return{name:f.name,type,size:blob.size,data};
}
function DocsPanel({dealNumber,isStaff,onChange,onMarkAllIn,initial,initialSuggest}){
  const[data,setData]=useState(initial||null),[sugg,setSugg]=useState(!!initialSuggest),[derr,setDerr]=useState(''),[busy,setBusy]=useState(''),[pick,setPick]=useState({}),[msg,setMsg]=useState(''),[rej,setRej]=useState(null),[rejWhy,setRejWhy]=useState('');
  const token=localStorage.getItem('auth_token')||'';
  const load=useCallback(async()=>{try{const r=await apiFetch('docs?deal_number='+encodeURIComponent(dealNumber));setData(r);setDerr('');setPick(p=>{if(Object.keys(p).length)return p;const o={};r.types.forEach(t=>{o[t.key]=r.items.length===0?!!t.def:false;});return o;});}catch(e){setDerr(e.message);}},[dealNumber]);
  useEffect(()=>{load();},[load]);
  useLive(['events'],()=>{load();});
  const done=()=>{if(onChange)onChange();};
  async function act(tag,fn){setBusy(tag);setDerr('');try{await fn();await load();done();return true;}catch(e){setDerr(e.message);return false;}finally{setBusy('');}}
  const request=()=>act('req',async()=>{const items=Object.keys(pick).filter(k=>pick[k]);await apiFetch('docs?action=request',{method:'POST',body:{deal_number:dealNumber,items,message:msg}});setMsg('');setPick({});});
  const cancel=key=>act('c-'+key,async()=>{await apiFetch('docs?action=cancel',{method:'POST',body:{deal_number:dealNumber,doc_key:key}});});
  const upload=(key,file)=>act('u-'+key,async()=>{const f=await readUploadFile(file);await apiFetch('docs?action=upload',{method:'POST',body:{deal_number:dealNumber,doc_key:key,file:f}});});
  const removeFile=id=>act('d-'+id,async()=>{await apiFetch('docs?action=delete_file',{method:'POST',body:{file_id:id}});});
  const accept=key=>act('a-'+key,async()=>{const r=await apiFetch('docs?action=accept',{method:'POST',body:{deal_number:dealNumber,doc_key:key}});if(r&&r.suggest_all_docs_in&&onMarkAllIn)setSugg(true);});
  const markAllIn=async()=>{setBusy('allin');setDerr('');try{await Promise.resolve(onMarkAllIn());setSugg(false);await load();done();}catch(e){setDerr(e.message);}finally{setBusy('');}};
  async function doReject(){if(!rej)return;const okd=await act('r-'+rej.key,async()=>{await apiFetch('docs?action=reject',{method:'POST',body:{deal_number:dealNumber,doc_key:rej.key,reason:rejWhy.trim()}});});if(okd){setRej(null);setRejWhy('');}}
  const link=id=>'/api/docs?action=file&id='+id+'&_t='+encodeURIComponent(token);
  const reviewOf=i=>{const rs=i.review_status||'pending';if(rs==='rejected')return 'rejected';if(!i.files.length)return 'waiting';return rs==='accepted'?'accepted':'awaiting';};
  const chip={waiting:['Waiting','#DC2626'],awaiting:['\u23f3 Received - awaiting approval','#B45309'],accepted:['\u2713 Accepted','#059669'],rejected:['\u2717 Rejected','#DC2626']};
  const shortDate=t=>t?new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
  if(!data)return <div style={{background:'#FEF2F2',border:'1.5px solid #FCA5A5',borderRadius:12,padding:16,marginBottom:20,fontSize:13,color:derr?'#DC2626':'#9CA3AF'}}>{derr||'Loading documents...'}</div>;
  const items=data.items||[],kinds=items.map(reviewOf),n=k=>kinds.filter(x=>x===k).length;
  const notReq=(data.types||[]).filter(t=>!items.some(i=>i.doc_key===t.key));
  const canAdd=isStaff&&notReq.some(t=>pick[t.key]);
  const totalFiles=items.reduce((n2,i)=>n2+i.files.length,0)+(data.has_customer_id?1:0);
  const afterApproval=['Approved','All Docs In','eDocs Sent','Docs Sent','Ready to Pick Up','Completed'].includes(data.status);
  const pill=(bg,txt)=><span style={{fontSize:11,fontWeight:700,background:bg,color:'#fff',borderRadius:10,padding:'2px 10px'}}>{txt}</span>;
  return <div style={{background:'#FEF2F2',border:'1.5px solid #FCA5A5',borderRadius:12,padding:20,marginBottom:20}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,gap:8,flexWrap:'wrap'}}><div style={{fontSize:11,fontWeight:700,color:'#991B1B',textTransform:'uppercase'}}>{isStaff?'Documents from broker':'Documents needed'}</div><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{items.length>0&&pill(n('accepted')===items.length?'#059669':'#6B7280',n('accepted')+' of '+items.length+' accepted')}{n('awaiting')>0&&pill('#D97706',n('awaiting')+' awaiting approval')}{n('rejected')>0&&pill('#DC2626',n('rejected')+' rejected')}{n('waiting')>0&&pill('#9CA3AF',n('waiting')+' waiting')}</div></div>
    {derr&&!rej&&<div style={{color:'#DC2626',fontSize:13,marginBottom:8}}>{derr}</div>}
    {isStaff&&onMarkAllIn&&items.length>0&&n('accepted')===items.length&&data.status==='Approved'&&<div style={{background:'#ECFDF5',border:'1.5px solid #6EE7B7',borderRadius:10,padding:'12px 14px',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}><div style={{fontSize:13,color:'#065F46',fontWeight:600}}>Every requested document is accepted. Ready to mark this deal ALL DOCS IN?</div><Btn variant='success' onClick={markAllIn} loading={busy==='allin'}>Mark ALL DOCS IN</Btn></div>}
    {items.length===0&&!isStaff&&<div style={{fontSize:13,color:'#6B7280'}}>We will let you know which documents we need.</div>}
    {items.map((i,idx)=>{const s=kinds[idx],c=chip[s],allViewed=i.files.length>0&&i.files.every(f=>f.viewed_at);return <div key={i.id} style={{background:'#fff',border:'1px solid #FECACA',borderLeft:'4px solid '+c[1],borderRadius:10,padding:'10px 12px',marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}><div style={{fontSize:14,fontWeight:700,color:'#111827'}}>{i.label}{i.max_files>1&&<span style={{fontSize:11,fontWeight:500,color:'#6B7280'}}> (up to {i.max_files} files)</span>}</div><span style={{fontSize:11,fontWeight:700,color:c[1]}}>{c[0]}{i.max_files>1&&i.files.length>0&&s!=='rejected'?' ('+i.files.length+' of '+i.max_files+')':''}</span></div>
      {s==='rejected'&&<div style={{marginTop:6,background:'#FEE2E2',border:'1px solid #FCA5A5',borderRadius:8,padding:'8px 10px',fontSize:13,color:'#991B1B'}}><b>Rejected{i.reviewed_by_name?' by '+i.reviewed_by_name:''}:</b> {i.reject_reason||'No reason given'}{!isStaff&&<div style={{marginTop:4,fontWeight:700}}>Please upload a corrected file below.</div>}</div>}
      {s==='accepted'&&i.reviewed_by_name&&<div style={{fontSize:11,color:'#059669',marginTop:4}}>Accepted by {i.reviewed_by_name}{i.reviewed_at?' \u00b7 '+shortDate(i.reviewed_at):''}</div>}
      {i.files.map(f=><div key={f.id} style={{display:'flex',alignItems:'center',gap:10,marginTop:6,fontSize:13,flexWrap:'wrap'}}><a href={link(f.id)} target='_blank' rel='noreferrer' onClick={()=>{if(isStaff)setTimeout(load,1500);}} style={{color:'#1D4ED8',fontWeight:600,textDecoration:'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:240}}>{f.file_name||'file'}</a>{isStaff&&<span style={{fontSize:11,fontWeight:600,color:f.viewed_at?'#059669':'#B45309'}}>{f.viewed_at?'\ud83d\udc41 Viewed'+(f.viewed_by_name?' by '+f.viewed_by_name:''):'Not viewed yet'}</span>}{(isStaff||s==='awaiting')&&<button onClick={()=>removeFile(f.id)} disabled={busy==='d-'+f.id} style={{background:'none',border:'none',color:'#DC2626',cursor:'pointer',fontSize:12}}>Remove</button>}</div>)}
      {!isStaff&&(s==='waiting'||s==='rejected'||(s==='awaiting'&&i.files.length<i.max_files))&&<div style={{marginTop:8}}><label style={{display:'inline-block',padding:'6px 14px',background:busy==='u-'+i.doc_key?'#9CA3AF':'#DC2626',color:'#fff',borderRadius:8,fontWeight:700,fontSize:12,cursor:'pointer'}}>{busy==='u-'+i.doc_key?'Uploading...':(s==='rejected'?'Upload corrected file':(i.files.length?'Add another file':'Upload file'))}<input type='file' accept='.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf' disabled={!!busy} onChange={e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f)upload(i.doc_key,f);}} style={{display:'none'}}/></label></div>}
      {isStaff&&i.files.length>0&&<div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap',alignItems:'center'}}><Btn size='sm' variant='success' onClick={()=>accept(i.doc_key)} loading={busy==='a-'+i.doc_key} disabled={!allViewed||s==='accepted'}>Accept</Btn><Btn size='sm' variant='danger' onClick={()=>{setRej({key:i.doc_key,label:i.label});setRejWhy('');setDerr('');}} disabled={s==='rejected'}>Reject</Btn>{!allViewed&&s!=='accepted'&&s!=='rejected'&&<span style={{fontSize:11,color:'#B45309'}}>Open each file first, then you can accept it.</span>}</div>}
      {isStaff&&i.files.length===0&&s!=='rejected'&&<div style={{marginTop:6}}><button onClick={()=>cancel(i.doc_key)} disabled={busy==='c-'+i.doc_key} style={{background:'none',border:'none',color:'#6B7280',cursor:'pointer',fontSize:12,textDecoration:'underline',padding:0}}>Cancel this request</button></div>}
    </div>;})}
    {isStaff&&totalFiles>0&&<div style={{margin:'4px 0 12px'}}><a href={'/api/docs?action=zip&deal_number='+encodeURIComponent(dealNumber)+'&_t='+encodeURIComponent(token)} target='_blank' rel='noreferrer' style={{textDecoration:'none'}}><Btn size='sm' variant='outline'>⬇ Download all ({totalFiles} file{totalFiles>1?'s':''} as one ZIP)</Btn></a></div>}
    {isStaff&&notReq.length>0&&afterApproval&&<div style={{borderTop:items.length?'1px solid #FECACA':'none',paddingTop:items.length?12:0,marginTop:items.length?12:0}}>
      <div style={{fontSize:12,fontWeight:700,color:'#991B1B',marginBottom:8}}>{items.length?'Request more documents':'Request documents from the broker'}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 12px',marginBottom:10}}>{notReq.map(t=><label key={t.key} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}><input type='checkbox' checked={!!pick[t.key]} onChange={e=>setPick(p=>({...p,[t.key]:e.target.checked}))}/><span>{t.label}{t.max>1&&<span style={{fontSize:11,color:'#6B7280'}}> (up to {t.max} files)</span>}</span></label>)}</div>
      <textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={2} maxLength={500} placeholder='Message for the broker (optional)' style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:13,fontFamily:'inherit',resize:'vertical',marginBottom:8}}/>
      <Btn size='sm' onClick={request} loading={busy==='req'} disabled={!canAdd}>Request documents</Btn>
    </div>}
    {rej&&<Modal title='Reject document' onClose={()=>setRej(null)}>
      <div style={{fontSize:14,color:'#111827',marginBottom:10,lineHeight:1.5}}>Why is the <b>{rej.label}</b> being rejected? The broker will see your reason in their chat and by email.</div>
      <textarea value={rejWhy} onChange={e=>setRejWhy(e.target.value)} rows={4} maxLength={500} placeholder='For example: The photo is blurry. Please upload a clear copy of the front.' style={{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:14,fontFamily:'inherit',resize:'vertical'}}/>
      {derr&&<div style={{color:'#DC2626',fontSize:13,marginTop:8}}>{derr}</div>}
      <div style={{background:'#FEE2E2',border:'2px solid #DC2626',borderRadius:10,padding:'10px 12px',marginTop:12,fontSize:13,fontWeight:700,color:'#991B1B'}}><div style={{fontSize:10,fontWeight:700,color:'#B91C1C',marginBottom:4}}>THE BROKER WILL SEE</div>REJECTED DOCUMENT - Your {rej.label} was rejected. Reason: {rejWhy.trim()||'...'}</div>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}><Btn variant='outline' onClick={()=>setRej(null)}>Cancel</Btn><Btn variant='danger' onClick={doReject} loading={busy.startsWith('r-')} disabled={!rejWhy.trim()}>Reject document</Btn></div>
    </Modal>}
    {sugg&&<Modal title='All documents accepted' onClose={()=>setSugg(false)}>
      <div style={{fontSize:14,color:'#374151',lineHeight:1.5,marginBottom:16}}>Every document requested for deal <b>#{dealNumber}</b> has been accepted. Do you want to mark this deal as <b>ALL DOCS IN</b>?</div>
      {derr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{derr}</div>}
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><Btn variant='outline' onClick={()=>setSugg(false)}>Not yet</Btn><Btn variant='success' onClick={markAllIn} loading={busy==='allin'}>Yes, mark ALL DOCS IN</Btn></div>
    </Modal>}
  </div>;
}
function BrokerDealModal({dealNumber,startTab,deal,onClose,onRefresh}){
  const[tab,setTab]=useState(startTab||'overview'),[info,setInfo]=useState(null),[ierr,setIerr]=useState('');
  const token=localStorage.getItem('auth_token')||'';
  useEffect(()=>{let live=true;apiFetch('myapp?deal_number='+encodeURIComponent(dealNumber)).then(r=>{if(live)setInfo(r);}).catch(e=>{if(live)setIerr(e.message);});return()=>{live=false;};},[dealNumber]);
  useLive(['events'],()=>{apiFetch('myapp?deal_number='+encodeURIComponent(dealNumber)).then(r=>setInfo(r)).catch(()=>{});});
  const d=(info&&info.deal)||deal||{};
  const sum=deal&&deal.doc_summary,need=!!sum&&sum.requested>0&&sum.received<sum.requested;
  const tabs=[['overview','Overview'],['app','Credit App'],['docs','Docs'+(sum&&sum.requested>0?' ('+sum.received+'/'+sum.requested+')':'')]];
  const box={background:'#F8FAFC',borderRadius:12,padding:16};
  const lbl={fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',marginBottom:4};
  const canChat=d.status!=='Dead'&&(d.status==='Request'?!!d.vehicle_available:(!!(d.assigned_to_name||(deal&&deal.assigned_to))||d.status==='Declined'));
  const when=t=>t?new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
  return <Modal title={'Deal #'+dealNumber} onClose={onClose} wide>
    <div style={{display:'flex',gap:6,borderBottom:'2px solid #F3F4F6',marginBottom:16,flexWrap:'wrap'}}>{tabs.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:'9px 16px',border:'none',background:'none',cursor:'pointer',fontWeight:700,fontSize:14,color:tab===k?'#1D4ED8':'#6B7280',borderBottom:tab===k?'3px solid #1D4ED8':'3px solid transparent',marginBottom:-2}}>{l}{k==='docs'&&need&&<span style={{marginLeft:6,background:'#DC2626',color:'#fff',borderRadius:10,fontSize:10,padding:'1px 6px'}}>!</span>}</button>)}</div>
    {ierr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{ierr}</div>}
    {tab==='overview'&&<div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
        <div style={box}><div style={lbl}>Customer</div><div style={{fontSize:17,fontWeight:800,marginBottom:4}}>{d.customer_name}</div>{d.customer_phone&&<div style={{fontSize:13}}>📞 {d.customer_phone}</div>}{d.customer_email&&<div style={{fontSize:13}}>✉️ {d.customer_email}</div>}</div>
        <div style={box}><div style={lbl}>Vehicle</div><div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{d.vehicle_desc}</div><div style={{fontSize:13,color:'#6B7280'}}>Stock # {d.stock_num}{d.vin?' · VIN '+d.vin:''}</div></div>
      </div>
      <div style={{...box,marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}><SBadge status={d.status}/><span style={{fontSize:13,color:'#374151'}}>{d.assigned_to_name?'Handled by '+d.assigned_to_name:(d.status==='Request'?'Waiting on your credit application':'Waiting to be claimed by a team member')}</span></div>
        <div style={{display:'flex',gap:24,marginTop:12,flexWrap:'wrap'}}>{[['Requested',d.request_date],['Application',d.app_date],['Approved',d.approved_date]].filter(x=>x[1]).map(([l,v])=><div key={l}><div style={lbl}>{l}</div><div style={{fontSize:13,fontWeight:600}}>{v}</div></div>)}</div>
      </div>
      {deal&&deal.status==='Completed'&&deal.check_amount!==null&&deal.check_amount!==undefined&&<div style={{...box,marginBottom:14,borderLeft:'4px solid '+(deal.check_paid_at?'#10B981':'#F59E0B')}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:10}}><div style={lbl}>Payout</div><span style={{fontSize:11,fontWeight:700,borderRadius:10,padding:'2px 10px',background:deal.check_paid_at?'#D1FAE5':'#FEF3C7',color:deal.check_paid_at?'#065F46':'#92400E'}}>{deal.check_paid_at?'\u2713 Paid '+when(deal.check_paid_at)+(deal.check_ref?' \u00b7 Check '+deal.check_ref:''):'Outstanding'}</span></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>{[['Total bird dog',deal.bird_dog_total],['Short COD',deal.short_cod],['Check amount',deal.check_amount]].map(([l,v])=><div key={l}><div style={lbl}>{l}</div><div style={{fontSize:16,fontWeight:800}}>{fmtMoney(v)}</div></div>)}</div></div>}{d.invoice_name&&<div style={{background:'#EFF6FF',border:'1.5px solid #BFDBFE',borderRadius:12,padding:'14px 16px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><div style={lbl}>Invoice</div><div style={{fontSize:14,fontWeight:700,wordBreak:'break-word'}}>📎 {d.invoice_name}{d.invoice_size?<span style={{fontWeight:500,color:'#6B7280'}}> ({inspSize(d.invoice_size)})</span>:null}</div></div><Btn size='sm' onClick={()=>window.open(invoiceUrl(dealNumber),'_blank')}>Download invoice</Btn></div>}<div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{canChat&&<Btn onClick={()=>window.dispatchEvent(new CustomEvent('open-chat',{detail:{dealNumber}}))}>💬 Message the team</Btn>}<Btn variant='outline' onClick={()=>setTab('app')}>View credit app</Btn><Btn variant='outline' onClick={()=>setTab('docs')}>Docs{need?' (needed)':''}</Btn></div>
    </div>}
    {tab==='app'&&<div>
      {!info&&!ierr&&<div style={{color:'#9CA3AF',fontSize:13}}>Loading...</div>}
      {info&&!info.has_app&&<div style={box}>No credit application has been submitted for this deal yet.</div>}
      {info&&info.has_app&&<>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10,marginBottom:6}}>
          <div style={{fontSize:13,color:'#6B7280'}}>{info.app_type_label} application{info.submitted_at?' · submitted '+when(info.submitted_at):''}</div>
          <a href={'/api/myapp?action=pdf&deal_number='+encodeURIComponent(dealNumber)+'&_t='+encodeURIComponent(token)} download style={{textDecoration:'none'}}><Btn variant='primary'>⬇ Download PDF</Btn></a>
        </div>
        <div style={{fontSize:11,color:'#9CA3AF',marginBottom:12}}>Social Security numbers show the last 4 digits only.</div>
        {info.sections.map(sec=><div key={sec.title} style={{...box,marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10,paddingBottom:6,borderBottom:'1px solid #E5E7EB'}}>{sec.title}</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 24px'}}>{sec.fields.map(([l,v,full],i)=><div key={l+i} style={{gridColumn:full?'1 / -1':'auto',marginBottom:8}}><div style={lbl}>{l}</div><div style={{fontWeight:600,fontSize:14,color:'#111827',whiteSpace:'pre-wrap'}}>{v}</div></div>)}</div></div>)}
      </>}
    </div>}
    {tab==='docs'&&<DocsPanel dealNumber={dealNumber} isStaff={false} onChange={onRefresh}/>}
  </Modal>;
}
function TeamPanel({broker,onChanged,brokerId}){
  const blank={name:'',username:'',email:'',phone:'',password:'',role:'sales'};
  const[data,setData]=useState(null),[terr,setTerr]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(''),[adding,setAdding]=useState(false),[form,setForm]=useState(blank),[ferr,setFerr]=useState(''),[reset,setReset]=useState(null),[newPw,setNewPw]=useState(''),[rm,setRm]=useState(null);
  const load=useCallback(async()=>{try{setData(await apiFetch('brokers?action=team'+(brokerId?'&broker_id='+brokerId:'')));setTerr('');}catch(e){setTerr(e.message);}},[brokerId]);
  useEffect(()=>{load();},[load]);
  useLive(['team'],()=>{load();});
  async function run(tag,action,payload){setBusy(tag);setFerr('');setNote('');try{await apiFetch('brokers?action='+action,{method:'POST',body:brokerId?{...payload,broker_id:brokerId}:payload});await load();if(onChanged)onChanged();return true;}catch(e){setFerr(e.message);return false;}finally{setBusy('');}}
  async function addUser(){const okd=await run('add','team_add',form);if(okd){setAdding(false);setForm(blank);setNote('Added. Give them their username and password so they can sign in.');}}
  async function toggleSuspend(u){const okd=await run('s-'+u.id,'team_update',{id:u.id,suspended:!u.suspended});if(okd)setNote(u.suspended?u.name+' can sign in again.':u.name+' is suspended and was signed out. Their deals are kept.');}
  async function changeRole(u,role){const okd=await run('r-'+u.id,'team_update',{id:u.id,role});if(okd)setNote(u.name+' is now '+(role==='admin'?'an Admin':'Sales')+'. They were signed out so it takes effect right away.');}
  async function doReset(){if(!reset)return;const okd=await run('pw','team_update',{id:reset.id,new_password:newPw});if(okd){setNote('New password set for '+reset.name+'. They were signed out.');setReset(null);setNewPw('');}}
  async function doRemove(){if(!rm)return;const okd=await run('rm','team_remove',{id:rm.id});if(okd){setNote(rm.name+' was removed. Their deals stay on your account.');setRm(null);}}
  const chip=(txt,bg,fg)=><span style={{fontSize:11,fontWeight:700,background:bg,color:fg,borderRadius:10,padding:'2px 9px'}}>{txt}</span>;
  const roleChip=r=>r==='admin'?chip('Admin','#E0E7FF','#3730A3'):chip('Sales','#F3F4F6','#374151');
  const fmtDay=t=>t?new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'never';
  if(!data)return <div style={{padding:24,color:terr?'#DC2626':'#9CA3AF',fontSize:14}}>{terr||'Loading team...'}</div>;
  const row={background:'#fff',borderRadius:12,padding:'14px 16px',marginBottom:10,boxShadow:'0 1px 6px rgba(0,0,0,0.07)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'};
  const sel={padding:'8px 10px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:14,fontFamily:'inherit',width:'100%',boxSizing:'border-box'};
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:6}}><h2 style={{margin:0,fontSize:20,fontWeight:700}}>Team</h2><Btn onClick={()=>{setAdding(true);setFerr('');setNote('');}}>+ Add team member</Btn></div>
    <div style={{fontSize:13,color:'#6B7280',marginBottom:16,lineHeight:1.5}}>Everyone signs in with their own username and password. <b>Sales</b> users see and work only their own deals. <b>Admins</b> see every deal for {broker.company_name} and can manage sales users. You can <b>suspend</b> a person to block their sign in without deleting anything.</div>
    {note&&<div style={{background:'#D1FAE5',color:'#065F46',borderRadius:8,padding:'10px 14px',fontSize:13,fontWeight:600,marginBottom:12}}>{note}</div>}
    {(terr||(ferr&&!adding&&!reset&&!rm))&&<div style={{background:'#FEE2E2',color:'#991B1B',borderRadius:8,padding:'10px 14px',fontSize:13,fontWeight:600,marginBottom:12}}>{terr||ferr}</div>}
    <div style={{...row,borderLeft:'4px solid #1D4ED8'}}><div><div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><span style={{fontWeight:700,fontSize:15}}>{data.owner.name}</span>{chip('Owner','#DBEAFE','#1E40AF')}{chip('Active','#D1FAE5','#065F46')}</div><div style={{fontSize:12,color:'#6B7280',marginTop:3}}>{data.owner.email||'Main company login'}</div><div style={{fontSize:12,color:'#9CA3AF',marginTop:2}}>{data.owner.deal_count} deal{data.owner.deal_count===1?'':'s'}</div></div><div style={{fontSize:12,color:'#9CA3AF'}}>Main account</div></div>
    {data.users.length===0&&<div style={{background:'#F8FAFC',border:'1.5px dashed #CBD5E1',borderRadius:12,padding:24,textAlign:'center',color:'#64748B',fontSize:14}}>No team members yet. Click <b>+ Add team member</b> to give a salesperson their own login.</div>}
    {data.users.map(u=><div key={u.id} style={{...row,opacity:u.suspended?0.8:1,borderLeft:'4px solid '+(u.suspended?'#F59E0B':'#10B981')}}>
      <div style={{minWidth:220}}><div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><span style={{fontWeight:700,fontSize:15}}>{u.name}</span>{roleChip(u.role)}{u.suspended?chip('Suspended','#FEF3C7','#92400E'):chip('Active','#D1FAE5','#065F46')}</div><div style={{fontSize:12,color:'#6B7280',marginTop:3}}>{u.username}{u.email?' \u00b7 '+u.email:''}{u.phone?' \u00b7 '+u.phone:''}</div><div style={{fontSize:12,color:'#9CA3AF',marginTop:2}}>{u.deal_count} deal{u.deal_count===1?'':'s'} · last sign in {fmtDay(u.last_login_at)}</div></div>
      {u.can_manage&&<div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>{data.can_add_admin&&<select value={u.role} onChange={e=>changeRole(u,e.target.value)} disabled={busy==='r-'+u.id} style={{padding:'6px 8px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:12,fontWeight:600}}><option value='sales'>Sales</option><option value='admin'>Admin</option></select>}<Btn size='sm' variant={u.suspended?'success':'outline'} onClick={()=>toggleSuspend(u)} loading={busy==='s-'+u.id}>{u.suspended?'Reactivate':'Suspend'}</Btn><Btn size='sm' variant='outline' onClick={()=>{setReset(u);setNewPw('');setFerr('');}}>Reset password</Btn><Btn size='sm' variant='danger' onClick={()=>{setRm(u);setFerr('');}}>Remove</Btn></div>}
    </div>)}
    {adding&&<Modal title='Add team member' onClose={()=>setAdding(false)}>
      <div style={{display:'flex',gap:16,flexWrap:'wrap'}}><Inp half label='Full name *' value={form.name} onChange={v=>setForm(p=>({...p,name:v}))}/><Inp half label='Username *' value={form.username} onChange={v=>setForm(p=>({...p,username:v}))} placeholder='jsmith'/><Inp half label='Email' value={form.email} onChange={v=>setForm(p=>({...p,email:v}))} type='email'/><Inp half label='Phone' value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))}/><Inp half label='Password * (8 or more characters)' value={form.password} onChange={v=>setForm(p=>({...p,password:v}))} type='password'/><div style={{flex:'1 1 200px',minWidth:200}}><label style={{display:'block',fontSize:12,fontWeight:600,color:'#374151',marginBottom:4}}>Role</label><select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} style={sel}><option value='sales'>Sales</option>{data.can_add_admin&&<option value='admin'>Admin</option>}</select></div></div>
      <div style={{background:'#F8FAFC',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#475569',margin:'4px 0 14px',lineHeight:1.5}}><b>Sales:</b> sees and works only the deals they create. <b>Admin:</b> sees every company deal and can manage sales users.{!data.can_add_admin&&' Only the account owner can add admins.'} If you add an email, they get a welcome message with their username (never the password).</div>
      {ferr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{ferr}</div>}
      <Btn onClick={addUser} loading={busy==='add'} disabled={!form.name.trim()||!form.username.trim()||form.password.length<8}>Add team member</Btn>
    </Modal>}
    {reset&&<Modal title={'Reset password for '+reset.name} onClose={()=>setReset(null)}>
      <Inp label='New password (8 or more characters)' value={newPw} onChange={setNewPw} type='password'/>
      <div style={{fontSize:12,color:'#6B7280',margin:'0 0 12px'}}>They will be signed out and need the new password to sign in again.</div>
      {ferr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{ferr}</div>}
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><Btn variant='outline' onClick={()=>setReset(null)}>Cancel</Btn><Btn onClick={doReset} loading={busy==='pw'} disabled={newPw.length<8}>Set password</Btn></div>
    </Modal>}
    {rm&&<Modal title={'Remove '+rm.name+'?'} onClose={()=>setRm(null)}>
      <div style={{fontSize:14,lineHeight:1.6,color:'#111827',marginBottom:14}}>{rm.name} will be signed out and can no longer sign in. Their {rm.deal_count} deal{rm.deal_count===1?'':'s'} stay on your account and keep their name. If you only want to pause them, use <b>Suspend</b> instead.</div>
      {ferr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{ferr}</div>}
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><Btn variant='outline' onClick={()=>setRm(null)}>Cancel</Btn><Btn variant='danger' onClick={doRemove} loading={busy==='rm'}>Remove {rm.name}</Btn></div>
    </Modal>}
  </div>;
}
const fmtMoney=n=>'$'+(Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtK=n=>{n=Number(n)||0;return n>=10000?'$'+Math.round(n/1000)+'k':n>=1000?'$'+(n/1000).toFixed(1)+'k':'$'+Math.round(n);};
const dayOf=t=>{if(!t)return '';const s=String(t);const d=new Date(s.length===10?s+'T12:00:00':s);return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});};
function MoneyInput({label,value,onChange,autoFocus,hint}){
  const clean=v=>{let o=v.split('').filter(c=>'0123456789.'.includes(c)).join('');const p=o.split('.');if(p.length>2)o=p[0]+'.'+p.slice(1).join('');const q=o.split('.');if(q[1]!==undefined&&q[1].length>2)o=q[0]+'.'+q[1].slice(0,2);return o;};
  return <div style={{marginBottom:14}}><label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:4}}>{label}</label><div style={{position:'relative'}}><span style={{position:'absolute',left:12,top:10,color:'#6B7280',fontWeight:700}}>$</span><input value={value} inputMode='decimal' autoFocus={autoFocus} onChange={e=>onChange(clean(e.target.value))} placeholder='0.00' style={{width:'100%',boxSizing:'border-box',padding:'10px 12px 10px 26px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:16,fontWeight:600,fontFamily:'inherit'}}/></div>{hint&&<div style={{fontSize:11,color:'#9CA3AF',marginTop:3}}>{hint}</div>}</div>;
}
function CloseDealModal({deal,editing,onClose,onSaved}){
  const[bd,setBd]=useState(deal.bird_dog_total!==null&&deal.bird_dog_total!==undefined?String(deal.bird_dog_total):''),[sc,setSc]=useState(deal.short_cod!==null&&deal.short_cod!==undefined&&Number(deal.short_cod)>0?String(deal.short_cod):''),[busy,setBusy]=useState(false),[cerr,setCerr]=useState('');
  const b=parseFloat(bd),s=sc===''?0:parseFloat(sc);
  const valid=bd!==''&&!isNaN(b)&&!isNaN(s)&&s<=b;
  const check=valid?Math.round((b-s)*100)/100:null;
  async function save(){setBusy(true);setCerr('');try{const money={bird_dog_total:bd,short_cod:sc===''?'0':sc};const body=editing?{deal_number:deal.deal_number,...money}:{deal_number:deal.deal_number,status:'Completed',...money};const r=await apiFetch(editing?'deals?action=payout':'deals?action=status',{method:'PUT',body});onSaved(r.deal||{});}catch(e){setCerr(e.message);}finally{setBusy(false);}}
  return <Modal title={editing?'Edit payout':'Close this deal'} onClose={onClose}>
    <div style={{background:'#F8FAFC',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:13}}><b>{deal.customer_name}</b> · {deal.vehicle_desc} · #{deal.deal_number}</div>
    {!editing&&<div style={{fontSize:13,color:'#475569',marginBottom:14,lineHeight:1.5}}>Before this deal is marked <b>Completed</b>, enter the money so the broker and your team can track what is owed.</div>}
    <MoneyInput label='Total bird dog' value={bd} onChange={setBd} autoFocus/>
    <MoneyInput label='Short COD' value={sc} onChange={setSc} hint='Anything short at delivery that comes out of the bird dog. Leave blank if none.'/>
    <div style={{background:check!==null?'#ECFDF5':'#F3F4F6',border:'2px solid '+(check!==null?'#10B981':'#E5E7EB'),borderRadius:12,padding:'12px 16px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontSize:11,fontWeight:700,color:'#065F46',textTransform:'uppercase'}}>Check amount</div><div style={{fontSize:11,color:'#6B7280'}}>Total bird dog minus short COD</div></div><div style={{fontSize:26,fontWeight:800,color:check!==null?'#065F46':'#9CA3AF'}}>{check!==null?fmtMoney(check):'$0.00'}</div></div>
    {!isNaN(b)&&!isNaN(s)&&s>b&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>Short COD cannot be more than the total bird dog.</div>}
    {cerr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{cerr}</div>}
    <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><Btn variant='outline' onClick={onClose}>Cancel</Btn><Btn variant='success' onClick={save} loading={busy} disabled={!valid}>{editing?'Save payout':'Mark Completed'}</Btn></div>
  </Modal>;
}
function PayoutCard({deal,onPatch}){
  const[edit,setEdit]=useState(false),[paying,setPaying]=useState(false),[ref,setRef]=useState(''),[busy,setBusy]=useState(false),[perr,setPerr]=useState('');
  const has=deal.check_amount!==null&&deal.check_amount!==undefined,paid=!!deal.check_paid_at;
  async function pay(p){setBusy(true);setPerr('');try{const r=await apiFetch('deals?action=payout',{method:'PUT',body:{deal_number:deal.deal_number,paid:p,check_ref:p?ref.trim():''}});if(onPatch)onPatch(deal.deal_number,r.deal||{});setPaying(false);setRef('');}catch(e){setPerr(e.message);}finally{setBusy(false);}}
  return <div style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:12,padding:16,marginBottom:14}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,gap:8,flexWrap:'wrap'}}><div style={{fontSize:13,fontWeight:700}}>Payout</div>{has&&<span style={{fontSize:11,fontWeight:700,borderRadius:10,padding:'2px 10px',background:paid?'#D1FAE5':'#FEF3C7',color:paid?'#065F46':'#92400E'}}>{paid?'\u2713 Paid '+dayOf(deal.check_paid_at)+(deal.check_ref?' \u00b7 '+deal.check_ref:''):'Outstanding'}</span>}</div>
    {!has?<div><div style={{fontSize:13,color:'#6B7280',marginBottom:10}}>No payout amounts have been entered for this completed deal yet.</div><Btn size='sm' onClick={()=>setEdit(true)}>Enter payout</Btn></div>
    :<div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:12}}>{[['Total bird dog',deal.bird_dog_total,'#111827'],['Short COD',deal.short_cod,'#B45309'],['Check amount',deal.check_amount,'#065F46']].map(([l,v,c])=><div key={l} style={{background:'#F8FAFC',borderRadius:10,padding:'10px 12px'}}><div style={{fontSize:10,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase'}}>{l}</div><div style={{fontSize:17,fontWeight:800,color:c}}>{fmtMoney(v)}</div></div>)}</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{!paid&&<Btn size='sm' variant='success' onClick={()=>setPaying(true)}>Mark check paid</Btn>}{paid&&<Btn size='sm' variant='outline' onClick={()=>pay(false)} loading={busy}>Mark unpaid</Btn>}{!paid&&<Btn size='sm' variant='outline' onClick={()=>setEdit(true)}>Edit amounts</Btn>}</div>
      {paid&&<div style={{fontSize:11,color:'#9CA3AF',marginTop:8}}>To change the amounts, mark the check unpaid first.</div>}</div>}
    {perr&&<div style={{color:'#DC2626',fontSize:13,marginTop:8}}>{perr}</div>}
    {edit&&<CloseDealModal deal={deal} editing onClose={()=>setEdit(false)} onSaved={patch=>{setEdit(false);if(onPatch)onPatch(deal.deal_number,patch);}}/>}
    {paying&&<Modal title='Mark check paid' onClose={()=>setPaying(false)}><div style={{fontSize:14,marginBottom:12}}>Check amount: <b>{fmtMoney(deal.check_amount)}</b></div><label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:4}}>Check number or note (optional)</label><input value={ref} onChange={e=>setRef(e.target.value)} maxLength={60} placeholder='e.g. 1042' style={{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:14,fontFamily:'inherit',marginBottom:14}}/>{perr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{perr}</div>}<div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><Btn variant='outline' onClick={()=>setPaying(false)}>Cancel</Btn><Btn variant='success' onClick={()=>pay(true)} loading={busy}>Mark paid</Btn></div></Modal>}
  </div>;
}
function KpiTile({label,value,sub,color,big}){return <div style={{background:'#fff',borderRadius:12,padding:'14px 16px',boxShadow:'0 1px 6px rgba(0,0,0,0.07)',borderTop:'4px solid '+color}}><div style={{fontSize:11,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.04em'}}>{label}</div><div style={{fontSize:big?28:22,fontWeight:800,color:'#111827',marginTop:4}}>{value}</div>{sub&&<div style={{fontSize:12,color:'#6B7280',marginTop:2}}>{sub}</div>}</div>;}
function ChartCard({title,children}){return <div style={{background:'#fff',borderRadius:12,padding:16,boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}><div style={{fontSize:13,fontWeight:700,color:'#374151',marginBottom:12}}>{title}</div>{children}</div>;}
function BarChart({data,valueKey,color,fmt}){
  const W=560,H=170,L=6,R=6,T=20,Bt=26;
  const max=Math.max(1,...data.map(d=>Number(d[valueKey])||0));
  const n=data.length,bw=(W-L-R)/n;
  const any=data.some(d=>(Number(d[valueKey])||0)>0);
  return <div><svg viewBox={'0 0 '+W+' '+H} style={{width:'100%',height:'auto',display:'block'}}>
    {[0.5,1].map(t=><line key={t} x1={L} x2={W-R} y1={T+(H-T-Bt)*(1-t)} y2={T+(H-T-Bt)*(1-t)} stroke='#E5E7EB' strokeDasharray='3 3'/>)}
    <line x1={L} x2={W-R} y1={H-Bt} y2={H-Bt} stroke='#D1D5DB'/>
    {data.map((d,i)=>{const v=Number(d[valueKey])||0,h=(H-T-Bt)*v/max,x=L+i*bw+bw*0.16,w=bw*0.68;return <g key={d.key||i}><rect x={x} y={H-Bt-h} width={w} height={v>0?Math.max(h,2):0} rx='3' fill={color}/>{v>0&&<text x={x+w/2} y={H-Bt-h-4} textAnchor='middle' fontSize='10' fontWeight='700' fill='#374151'>{fmt?fmt(v):v}</text>}<text x={x+w/2} y={H-9} textAnchor='middle' fontSize='10' fill='#6B7280'>{d.label}</text></g>;})}
  </svg>{!any&&<div style={{textAlign:'center',fontSize:12,color:'#9CA3AF',marginTop:-6}}>Nothing to show yet</div>}</div>;
}
function Donut({parts,center,sub}){
  const size=170,r=64,c=2*Math.PI*r,total=parts.reduce((a,p)=>a+p.value,0);let off=0;
  return <div style={{display:'flex',alignItems:'center',gap:20,flexWrap:'wrap',justifyContent:'center'}}>
    <svg width={size} height={size} viewBox={'0 0 '+size+' '+size}><circle cx={size/2} cy={size/2} r={r} fill='none' stroke='#F3F4F6' strokeWidth='22'/>{total>0&&parts.filter(p=>p.value>0).map(p=>{const len=c*p.value/total;const el=<circle key={p.label} cx={size/2} cy={size/2} r={r} fill='none' stroke={p.color} strokeWidth='22' strokeDasharray={len+' '+(c-len)} strokeDashoffset={-off} transform={'rotate(-90 '+size/2+' '+size/2+')'}/>;off+=len;return el;})}<text x='50%' y='50%' textAnchor='middle' fontSize='28' fontWeight='800' fill='#111827'>{center}</text><text x='50%' y='62%' textAnchor='middle' fontSize='11' fill='#6B7280'>{sub}</text></svg>
    <div style={{display:'flex',flexDirection:'column',gap:5,fontSize:12,minWidth:150}}>{parts.filter(p=>p.value>0).map(p=><div key={p.label} style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:10,height:10,borderRadius:3,background:p.color,display:'inline-block'}}/><span style={{color:'#374151'}}>{p.label}</span><b style={{marginLeft:'auto',paddingLeft:12}}>{p.value}</b></div>)}{total===0&&<span style={{color:'#9CA3AF'}}>No deals yet</span>}</div>
  </div>;
}
function Funnel({steps}){const max=Math.max(1,steps[0].value);return <div>{steps.map(s=><div key={s.label} style={{marginBottom:11}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}><span style={{fontWeight:600,color:'#374151'}}>{s.label}</span><span style={{color:'#6B7280'}}><b style={{color:'#111827'}}>{s.value}</b>{s.pct!==undefined&&' \u00b7 '+s.pct+'%'}</span></div><div style={{background:'#F3F4F6',borderRadius:8,height:14,overflow:'hidden'}}><div style={{width:Math.max(s.value>0?3:0,s.value/max*100)+'%',background:s.color,height:'100%',borderRadius:8}}/></div></div>)}</div>;}
function StatsView({stats,isStaff,onPay,onUnpay,busyDeal}){
  const[pf,setPf]=useState('all'),[paying,setPaying]=useState(null),[ref,setRef]=useState('');
  const m=stats.money,t=stats.totals,sc=stats.status_counts||{};
  const rate=t.requests?Math.round(t.completed/t.requests*100):0;
  const paidPct=m.check_total>0?Math.round(m.paid_total/m.check_total*100):0;
  const pct=v=>t.requests?Math.round(v/t.requests*100):0;
  const funnel=[{label:'Requests',value:t.requests,color:'#3B82F6'},{label:'Credit applications',value:t.applications,pct:pct(t.applications),color:'#F59E0B'},{label:'Approved',value:t.approved,pct:pct(t.approved),color:'#8B5CF6'},{label:'Completed (delivered)',value:t.completed,pct:pct(t.completed),color:'#10B981'}];
  const parts=ADMIN_STATUSES.map(s=>({label:sLabel(s),value:sc[s]||0,color:(SC[s]||{}).color||'#6B7280'}));
  const all=stats.payouts||[],nPaid=all.filter(p=>p.paid).length,nOut=all.length-nPaid;
  const rows=all.filter(p=>pf==='all'||(pf==='paid'?p.paid:!p.paid));
  const groups=stats.by_person||stats.by_broker||[];
  const byBroker=!!stats.by_broker,showWho=byBroker||!!stats.by_person;
  const th={textAlign:'left',fontSize:11,fontWeight:700,color:'#6B7280',textTransform:'uppercase',padding:'8px 10px',borderBottom:'2px solid #E5E7EB',whiteSpace:'nowrap'},td={padding:'10px',borderBottom:'1px solid #F3F4F6',fontSize:13,verticalAlign:'middle'},num={textAlign:'right',whiteSpace:'nowrap'};
  const card={background:'#fff',borderRadius:12,padding:16,boxShadow:'0 1px 6px rgba(0,0,0,0.07)',marginBottom:14};
  const chipBtn=(k,l,n)=><button key={k} onClick={()=>setPf(k)} style={{padding:'5px 12px',borderRadius:16,border:'1.5px solid '+(pf===k?'#1D4ED8':'#E5E7EB'),background:pf===k?'#1D4ED8':'#fff',color:pf===k?'#fff':'#374151',fontWeight:700,fontSize:12,cursor:'pointer'}}>{l} ({n})</button>;
  const sum=k=>Math.round(rows.reduce((a,p)=>a+Math.round(p[k]*100),0))/100;
  return <div>
    {stats.awaiting_payout_entry>0&&<div style={{background:'#FEF3C7',border:'1.5px solid #FCD34D',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#92400E',marginBottom:14}}><b>{stats.awaiting_payout_entry}</b> completed deal{stats.awaiting_payout_entry===1?' has':'s have'} no payout amounts yet. {isStaff?'Open the deal, go to its Status tab and choose Enter payout.':'Brooklyn CDJR will enter these soon.'}</div>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12,marginBottom:14}}>
      <KpiTile big label='Outstanding' value={fmtMoney(m.outstanding_total)} sub={m.outstanding_count+' check'+(m.outstanding_count===1?'':'s')+' still to be paid'} color='#F59E0B'/>
      <KpiTile big label='Paid' value={fmtMoney(m.paid_total)} sub={m.paid_count+' check'+(m.paid_count===1?'':'s')+' paid'} color='#10B981'/>
      <KpiTile big label='Total earned' value={fmtMoney(m.check_total)} sub={m.completed_with_payout+' completed deal'+(m.completed_with_payout===1?'':'s')} color='#3B82F6'/>
      <KpiTile label='Total bird dog' value={fmtMoney(m.bird_dog_total)} color='#6366F1'/>
      <KpiTile label='Short COD' value={fmtMoney(m.short_cod_total)} sub='deducted from bird dog' color='#EF4444'/>
      <KpiTile label='Close rate' value={rate+'%'} sub={t.completed+' of '+t.requests+' requests'} color='#14B8A6'/>
    </div>
    {m.check_total>0&&<div style={card}><div style={{display:'flex',justifyContent:'space-between',fontSize:12,fontWeight:700,marginBottom:6,flexWrap:'wrap',gap:6}}><span style={{color:'#065F46'}}>Paid {fmtMoney(m.paid_total)}</span><span style={{color:'#92400E'}}>Outstanding {fmtMoney(m.outstanding_total)}</span></div><div style={{display:'flex',height:16,borderRadius:8,overflow:'hidden',background:'#FDE68A'}}><div style={{width:paidPct+'%',background:'#10B981'}}/></div><div style={{fontSize:11,color:'#6B7280',marginTop:5}}>{paidPct}% of earnings have been paid</div></div>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:14,marginBottom:14}}>
      <ChartCard title='Deals by status'><Donut parts={parts} center={t.requests} sub='total deals'/></ChartCard>
      <ChartCard title='Deal funnel'><Funnel steps={funnel}/></ChartCard>
      <ChartCard title='Deals completed per month'><BarChart data={stats.months} valueKey='completed' color='#10B981'/></ChartCard>
      <ChartCard title='Earned per month (check amounts)'><BarChart data={stats.months} valueKey='earned' color='#3B82F6' fmt={fmtK}/></ChartCard>
      <ChartCard title='New requests per month'><BarChart data={stats.months} valueKey='requests' color='#F59E0B'/></ChartCard>
      <ChartCard title='Checks paid per month'><BarChart data={stats.months} valueKey='paid' color='#8B5CF6' fmt={fmtK}/></ChartCard>
    </div>
    {groups.length>1&&<div style={card}><div style={{fontSize:13,fontWeight:700,color:'#374151',marginBottom:10}}>{byBroker?'By broker':'By salesperson'}</div><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={th}>{byBroker?'Broker':'Person'}</th><th style={{...th,...num}}>Deals</th><th style={{...th,...num}}>Completed</th><th style={{...th,...num}}>Earned</th><th style={{...th,...num}}>Paid</th><th style={{...th,...num}}>Outstanding</th></tr></thead><tbody>{groups.map(g=><tr key={g.name}><td style={{...td,fontWeight:700}}>{g.name}</td><td style={{...td,...num}}>{g.deals}</td><td style={{...td,...num}}>{g.completed}</td><td style={{...td,...num}}>{fmtMoney(g.earned)}</td><td style={{...td,...num,color:'#065F46'}}>{fmtMoney(g.paid)}</td><td style={{...td,...num,fontWeight:700,color:g.outstanding>0?'#92400E':'#6B7280'}}>{fmtMoney(g.outstanding)}</td></tr>)}</tbody></table></div></div>}
    <div style={card}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10,marginBottom:10}}><div style={{fontSize:13,fontWeight:700,color:'#374151'}}>Payouts by deal</div><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{chipBtn('all','All',all.length)}{chipBtn('out','Outstanding',nOut)}{chipBtn('paid','Paid',nPaid)}</div></div>
      {rows.length===0?<div style={{textAlign:'center',padding:24,color:'#9CA3AF',fontSize:13,background:'#F8FAFC',borderRadius:10}}>{all.length===0?'No completed deals with a payout yet.':'Nothing in this view.'}</div>
      :<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:640}}><thead><tr><th style={th}>Deal</th><th style={th}>Customer</th>{showWho&&<th style={th}>{byBroker?'Broker':'Salesperson'}</th>}<th style={th}>Closed</th><th style={{...th,...num}}>Bird dog</th><th style={{...th,...num}}>Short COD</th><th style={{...th,...num}}>Check</th><th style={th}>Status</th></tr></thead><tbody>{rows.map(p=><tr key={p.deal_number}><td style={{...td,fontWeight:700,whiteSpace:'nowrap'}}>#{p.deal_number}</td><td style={td}><div style={{fontWeight:600}}>{p.customer_name}</div><div style={{fontSize:11,color:'#9CA3AF'}}>{p.vehicle_desc}</div></td>{showWho&&<td style={td}>{byBroker?p.broker_name:p.person}</td>}<td style={{...td,whiteSpace:'nowrap'}}>{dayOf(p.sold_date)}</td><td style={{...td,...num}}>{fmtMoney(p.bird_dog_total)}</td><td style={{...td,...num,color:p.short_cod>0?'#B45309':'#9CA3AF'}}>{fmtMoney(p.short_cod)}</td><td style={{...td,...num,fontWeight:800}}>{fmtMoney(p.check_amount)}</td><td style={td}>{p.paid?<div><span style={{fontSize:11,fontWeight:700,background:'#D1FAE5',color:'#065F46',borderRadius:10,padding:'2px 9px',whiteSpace:'nowrap'}}>✓ Paid {dayOf(p.check_paid_at)}</span>{p.check_ref&&<div style={{fontSize:11,color:'#6B7280',marginTop:2}}>Check {p.check_ref}</div>}{isStaff&&<button onClick={()=>onUnpay(p.deal_number)} disabled={busyDeal===p.deal_number} style={{background:'none',border:'none',color:'#6B7280',fontSize:11,textDecoration:'underline',cursor:'pointer',padding:0,marginTop:2}}>Mark unpaid</button>}</div>:<div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><span style={{fontSize:11,fontWeight:700,background:'#FEF3C7',color:'#92400E',borderRadius:10,padding:'2px 9px'}}>Outstanding</span>{isStaff&&<Btn size='sm' variant='success' onClick={()=>{setPaying(p);setRef('');}} loading={busyDeal===p.deal_number}>Mark paid</Btn>}</div>}</td></tr>)}</tbody><tfoot><tr><td style={{...td,fontWeight:800}} colSpan={showWho?4:3}>Total ({rows.length} deal{rows.length===1?'':'s'})</td><td style={{...td,...num,fontWeight:800}}>{fmtMoney(sum('bird_dog_total'))}</td><td style={{...td,...num,fontWeight:800}}>{fmtMoney(sum('short_cod'))}</td><td style={{...td,...num,fontWeight:800}}>{fmtMoney(sum('check_amount'))}</td><td style={td}/></tr></tfoot></table></div>}
    </div>
    {paying&&<Modal title='Mark check paid' onClose={()=>setPaying(null)}><div style={{fontSize:14,marginBottom:4}}>Deal <b>#{paying.deal_number}</b> · {paying.customer_name}</div><div style={{fontSize:14,marginBottom:12}}>Check amount: <b>{fmtMoney(paying.check_amount)}</b></div><label style={{display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:4}}>Check number or note (optional)</label><input value={ref} onChange={e=>setRef(e.target.value)} maxLength={60} placeholder='e.g. 1042' style={{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:14,fontFamily:'inherit',marginBottom:14}}/><div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><Btn variant='outline' onClick={()=>setPaying(null)}>Cancel</Btn><Btn variant='success' onClick={()=>{onPay(paying.deal_number,ref.trim());setPaying(null);setRef('');}}>Mark paid</Btn></div></Modal>}
  </div>;
}
function StatsLoader({brokerId,owner,isStaff}){
  const[stats,setStats]=useState(null),[serr,setSerr]=useState(''),[busyDeal,setBusyDeal]=useState('');
  const url='deals?action=stats'+(brokerId?'&broker_id='+brokerId:'')+(owner&&owner!=='all'?'&owner='+owner:'');
  const load=useCallback(async()=>{try{setStats(await apiFetch(url));setSerr('');}catch(e){setSerr(e.message);}},[url]);
  useEffect(()=>{setStats(null);load();},[load]);
  useLive(['events','deals'],()=>{load();});
  async function setPaid(dn,paid,ref){setBusyDeal(dn);try{await apiFetch('deals?action=payout',{method:'PUT',body:{deal_number:dn,paid,check_ref:ref||''}});await load();}catch(e){setSerr(e.message);}finally{setBusyDeal('');}}
  if(serr&&!stats)return <div style={{padding:24,color:'#DC2626',fontSize:14}}>{serr}</div>;
  if(!stats)return <div style={{padding:40,textAlign:'center',color:'#9CA3AF'}}>Loading stats...</div>;
  return <div>{serr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{serr}</div>}<StatsView stats={stats} isStaff={!!isStaff} onPay={(dn,ref)=>setPaid(dn,true,ref)} onUnpay={dn=>setPaid(dn,false)} busyDeal={busyDeal}/></div>;
}
// Live updates: one small timer asks the server what changed, and each screen reloads only what it needs.
// It does not run while the tab is hidden, and it slows down when nobody is touching the page.
function startLivePulse(fetchSig,opts={}){
  const win=opts.win||window,doc=opts.doc||document,active=opts.active||8000,idle=opts.idle||30000,idleAfter=opts.idleAfter||300000;
  let last=null,stopped=false,timer=null,busy=false,lastActive=Date.now();
  const bump=()=>{lastActive=Date.now();};
  async function tick(){
    if(stopped||busy||doc.hidden)return;
    busy=true;
    try{
      const sig=await fetchSig();
      if(sig&&typeof sig==='object'){
        if(last){const changed=Object.keys(sig).filter(k=>String(sig[k])!==String(last[k]));if(changed.length)win.dispatchEvent(new CustomEvent('live-update',{detail:{changed}}));}
        last=sig;
      }
    }catch(e){}
    finally{busy=false;}
  }
  function loop(){timer=setTimeout(async()=>{await tick();if(!stopped)loop();},(Date.now()-lastActive>idleAfter)?idle:active);}
  const wake=()=>{if(!doc.hidden){bump();tick();}};
  const evs=['mousemove','keydown','click','touchstart','scroll'];
  evs.forEach(e=>win.addEventListener(e,bump,{passive:true}));
  doc.addEventListener('visibilitychange',wake);win.addEventListener('focus',wake);win.addEventListener('online',wake);
  tick();loop();
  return()=>{stopped=true;clearTimeout(timer);evs.forEach(e=>win.removeEventListener(e,bump));doc.removeEventListener('visibilitychange',wake);win.removeEventListener('focus',wake);win.removeEventListener('online',wake);};
}
function LivePulse(){useEffect(()=>startLivePulse(async()=>{const r=await apiFetch('deals?action=pulse');return r&&r.sig;}),[]);return null;}
const liveMatches=(keys,changed)=>!keys||keys.some(k=>changed.includes(k));
function useLive(keys,fn){const ref=useRef(fn);ref.current=fn;useEffect(()=>{const h=e=>{const ch=(e.detail&&e.detail.changed)||[];if(liveMatches(keys,ch))ref.current(ch);};window.addEventListener('live-update',h);return()=>window.removeEventListener('live-update',h);},[]);}
const carLast=n=>{const p=String(n||'').trim().split(' ').filter(Boolean);if(!p.length)return '';const l=p[p.length-1];const b=l.split('.').join('').toLowerCase();return p.length>1&&['jr','sr','ii','iii','iv'].includes(b)?p[p.length-2]:l;};
const carTitle=({vin,model,last,broker,inspection})=>[vin,model,last,broker,inspection?'INSPECTION NEEDED':'NO INSPECTION'].filter(Boolean).join(' - ');
const carAgo=t=>{if(!t)return '';const m=Math.max(0,Math.round((Date.now()-new Date(t).getTime())/60000));return m<1?'just now':m<60?m+'m':m<1440?Math.round(m/60)+'h':Math.round(m/1440)+'d';};
const carIcon={file_added:'📎',file_removed:'🗑️',created:'\ud83c\udd95',moved:'\u27a1\ufe0f',removed:'\ud83d\uddd1\ufe0f'};
function CarCardView({card,color,onOpen,drag}){
  return <div draggable={!!drag} onDragStart={drag?e=>{e.dataTransfer.setData('text/plain',String(card.id));e.dataTransfer.effectAllowed='move';drag(card.id);}:undefined} onClick={()=>onOpen(card)} style={{background:'#fff',borderRadius:8,padding:'10px 12px',marginBottom:8,boxShadow:'0 1px 3px rgba(9,30,66,0.25)',cursor:'pointer',borderLeft:'4px solid '+color}}>
    <div style={{fontSize:13,fontWeight:600,color:'#172B4D',lineHeight:1.4,wordBreak:'break-word'}}>{card.title}</div>
    <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginTop:8}}>
      <span style={{fontSize:10,fontWeight:700,borderRadius:4,padding:'2px 6px',background:card.inspection?'#FFF0B3':'#EBECF0',color:card.inspection?'#7A5200':'#5E6C84'}}>{card.inspection?'INSPECTION':'NO INSPECTION'}</span>
      {card.deal_number&&<span style={{fontSize:11,color:'#5E6C84',fontWeight:600}}>#{card.deal_number}</span>}
      <span style={{marginLeft:'auto',fontSize:11,color:'#5E6C84'}}>{card.notes_count>0&&<span>{'\ud83d\udcac '}{card.notes_count}{'  '}</span>}{carAgo(card.moved_at)}</span>
    </div>
  </div>;
}
function CarBoardView({columns,cards,onOpen,onDropCard,canDrag,loading,error}){
  const[over,setOver]=useState(''),dragId=useRef(null);
  return <div>
    {error&&<div style={{background:'#FEE2E2',color:'#991B1B',borderRadius:8,padding:'10px 14px',fontSize:13,fontWeight:600,marginBottom:12}}>{error}</div>}
    {columns.length===0&&!error&&<div style={{padding:'28px 8px',textAlign:'center',color:'#94A3B8',fontSize:14}}>{loading?'Loading the board...':'Nothing to show yet.'}</div>}
    <div style={{display:'flex',gap:12,overflowX:'auto',paddingBottom:14,alignItems:'flex-start'}}>
      {columns.map(col=>{const list=cards.filter(c=>c.column_key===col.key);return <div key={col.key} onDragOver={canDrag?e=>{e.preventDefault();setOver(col.key);}:undefined} onDragLeave={canDrag?()=>setOver(''):undefined} onDrop={canDrag?e=>{e.preventDefault();setOver('');const id=Number(e.dataTransfer.getData('text/plain'))||dragId.current;if(id)onDropCard(id,col.key);dragId.current=null;}:undefined} style={{flex:'0 0 272px',background:over===col.key?'#DEEBFF':'#EBECF0',borderRadius:10,padding:10,minHeight:150,border:'2px solid '+(over===col.key?'#4C9AFF':'transparent')}}>
        <div style={{display:'flex',alignItems:'center',gap:8,margin:'2px 4px 10px'}}><span style={{fontSize:12,fontWeight:700,color:'#5E6C84',textTransform:'uppercase'}}>{col.label}</span><span style={{fontSize:12,color:'#5E6C84'}}>{list.length}</span></div>
        {list.map(c=><CarCardView key={c.id} card={c} color={col.color} onOpen={onOpen} drag={canDrag?id=>{dragId.current=id;}:null}/>)}
        {list.length===0&&<div style={{textAlign:'center',padding:'18px 6px',fontSize:12,color:'#97A0AF'}}>{loading?'Loading...':'No cars here'}</div>}
      </div>;})}
    </div>
  </div>;
}
const inspExts=['pdf','jpg','jpeg','png','gif','webp','heic','heif','tif','tiff','doc','docx','xls','xlsx','txt','csv'];
const inspImgs=['jpg','jpeg','png','webp','heic','heif','tif','tiff'];
const inspExt=name=>{const p=String(name||'').split('.');return p.length>1?p.pop().toLowerCase():'';};
const inspSize=n=>{const v=Number(n)||0;return v>=1048576?(v/1048576).toFixed(1)+' MB':Math.max(1,Math.round(v/1024))+' KB';};
const inspGlyph=name=>{const e=inspExt(name);return e==='pdf'?'📄':(inspImgs.includes(e)||e==='gif')?'🖼️':'📎';};
async function prepareInspection(f){
  const ext=inspExt(f.name);
  if(!inspExts.includes(ext))throw new Error('"'+f.name+'" is not an allowed file type. Use PDF, JPG, PNG, Word, Excel or a text file.');
  let blob=f,name=f.name;
  if(inspImgs.includes(ext)&&f.size>1200000){
    try{const bmp=await createImageBitmap(f);const scale=Math.min(1,2200/Math.max(bmp.width,bmp.height));const cv=document.createElement('canvas');cv.width=Math.round(bmp.width*scale);cv.height=Math.round(bmp.height*scale);cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);const out=await new Promise(r=>cv.toBlob(r,'image/jpeg',0.85));if(out&&out.size<f.size){blob=out;name=name.slice(0,name.length-ext.length)+'jpg';}}catch(e){}
  }
  if(blob.size>3000000)throw new Error('"'+f.name+'" is too large (3 MB max). '+(inspImgs.includes(ext)?'Try a smaller photo.':'Try a smaller file, or a photo instead of a scan.'));
  const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(blob);});
  return{name,data};
}

function CarActivity({log,note,setNote,onSend,busy,err,initialTab,cardId,initialFiles}){
  const[tab,setTab]=useState(initialTab||'notes'),[files,setFiles]=useState(initialFiles||null),[ferr,setFerr]=useState(''),[upMsg,setUpMsg]=useState(''),[uploading,setUploading]=useState(false),[rmId,setRmId]=useState(null);
  const fileRef=useRef(null),token=localStorage.getItem('auth_token')||'';
  const fmt=t=>new Date(t).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const loadFiles=useCallback(async()=>{if(!cardId)return;try{const r=await apiFetch('porter?action=files&card_id='+cardId);setFiles(r.files||[]);}catch(e){setFerr(e.message);}},[cardId]);
  useEffect(()=>{if(!initialFiles)loadFiles();},[loadFiles]);
  useLive(['cars'],()=>{loadFiles();});
  async function pick(e){const list=Array.from((e.target&&e.target.files)||[]);if(e.target)e.target.value='';if(!list.length)return;setUploading(true);setFerr('');setUpMsg('');let done=0;for(let i=0;i<list.length;i++){try{setUpMsg('Uploading '+(i+1)+' of '+list.length+'...');const p=await prepareInspection(list[i]);await apiFetch('porter?action=file_add',{method:'POST',body:{card_id:cardId,name:p.name,data:p.data}});done++;}catch(ex){setFerr(ex.message);break;}}setUploading(false);setUpMsg(done?'Uploaded '+done+(done===1?' file.':' files.'):'');await loadFiles();}
  async function removeFile(f){try{await apiFetch('porter?action=file_remove',{method:'POST',body:{id:f.id}});setRmId(null);await loadFiles();}catch(ex){setFerr(ex.message);setRmId(null);}}
  const openFile=f=>window.open(API+'/porter?action=file&id='+f.id+'&_t='+encodeURIComponent(token),'_blank');
  const notes=log.filter(l=>l.action==='note'),acts=log.filter(l=>l.action!=='note');
  const tabBtn=(k,l,n)=><button key={k} type='button' onClick={()=>setTab(k)} style={{flex:1,padding:'9px 12px',border:'none',borderBottom:'3px solid '+(tab===k?'#1D4ED8':'transparent'),background:'none',cursor:'pointer',fontWeight:700,fontSize:13,color:tab===k?'#1D4ED8':'#6B7280'}}>{l}<span style={{marginLeft:6,background:tab===k?'#DBEAFE':'#F3F4F6',color:tab===k?'#1D4ED8':'#6B7280',borderRadius:10,padding:'1px 8px',fontSize:11}}>{n}</span></button>;
  return <div>
    <div style={{display:'flex',borderBottom:'1px solid #E5E7EB',marginBottom:12}}>{tabBtn('notes','Notes',notes.length)}{tabBtn('activity','Activity',acts.length)}{cardId&&tabBtn('files','Inspection',files?files.length:0)}</div>
    {tab==='notes'&&<>
      <div style={{maxHeight:240,overflowY:'auto',marginBottom:10}}>
        {notes.length===0&&<div style={{fontSize:13,color:'#9CA3AF',padding:'6px 0'}}>No notes yet.</div>}
        {notes.map(l=><div key={l.id} style={{background:l.actor_role==='porter'?'#FEF3C7':'#EFF6FF',borderRadius:10,padding:'8px 12px',marginBottom:8}}><div style={{fontSize:11,color:'#6B7280',marginBottom:2}}><b>{l.actor_name}</b>{l.actor_role==='porter'?' (porter)':' (office)'}{' · '}{fmt(l.created_at)}</div><div style={{fontSize:14,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{l.detail}</div></div>)}
      </div>
      <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} maxLength={1000} placeholder='Add a note...' style={{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:14,fontFamily:'inherit',resize:'vertical',marginBottom:8}}/>
      {err&&<div style={{color:'#DC2626',fontSize:13,marginBottom:8}}>{err}</div>}
      <Btn size='sm' onClick={onSend} loading={busy} disabled={!note.trim()}>Add note</Btn>
    </>}
    {tab==='activity'&&<div style={{maxHeight:300,overflowY:'auto'}}>
      {acts.length===0&&<div style={{fontSize:13,color:'#9CA3AF',padding:'6px 0'}}>No activity yet.</div>}
      {acts.map(l=><div key={l.id} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'8px 0',borderBottom:'1px solid #F3F4F6'}}><div style={{width:22,textAlign:'center',fontSize:15}}>{carIcon[l.action]||'•'}</div><div style={{minWidth:0}}><div style={{fontSize:13,color:'#374151',wordBreak:'break-word'}}>{l.detail}</div><div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{l.actor_name}{' · '}{fmt(l.created_at)}</div></div></div>)}
    </div>}
    {tab==='files'&&<div>
      <div style={{fontSize:12,color:'#6B7280',marginBottom:10,lineHeight:1.5}}>Upload the inspection report or photos here: PDF, JPG, PNG, Word, Excel or text, up to 3 MB each. Large photos are shrunk automatically.</div>
      <input ref={fileRef} type='file' multiple accept={'.'+inspExts.join(',.')} onChange={pick} style={{display:'none'}}/>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}><Btn onClick={()=>fileRef.current&&fileRef.current.click()} loading={uploading}>+ Upload inspection file</Btn>{upMsg&&<span style={{fontSize:12,color:'#065F46',fontWeight:600}}>{upMsg}</span>}</div>
      {ferr&&<div style={{color:'#DC2626',fontSize:13,marginTop:8}}>{ferr}</div>}
      <div style={{marginTop:12,maxHeight:260,overflowY:'auto'}}>
        {files===null?<div style={{fontSize:13,color:'#9CA3AF',padding:'6px 0'}}>Loading files...</div>:files.length===0?<div style={{fontSize:13,color:'#9CA3AF',padding:'6px 0'}}>No inspection file uploaded yet.</div>:files.map(f=><div key={f.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',border:'1.5px solid #E5E7EB',borderRadius:10,marginBottom:8,background:'#fff'}}>
          <div style={{fontSize:22}}>{inspGlyph(f.name)}</div>
          <div style={{flex:1,minWidth:0}}><button type='button' onClick={()=>openFile(f)} style={{background:'none',border:'none',padding:0,cursor:'pointer',color:'#1D4ED8',fontWeight:700,fontSize:14,textAlign:'left',wordBreak:'break-word'}}>{f.name}</button><div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{inspSize(f.size)}{' · '}{f.uploaded_by_name}{f.uploaded_by_role==='porter'?' (porter)':' (office)'}{' · '}{fmt(f.created_at)}</div></div>
          {f.can_delete&&(rmId===f.id?<div style={{display:'flex',gap:6}}><Btn size='sm' variant='danger' onClick={()=>removeFile(f)}>Confirm remove</Btn><Btn size='sm' variant='outline' onClick={()=>setRmId(null)}>Keep</Btn></div>:<Btn size='sm' variant='outline' onClick={()=>setRmId(f.id)} style={{color:'#DC2626',borderColor:'#FCA5A5'}}>Remove</Btn>)}
        </div>)}
      </div>
    </div>}
  </div>;
}

function CarModalView({card,log,columns,staff,onClose,onMove,note,setNote,onSend,busy,err,onOpenDeal,onRemove}){
  const col=columns.find(c=>c.key===card.column_key)||{label:card.column_key,color:'#6B7280'};
  const chip=(t,bg,fg)=><span style={{fontSize:11,fontWeight:700,background:bg,color:fg,borderRadius:10,padding:'3px 10px'}}>{t}</span>;
  return <Modal title='Car details' onClose={onClose}>
    <div style={{fontSize:16,fontWeight:800,color:'#172B4D',lineHeight:1.4,marginBottom:10,wordBreak:'break-word'}}>{card.title}</div>
    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>{chip(col.label,col.color,'#fff')}{card.inspection?chip('INSPECTION NEEDED','#FEF3C7','#92400E'):chip('NO INSPECTION','#F3F4F6','#374151')}{card.deal_number&&chip('Deal #'+card.deal_number,'#EFF6FF','#1D4ED8')}</div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>{[['VIN',card.vin],['Model',card.model],['Customer',card.customer_last],['Broker',card.broker_name]].map(([l,v])=><div key={l} style={{background:'#F8FAFC',borderRadius:8,padding:'8px 10px'}}><div style={{fontSize:10,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase'}}>{l}</div><div style={{fontSize:13,fontWeight:600,wordBreak:'break-word'}}>{v||'-'}</div></div>)}</div>
    <div style={{fontSize:12,fontWeight:700,color:'#6B7280',textTransform:'uppercase',marginBottom:6}}>Move to</div>
    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>{columns.map(c=><button key={c.key} onClick={()=>onMove(c.key)} disabled={c.key===card.column_key} style={{padding:'7px 12px',borderRadius:8,border:'2px solid '+c.color,background:c.key===card.column_key?c.color:'#fff',color:c.key===card.column_key?'#fff':c.color,fontWeight:700,fontSize:12,cursor:c.key===card.column_key?'default':'pointer'}}>{c.label}</button>)}</div>
    <CarActivity log={log} note={note} setNote={setNote} onSend={onSend} busy={busy} err={err} cardId={card.id}/>
    {staff&&<div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:14,borderTop:'1px solid #E5E7EB',paddingTop:12}}>{card.deal_number&&onOpenDeal&&<Btn size='sm' variant='outline' onClick={()=>onOpenDeal(card.deal_number)}>Open deal #{card.deal_number}</Btn>}{onRemove&&<Btn size='sm' variant='danger' onClick={onRemove}>Remove from board</Btn>}</div>}
  </Modal>;
}
function CarBoard({staff,onOpenDeal,onAuthLost}){
  const[data,setData]=useState({columns:[],cards:[]}),[loading,setLoading]=useState(true),[berr,setBerr]=useState(''),[open,setOpen]=useState(null),[detail,setDetail]=useState(null),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[derr,setDerr]=useState('');
  const load=useCallback(async(quiet)=>{try{const r=await apiFetch('porter?action=board');setData(r);setBerr('');}catch(e){if(/expired|disabled|unauthorized/i.test(e.message)&&onAuthLost){onAuthLost();return;}if(quiet!==true)setBerr(e.message);}finally{setLoading(false);}},[]);
  const loadDetail=useCallback(async(id)=>{try{setDetail(await apiFetch('porter?action=card&id='+id));}catch(e){}},[]);
  useEffect(()=>{load();},[load]);
  useLive(['cards','cars','n'],()=>{load(true);if(open)loadDetail(open.id);});
  function openCard(c){setOpen(c);setDetail(null);setNote('');setDerr('');loadDetail(c.id);}
  async function moveCard(id,to){const was=data.cards.find(c=>c.id===id);if(!was||was.column_key===to)return;setData(d=>({...d,cards:d.cards.map(c=>c.id===id?{...c,column_key:to,moved_at:new Date().toISOString()}:c)}));try{await apiFetch('porter?action=move',{method:'POST',body:{id,to}});if(open&&open.id===id)loadDetail(id);}catch(e){setBerr(e.message);load(true);}}
  async function sendNote(){setBusy(true);setDerr('');try{await apiFetch('porter?action=note',{method:'POST',body:{id:open.id,body:note}});setNote('');await loadDetail(open.id);load(true);}catch(e){setDerr(e.message);}finally{setBusy(false);}}
  async function removeCard(){try{await apiFetch('porter?action=card_archive',{method:'POST',body:{id:open.id}});setOpen(null);load(true);}catch(e){setDerr(e.message);}}
  const shown=open?(data.cards.find(c=>c.id===open.id)||open):null;
  return <div>
    <CarBoardView columns={data.columns} cards={data.cards} onOpen={openCard} onDropCard={moveCard} canDrag loading={loading} error={berr}/>
    {shown&&<CarModalView card={shown} log={detail?detail.log:[]} columns={data.columns} staff={!!staff} onClose={()=>setOpen(null)} onMove={to=>moveCard(shown.id,to)} note={note} setNote={setNote} onSend={sendNote} busy={busy} err={derr} onOpenDeal={onOpenDeal} onRemove={staff?removeCard:null}/>}
  </div>;
}
function PorterPortal({porter,onLogout}){
  useEffect(()=>startLivePulse(async()=>{const r=await apiFetch('porter?action=pulse');return r&&r.sig;}),[]);
  return <div className='navy-root' style={{minHeight:'100vh',background:'linear-gradient(135deg,#0F172A 0%,#1E3A5F 100%)'}}>
    <div className='navy-keep' style={{padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}><div style={{display:'flex',alignItems:'center',gap:12}}><BrooklynMark height={38}/><div><div style={{marginBottom:3}}><BrooklynWordmark height={14}/></div><div style={{color:'#93C5FD',fontSize:12,letterSpacing:'0.05em'}}>GET READY BOARD</div></div></div><div style={{display:'flex',alignItems:'center',gap:12}}><div style={{color:'#fff',fontSize:14,fontWeight:600}}>{porter&&porter.name}</div><ThemeToggle/><Btn variant='outline' size='sm' onClick={onLogout} style={{borderColor:'#334155',color:'#94A3B8'}}>Sign Out</Btn></div></div>
    <div style={{padding:'6px 16px 24px'}}><CarBoard staff={false} onAuthLost={onLogout}/></div>
  </div>;
}
const COLUMNS_SQL=`CREATE TABLE IF NOT EXISTS porter_columns (
  id         SERIAL PRIMARY KEY,
  col_key    TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6B7280',
  sort_order INTEGER NOT NULL DEFAULT 0,
  auto_hide  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE porter_columns ENABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';`;
const COLUMN_COLORS=['#3B82F6','#8B5CF6','#EC4899','#EF4444','#F97316','#F59E0B','#10B981','#14B8A6','#06B6D4','#6B7280'];

// Settings > Get Ready Columns: add, rename, recolour, reorder and remove the columns on the Get Ready board
function ColumnsAdmin({initial}){
  const[d,setD]=useState(initial||null),[cerr,setCerr]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(''),[label,setLabel]=useState(''),[color,setColor]=useState('#6366F1'),[rm,setRm]=useState(null),[moveTo,setMoveTo]=useState('');
  const load=useCallback(async()=>{try{setD(await apiFetch('porter?action=columns'));setCerr('');}catch(e){setCerr(e.message);}},[]);
  useEffect(()=>{if(!initial)load();},[load]);
  async function act(tag,action,payload){setBusy(tag);setCerr('');setNote('');try{const r=await apiFetch('porter?action='+action,{method:'POST',body:payload});setD(r);return true;}catch(e){setCerr(e.message);return false;}finally{setBusy('');}}
  async function addColumn(){const nm=label.trim();const okd=await act('add','column_add',{label:nm,color});if(okd){setNote('Added "'+nm+'" at the end of the board.');setLabel('');}}
  async function removeColumn(){const had=(d.counts||{})[rm.key]||0;const nm=rm.label;const okd=await act('rm','column_remove',{key:rm.key,move_to:moveTo||undefined});if(okd){setNote('Removed "'+nm+'".'+(had>0?' Its cars moved to the column you chose.':''));setRm(null);setMoveTo('');}}
  const card={background:'#fff',borderRadius:14,padding:24,boxShadow:'0 1px 6px rgba(0,0,0,0.07)',marginBottom:20};
  const title=<h3 style={{margin:'0 0 8px',fontSize:16,fontWeight:700}}>Get Ready Columns</h3>;
  if(!d)return <div style={card}>{title}<div style={{color:cerr?'#DC2626':'#9CA3AF',fontSize:14}}>{cerr||'Loading columns...'}</div></div>;
  const off=!!d.setup_needed,cols=d.columns||[],counts=d.counts||{},others=rm?cols.filter(c=>c.key!==rm.key):[],rmCount=rm?(counts[rm.key]||0):0;
  const arrow={border:'1px solid #D1D5DB',background:'#fff',borderRadius:5,width:26,height:20,fontSize:10,lineHeight:1,cursor:'pointer',padding:0,color:'#374151'};
  const dot=(c,sel,onPick,dis)=><button key={c} type='button' title={c} disabled={dis} onClick={onPick} style={{width:18,height:18,borderRadius:'50%',background:c,border:sel?'2px solid #111827':'2px solid #fff',boxShadow:sel?'0 0 0 1px #111827':'0 0 0 1px #E5E7EB',cursor:dis?'not-allowed':'pointer',padding:0}}/>;
  return <div style={card}>
    {title}
    <div style={{fontSize:13,color:'#6B7280',marginBottom:16,lineHeight:1.5}}>These are the columns on the Get Ready board, left to right. New cars start in the <b>first</b> column. Porters and office staff see your changes within a few seconds. Removing a column asks where its cars should go.</div>
    {off&&<div style={{background:'#FEF3C7',color:'#92400E',borderRadius:8,padding:'12px 14px',fontSize:13,marginBottom:14,lineHeight:1.5}}><b>Editing columns needs a one-time database update.</b> Until then the board uses the standard columns. In Supabase, open the SQL Editor, run this, then reload this page:<pre style={{background:'#fff',border:'1px solid #FDE68A',borderRadius:6,padding:10,fontSize:12,overflowX:'auto',margin:'8px 0',color:'#111827'}}>{COLUMNS_SQL}</pre><Btn variant='outline' onClick={()=>{try{navigator.clipboard.writeText(COLUMNS_SQL);setNote('SQL copied.');}catch(e){}}}>Copy SQL</Btn></div>}
    {note&&<div style={{background:'#D1FAE5',color:'#065F46',borderRadius:8,padding:'10px 14px',fontSize:13,fontWeight:600,marginBottom:12}}>{note}</div>}
    {cerr&&!rm&&<div style={{background:'#FEE2E2',color:'#991B1B',borderRadius:8,padding:'10px 14px',fontSize:13,fontWeight:600,marginBottom:12}}>{cerr}</div>}
    {cols.map((c,i)=>{const n=counts[c.key]||0;return <div key={c.key} style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',padding:'10px 12px',marginBottom:8,border:'1.5px solid #E5E7EB',borderLeft:'5px solid '+c.color,borderRadius:10,opacity:off?0.65:1}}>
      <div style={{display:'flex',flexDirection:'column',gap:2}}>
        <button type='button' title='Move earlier on the board' disabled={off||!!busy||i===0} onClick={()=>act('l-'+c.key,'column_move',{key:c.key,direction:'left'})} style={{...arrow,opacity:off||i===0?0.4:1}}>▲</button>
        <button type='button' title='Move later on the board' disabled={off||!!busy||i===cols.length-1} onClick={()=>act('r-'+c.key,'column_move',{key:c.key,direction:'right'})} style={{...arrow,opacity:off||i===cols.length-1?0.4:1}}>▼</button>
      </div>
      <input defaultValue={c.label} key={c.key+':'+c.label} disabled={off||!!busy} maxLength={40} onBlur={e=>{const v=e.target.value.trim();if(v&&v!==c.label)act('n-'+c.key,'column_update',{key:c.key,label:v});else e.target.value=c.label;}} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();}} style={{flex:'1 1 180px',minWidth:140,padding:'8px 10px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:14,fontWeight:600,fontFamily:'inherit'}}/>
      <div style={{display:'flex',gap:5,flexWrap:'wrap',maxWidth:150}}>{COLUMN_COLORS.map(k=>dot(k,k.toLowerCase()===String(c.color).toLowerCase(),()=>act('c-'+c.key,'column_update',{key:c.key,color:k}),off||!!busy))}</div>
      <span style={{fontSize:12,fontWeight:700,background:'#F3F4F6',color:'#4B5563',borderRadius:10,padding:'3px 10px',whiteSpace:'nowrap'}}>{n} {n===1?'car':'cars'} here</span>
      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#4B5563',cursor:'pointer'}}><input type='checkbox' checked={!!c.auto_hide} disabled={off||!!busy} onChange={e=>act('h-'+c.key,'column_update',{key:c.key,auto_hide:e.target.checked})}/>Hide cars after 7 days</label>
      <Btn variant='outline' disabled={off||!!busy||cols.length<=1} onClick={()=>{setRm(c);setMoveTo('');setCerr('');setNote('');}} style={{color:'#DC2626',borderColor:'#FCA5A5'}}>Remove</Btn>
    </div>;})}
    <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginTop:14,paddingTop:14,borderTop:'1px solid #F3F4F6'}}>
      <input value={label} onChange={e=>setLabel(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&label.trim()&&!off)addColumn();}} disabled={off} maxLength={40} placeholder='New column name, e.g. Detail Shop' style={{flex:'1 1 220px',minWidth:160,padding:'9px 12px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:14,fontFamily:'inherit'}}/>
      <div style={{display:'flex',gap:5,flexWrap:'wrap',maxWidth:150}}>{COLUMN_COLORS.map(k=>dot(k,k===color,()=>setColor(k),off))}</div>
      <Btn onClick={addColumn} loading={busy==='add'} disabled={off||!label.trim()}>+ Add column</Btn>
    </div>
    <div style={{fontSize:12,color:'#9CA3AF',marginTop:10}}>Up to 12 columns. The new column goes at the end; use the arrows to move it. "Hide cars after 7 days" suits a finished column such as Delivered: cars leave the board a week after arriving there but stay in the deal's history.</div>
    {rm&&<Modal title={'Remove "'+rm.label+'"?'} onClose={()=>setRm(null)}>
      {rmCount>0?<><div style={{fontSize:14,color:'#374151',marginBottom:12,lineHeight:1.5}}><b>{rmCount} {rmCount===1?'car is':'cars are'}</b> in this column. Choose where {rmCount===1?'it':'they'} should go:</div><select value={moveTo} onChange={e=>setMoveTo(e.target.value)} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:14,marginBottom:16,fontFamily:'inherit'}}><option value=''>Choose a column...</option>{others.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}</select></>:<div style={{fontSize:14,color:'#374151',marginBottom:16,lineHeight:1.5}}>No cars are in this column right now. It will simply be removed from the board.</div>}
      {cerr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:12}}>{cerr}</div>}
      <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}><Btn variant='outline' onClick={()=>setRm(null)}>Cancel</Btn><Btn onClick={removeColumn} loading={busy==='rm'} disabled={rmCount>0&&!moveTo}>Remove column</Btn></div>
    </Modal>}
  </div>;
}

function PortersAdmin({initial}){
  const blank={name:'',username:'',password:'',email:''};
  const[list,setList]=useState(initial||null),[perr,setPerr]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(''),[adding,setAdding]=useState(false),[form,setForm]=useState(blank),[ferr,setFerr]=useState(''),[reset,setReset]=useState(null),[pw,setPw]=useState(''),[rm,setRm]=useState(null),[em,setEm]=useState(null),[emv,setEmv]=useState('');
  const load=useCallback(async()=>{try{const r=await apiFetch('porter?action=porters');setList(r.porters);setPerr('');}catch(e){setPerr(e.message);}},[]);
  useEffect(()=>{load();},[load]);
  async function run(tag,action,payload){setBusy(tag);setFerr('');setNote('');try{await apiFetch('porter?action='+action,{method:'POST',body:payload});await load();return true;}catch(e){setFerr(e.message);return false;}finally{setBusy('');}}
  async function addPorter(){const okd=await run('add','porter_add',form);if(okd){setAdding(false);setForm(blank);setNote('Porter added. Give them their username and password.');}}
  async function toggle(p){const okd=await run('t-'+p.id,'porter_update',{id:p.id,active:!p.active});if(okd)setNote(p.active?p.name+' is disabled and was signed out.':p.name+' can sign in again.');}
  async function doReset(){const okd=await run('pw','porter_update',{id:reset.id,new_password:pw});if(okd){setNote('New password set for '+reset.name+'. They were signed out.');setReset(null);setPw('');}}
  async function saveEmail(){const v=emv.trim();const okd=await run('em','porter_update',{id:em.id,email:v});if(okd){setNote(v?'Email saved for '+em.name+'. They can now use Forgot password on the Porter Login form.':'Email removed for '+em.name+'.');setEm(null);}}
  async function doRemove(){const okd=await run('rm','porter_remove',{id:rm.id});if(okd){setNote(rm.name+' was removed.');setRm(null);}}
  const chip=(t,bg,fg)=><span style={{fontSize:11,fontWeight:700,background:bg,color:fg,borderRadius:10,padding:'2px 9px'}}>{t}</span>;
  const fmtDay=t=>t?new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'never';
  const row={background:'#fff',borderRadius:12,padding:'14px 16px',marginBottom:10,boxShadow:'0 1px 6px rgba(0,0,0,0.07)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'};
  if(!list)return <div style={{padding:24,color:perr?'#DC2626':'#9CA3AF',fontSize:14}}>{perr||'Loading porters...'}</div>;
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:6}}><h3 style={{margin:0,fontSize:18,fontWeight:700}}>Porters</h3><Btn onClick={()=>{setAdding(true);setFerr('');setNote('');}}>+ Add porter</Btn></div>
    <div style={{fontSize:13,color:'#6B7280',marginBottom:16,lineHeight:1.5}}>Porters sign in on the same page as everyone else, using the <b>Porter Login</b> tab. They only see the Get Ready board: cars, notes and where each one is. They never see customers, credit applications or money. <b>Disable</b> a porter to block their sign in without deleting them.</div>
    {note&&<div style={{background:'#D1FAE5',color:'#065F46',borderRadius:8,padding:'10px 14px',fontSize:13,fontWeight:600,marginBottom:12}}>{note}</div>}
    {(perr||(ferr&&!adding&&!reset&&!rm&&!em))&&<div style={{background:'#FEE2E2',color:'#991B1B',borderRadius:8,padding:'10px 14px',fontSize:13,fontWeight:600,marginBottom:12}}>{perr||ferr}</div>}
    {list.length===0&&<div style={{background:'#F8FAFC',border:'1.5px dashed #CBD5E1',borderRadius:12,padding:24,textAlign:'center',color:'#64748B',fontSize:14}}>No porters yet. Click <b>+ Add porter</b> to create the first login.</div>}
    {list.map(p=><div key={p.id} style={{...row,opacity:p.active?1:0.8,borderLeft:'4px solid '+(p.active?'#10B981':'#9CA3AF')}}>
      <div><div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><span style={{fontWeight:700,fontSize:15}}>{p.name}</span>{p.active?chip('Active','#D1FAE5','#065F46'):chip('Disabled','#F3F4F6','#4B5563')}</div><div style={{fontSize:12,color:'#6B7280',marginTop:3}}>{p.username}{' \u00b7 last sign in '}{fmtDay(p.last_login_at)}</div><div style={{fontSize:12,color:p.email?'#6B7280':'#B45309',marginTop:2}}>{p.email?p.email:'No email: cannot reset their own password'}</div></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Btn size='sm' variant={p.active?'outline':'success'} onClick={()=>toggle(p)} loading={busy==='t-'+p.id}>{p.active?'Disable':'Enable'}</Btn><Btn size='sm' variant='outline' onClick={()=>{setEm(p);setEmv(p.email||'');setFerr('');}}>Email</Btn><Btn size='sm' variant='outline' onClick={()=>{setReset(p);setPw('');setFerr('');}}>Reset password</Btn><Btn size='sm' variant='danger' onClick={()=>{setRm(p);setFerr('');}}>Remove</Btn></div>
    </div>)}
    {adding&&<Modal title='Add porter' onClose={()=>setAdding(false)}>
      <div style={{display:'flex',gap:16,flexWrap:'wrap'}}><Inp half label='Full name *' value={form.name} onChange={v=>setForm(p=>({...p,name:v}))}/><Inp half label='Username *' value={form.username} onChange={v=>setForm(p=>({...p,username:v}))} placeholder='mike'/><Inp half label='Password * (8 or more characters)' value={form.password} onChange={v=>setForm(p=>({...p,password:v}))} type='password'/><Inp half label='Email (so they can reset their own password)' value={form.email} onChange={v=>setForm(p=>({...p,email:v}))} type='email' placeholder='mike@example.com'/></div>
      {ferr&&<div style={{color:'#DC2626',fontSize:13,margin:'8px 0'}}>{ferr}</div>}
      <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}><Btn onClick={addPorter} loading={busy==='add'} disabled={!form.name.trim()||!form.username.trim()||form.password.length<8}>Add porter</Btn></div>
    </Modal>}
    {em&&<Modal title={'Email for '+em.name} onClose={()=>setEm(null)}>
      <Inp label='Email address' value={emv} onChange={setEmv} type='email' placeholder='mike@example.com'/>
      <div style={{fontSize:12,color:'#6B7280',margin:'0 0 12px'}}>With an email on file, this porter can use <b>Forgot password?</b> on the Porter Login form and reset it themselves. Leave it empty to remove the email.</div>
      {ferr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:8}}>{ferr}</div>}
      <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}><Btn variant='outline' onClick={()=>setEm(null)}>Cancel</Btn><Btn onClick={saveEmail} loading={busy==='em'}>Save email</Btn></div>
    </Modal>}
    {reset&&<Modal title={'Reset password for '+reset.name} onClose={()=>setReset(null)}>
      <Inp label='New password (8 or more characters)' value={pw} onChange={setPw} type='password'/>
      <div style={{fontSize:12,color:'#6B7280',margin:'0 0 12px'}}>They will be signed out and need the new password to sign in again.</div>
      {ferr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{ferr}</div>}
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><Btn variant='outline' onClick={()=>setReset(null)}>Cancel</Btn><Btn onClick={doReset} loading={busy==='pw'} disabled={pw.length<8}>Set password</Btn></div>
    </Modal>}
    {rm&&<Modal title={'Remove '+rm.name+'?'} onClose={()=>setRm(null)}>
      <div style={{fontSize:14,lineHeight:1.6,marginBottom:14}}>{rm.name} will be signed out and can no longer sign in. Notes they wrote stay on the cars. To pause them instead, use <b>Disable</b>.</div>
      {ferr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{ferr}</div>}
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><Btn variant='outline' onClick={()=>setRm(null)}>Cancel</Btn><Btn variant='danger' onClick={doRemove} loading={busy==='rm'}>Remove {rm.name}</Btn></div>
    </Modal>}
  </div>;
}

// Get Ready > + Add car: pick from inventory, from approved deals, or type the car in
function AddCarModal({onClose,onAdded,initial,initialTab}){
  const[tab,setTab]=useState(initialTab||'inventory'),[data,setData]=useState(initial||null),[lerr,setLerr]=useState(''),[q,setQ]=useState(''),[sel,setSel]=useState(null),[insp,setInsp]=useState(false),[busy,setBusy]=useState(false),[aerr,setAerr]=useState(''),[man,setMan]=useState({vin:'',model:'',customer_last:'',broker_name:''});
  useEffect(()=>{if(initial)return;let live=true;(async()=>{try{const r=await apiFetch('porter?action=candidates');if(live)setData(r);}catch(e){if(live)setLerr(e.message);}})();return()=>{live=false;};},[]);
  const ql=q.trim().toLowerCase();
  const hit=(...f)=>!ql||f.some(x=>String(x||'').toLowerCase().includes(ql));
  const deals=((data&&data.deals)||[]).filter(d=>hit(d.deal_number,d.customer_name,d.vin,d.vehicle,d.broker));
  const inv=((data&&data.inventory)||[]).filter(v=>hit(v.vin,v.stock_num,v.name,v.color));
  const pick=t=>{setTab(t);setSel(null);setQ('');setAerr('');};
  const pill=(k,l)=><button key={k} type='button' onClick={()=>pick(k)} style={{padding:'8px 16px',borderRadius:20,border:'2px solid '+(tab===k?'#1D4ED8':'#E5E7EB'),background:tab===k?'#1D4ED8':'#fff',color:tab===k?'#fff':'#374151',fontWeight:700,fontSize:13,cursor:'pointer'}}>{l}</button>;
  const mk=(vin,model,last,broker)=>[vin,model,last,broker,insp?'INSPECTION NEEDED':'NO INSPECTION'].filter(Boolean).join(' - ');
  const preview=tab==='deals'&&sel?mk(sel.vin,sel.vehicle,carLast(sel.customer_name),sel.broker):tab==='inventory'&&sel?mk(sel.vin,sel.name,'',''):tab==='manual'&&(man.vin.trim()||man.model.trim())?mk(man.vin.trim().toUpperCase(),man.model.trim(),man.customer_last.trim(),man.broker_name.trim()):'';
  const canAdd=tab==='manual'?!!(man.vin.trim()||man.model.trim()):!!sel&&!sel.on_board;
  async function add(){setBusy(true);setAerr('');try{const body=tab==='deals'?{deal_number:sel.deal_number,inspection:insp}:tab==='inventory'?{vin:sel.vin,model:sel.name,source:'inventory',inspection:insp}:{vin:man.vin,model:man.model,customer_last:man.customer_last,broker_name:man.broker_name,source:'typed in',inspection:insp};const r=await apiFetch('porter?action=card_add',{method:'POST',body});if(r&&r.exists){setAerr('That car is already on the board.');setBusy(false);return;}onAdded(r);}catch(e){setAerr(e.message);setBusy(false);}}
  const chip=(t,bg,fg)=><span style={{fontSize:11,fontWeight:700,background:bg,color:fg,borderRadius:10,padding:'2px 9px',whiteSpace:'nowrap'}}>{t}</span>;
  const row=(key,selected,disabled,main,sub,right,onClick)=><div key={key} onClick={disabled?undefined:onClick} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:'10px 12px',border:'1.5px solid '+(selected?'#1D4ED8':'#E5E7EB'),background:selected?'#EFF6FF':disabled?'#F9FAFB':'#fff',borderRadius:10,marginBottom:6,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.6:1}}><div style={{minWidth:0}}><div style={{fontSize:14,fontWeight:700,color:'#111827'}}>{main}</div><div style={{fontSize:12,color:'#6B7280',marginTop:2}}>{sub}</div></div><div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>{right}</div></div>;
  const listBox={maxHeight:300,overflowY:'auto',marginBottom:12};
  const empty=t=><div style={{background:'#F8FAFC',border:'1.5px dashed #CBD5E1',borderRadius:12,padding:20,textAlign:'center',color:'#64748B',fontSize:14}}>{t}</div>;
  const search=<input value={q} onChange={e=>setQ(e.target.value)} placeholder={tab==='deals'?'Search deal number, customer, VIN, vehicle or broker':'Search VIN, stock number, vehicle or colour'} style={{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:14,marginBottom:10,fontFamily:'inherit'}}/>;
  return <Modal title='Add a car to Get Ready' wide onClose={onClose}>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>{pill('inventory','From Inventory')}{pill('deals','From Approved Deals')}{pill('manual','Enter Manually')}</div>
    {tab!=='manual'&&!data&&<div style={{color:lerr?'#DC2626':'#9CA3AF',fontSize:14,padding:'12px 0'}}>{lerr||'Loading cars...'}</div>}
    {tab==='inventory'&&data&&<>{search}<div style={listBox}>{inv.length===0?empty(ql?'No inventory matches your search.':'No inventory loaded yet.'):inv.map(v=>row(v.vin+v.stock_num,sel&&sel.vin===v.vin,v.on_board,v.name||'Vehicle',(v.vin||'no VIN')+(v.stock_num?' · Stock '+v.stock_num:'')+(v.color?' · '+v.color:''),v.on_board&&chip('On the board','#E5E7EB','#4B5563'),()=>setSel(v)))}</div></>}
    {tab==='deals'&&data&&<>{search}<div style={listBox}>{deals.length===0?empty(ql?'No deals match your search.':'No approved deals are waiting.'):deals.map(d=>row(d.deal_number,sel&&sel.deal_number===d.deal_number,d.on_board,'#'+d.deal_number+' · '+(d.customer_name||'No name')+' · '+(d.vehicle||'No vehicle'),(d.vin||'no VIN')+(d.broker?' · '+d.broker:''),<>{chip(d.status,'#EDE9FE','#5B21B6')}{d.on_board&&chip('On the board','#E5E7EB','#4B5563')}</>,()=>setSel(d)))}</div></>}
    {tab==='manual'&&<div style={{display:'flex',gap:16,flexWrap:'wrap'}}><Inp half label='VIN' value={man.vin} onChange={v=>setMan(p=>({...p,vin:v}))}/><Inp half label='Vehicle (year, make, model)' value={man.model} onChange={v=>setMan(p=>({...p,model:v}))}/><Inp half label='Customer last name (optional)' value={man.customer_last} onChange={v=>setMan(p=>({...p,customer_last:v}))}/><Inp half label='Broker (optional)' value={man.broker_name} onChange={v=>setMan(p=>({...p,broker_name:v}))}/></div>}
    <label style={{display:'flex',alignItems:'center',gap:8,fontSize:14,fontWeight:600,margin:'4px 0 10px',cursor:'pointer'}}><input type='checkbox' checked={insp} onChange={e=>setInsp(e.target.checked)} style={{width:16,height:16}}/>Needs state inspection</label>
    {preview&&<div style={{background:'#F3F4F6',borderRadius:8,padding:'10px 12px',fontSize:13,marginBottom:12}}><div style={{fontSize:11,fontWeight:700,color:'#6B7280',textTransform:'uppercase',marginBottom:3}}>Card title</div><div style={{fontWeight:700,color:'#111827',wordBreak:'break-word'}}>{preview}</div></div>}
    {aerr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{aerr}</div>}
    <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}><Btn variant='outline' onClick={onClose}>Cancel</Btn><Btn onClick={add} loading={busy} disabled={!canAdd}>Add to Get Ready</Btn></div>
  </Modal>;
}
function GetReadyAdmin({onOpenDeal}){
  const[sub,setSub]=useState('board'),[adding,setAdding]=useState(false),[bump,setBump]=useState(0),[flash,setFlash]=useState('');
  const pill=(k,l)=><button onClick={()=>setSub(k)} style={{padding:'8px 18px',borderRadius:20,border:'2px solid '+(sub===k?'#1D4ED8':'#E5E7EB'),background:sub===k?'#1D4ED8':'#fff',color:sub===k?'#fff':'#374151',fontWeight:700,fontSize:13,cursor:'pointer'}}>{l}</button>;
  return <div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:16}}><h2 style={{margin:0,fontSize:22,fontWeight:800}}>Get Ready</h2><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>{sub==='board'&&<Btn onClick={()=>{setAdding(true);setFlash('');}}>+ Add car</Btn>}{pill('board','Board')}{pill('porters','Porters')}</div></div>{flash&&<div style={{background:'#D1FAE5',color:'#065F46',borderRadius:8,padding:'10px 14px',fontSize:13,fontWeight:600,marginBottom:12}}>{flash}</div>}{sub==='board'?<CarBoard key={bump} staff onOpenDeal={onOpenDeal}/>:<PortersAdmin/>}{adding&&<AddCarModal onClose={()=>setAdding(false)} onAdded={r=>{setAdding(false);setBump(b=>b+1);setFlash('Added to Get Ready: '+((r&&r.card&&r.card.title)||'the car'));}}/>}</div>;
}

function CarStatusTab({deal}){
  const[d,setD]=useState(null),[cerr,setCerr]=useState(''),[insp,setInsp]=useState(false),[busy,setBusy]=useState(false),[note,setNote]=useState(''),[nbusy,setNbusy]=useState(false),[nerr,setNerr]=useState('');
  const load=useCallback(async()=>{try{setD(await apiFetch('porter?action=deal_card&deal_number='+encodeURIComponent(deal.deal_number)));setCerr('');}catch(e){setCerr(e.message);}},[deal.deal_number]);
  useEffect(()=>{load();},[load]);
  useLive(['cars','events'],()=>{load();});
  async function add(){setBusy(true);setCerr('');try{await apiFetch('porter?action=card_add',{method:'POST',body:{deal_number:deal.deal_number,inspection:insp}});await load();}catch(e){setCerr(e.message);}finally{setBusy(false);}}
  async function move(to){try{await apiFetch('porter?action=move',{method:'POST',body:{id:d.card.id,to}});await load();}catch(e){setCerr(e.message);}}
  async function send(){setNbusy(true);setNerr('');try{await apiFetch('porter?action=note',{method:'POST',body:{id:d.card.id,body:note}});setNote('');await load();}catch(e){setNerr(e.message);}finally{setNbusy(false);}}
  async function remove(){try{await apiFetch('porter?action=card_archive',{method:'POST',body:{id:d.card.id}});await load();}catch(e){setCerr(e.message);}}
  const box={background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:12,padding:16,marginBottom:14};
  if(!d)return <div style={{padding:24,color:cerr?'#DC2626':'#9CA3AF',fontSize:14}}>{cerr||'Loading car status...'}</div>;
  const cols=d.columns||[],c=d.card;
  if(!c)return <div style={box}>
    <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>This car is not on the Get Ready board</div>
    <div style={{fontSize:13,color:'#6B7280',marginBottom:12,lineHeight:1.5}}>Add it so the porters can get it ready. It appears in the first column.</div>
    <label style={{display:'flex',alignItems:'center',gap:8,fontSize:14,fontWeight:600,marginBottom:10,cursor:'pointer'}}><input type='checkbox' checked={insp} onChange={e=>setInsp(e.target.checked)}/>Needs state inspection</label>
    <div style={{background:'#F8FAFC',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#475569',marginBottom:12,wordBreak:'break-word'}}>{carTitle({vin:deal.vin,model:deal.vehicle_desc,last:carLast(deal.customer_name),broker:deal.broker_name,inspection:insp})}</div>
    {cerr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{cerr}</div>}
    <Btn onClick={add} loading={busy}>Add to Get Ready</Btn>
  </div>;
  const idx=cols.findIndex(x=>x.key===c.column_key),cur=cols[idx]||{label:c.column_key,color:'#6B7280'};
  return <div>
    <div style={box}>
      <div style={{fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',marginBottom:6}}>Where the car is now</div>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:10}}><span style={{fontSize:16,fontWeight:800,background:cur.color,color:'#fff',borderRadius:10,padding:'4px 14px'}}>{cur.label}</span><span style={{fontSize:12,color:'#6B7280'}}>{c.moved_by?'moved by '+c.moved_by+' \u00b7 ':''}{carAgo(c.moved_at)}{' in this column'}</span></div>
      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:12}}>{cols.map((x,i)=><div key={x.key} style={{flex:'1 1 90px',minWidth:80,textAlign:'center'}}><div style={{height:6,borderRadius:3,background:i<=idx?x.color:'#E5E7EB'}}/><div style={{fontSize:10,marginTop:4,fontWeight:i===idx?800:500,color:i===idx?'#111827':'#9CA3AF'}}>{x.label}</div></div>)}</div>
      <div style={{fontSize:12,color:'#475569',wordBreak:'break-word'}}>{c.title}</div>
    </div>
    <div style={box}>
      <div style={{fontSize:12,fontWeight:700,color:'#6B7280',textTransform:'uppercase',marginBottom:6}}>Move to</div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{cols.map(x=><button key={x.key} onClick={()=>move(x.key)} disabled={x.key===c.column_key} style={{padding:'7px 12px',borderRadius:8,border:'2px solid '+x.color,background:x.key===c.column_key?x.color:'#fff',color:x.key===c.column_key?'#fff':x.color,fontWeight:700,fontSize:12,cursor:x.key===c.column_key?'default':'pointer'}}>{x.label}</button>)}</div>
    </div>
    <div style={box}><CarActivity log={d.log||[]} note={note} setNote={setNote} onSend={send} busy={nbusy} err={nerr} cardId={d.card&&d.card.id}/></div>
    {cerr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{cerr}</div>}
    <button onClick={remove} style={{background:'none',border:'none',color:'#6B7280',fontSize:12,textDecoration:'underline',cursor:'pointer',padding:0}}>Remove this car from the board</button>
  </div>;
}
function GetReadyPrompt({deal,inspection,setInspection,onClose,onChoose}){
  return <Modal title='Add this car to Get Ready?' onClose={onClose}>
    <div style={{fontSize:14,color:'#374151',lineHeight:1.6,marginBottom:12}}>Putting the car on the Get Ready board lets the porters prepare it for delivery. It starts in the first column of the board.</div>
    <label style={{display:'flex',alignItems:'center',gap:10,fontSize:15,fontWeight:700,marginBottom:12,cursor:'pointer',background:'#FFFBEB',border:'1.5px solid #FCD34D',borderRadius:10,padding:'10px 14px'}}><input type='checkbox' checked={inspection} onChange={e=>setInspection(e.target.checked)} style={{width:18,height:18}}/>Needs state inspection</label>
    <div style={{fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',marginBottom:4}}>The card will read</div>
    <div style={{background:'#F8FAFC',border:'1px solid #E5E7EB',borderRadius:8,padding:'10px 12px',fontSize:13,fontWeight:600,color:'#172B4D',marginBottom:16,wordBreak:'break-word'}}>{carTitle({vin:deal.vin,model:deal.vehicle_desc,last:carLast(deal.customer_name),broker:deal.broker_name,inspection})}</div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'flex-end'}}><Btn variant='ghost' onClick={onClose}>Cancel</Btn><Btn variant='outline' onClick={()=>onChoose(false)}>No, just approve</Btn><Btn variant='success' onClick={()=>onChoose(true)}>Yes, add to Get Ready</Btn></div>
  </Modal>;
}
function NotesPanel({dealNumber,isStaff}){
  const[notes,setNotes]=useState(null),[text,setText]=useState(''),[busy,setBusy]=useState(false),[nerr,setNerr]=useState('');
  const load=useCallback(async()=>{try{setNotes(await apiFetch('notes?deal_number='+encodeURIComponent(dealNumber)));setNerr('');if(isStaff){apiFetch('notes?action=seen',{method:'POST',body:{deal_number:dealNumber}}).then(()=>window.dispatchEvent(new Event('notes-seen'))).catch(()=>{});}}catch(e){setNerr(e.message);}},[dealNumber,isStaff]);
  useEffect(()=>{load();},[load]);
  useLive(['events'],()=>{load();});
  async function add(){if(!text.trim())return;setBusy(true);try{await apiFetch('notes',{method:'POST',body:{deal_number:dealNumber,body:text}});setText('');await load();}catch(e){setNerr(e.message);}finally{setBusy(false);}}
  const fmt=t=>new Date(t).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  return <div style={{background:'#FFFBEB',border:'1.5px solid #FDE68A',borderRadius:12,padding:20,marginBottom:20}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,gap:8,flexWrap:'wrap'}}><div style={{fontSize:11,fontWeight:700,color:'#92400E',textTransform:'uppercase'}}>Notes</div><span style={{fontSize:10,fontWeight:700,background:'#92400E',color:'#fff',borderRadius:8,padding:'2px 8px'}}>🔒 INTERNAL - STAFF ONLY</span></div>
    {nerr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:8}}>{nerr}</div>}
    {notes&&notes.length===0&&<div style={{color:'#9CA3AF',fontSize:13,marginBottom:10}}>No notes yet.</div>}
    <div style={{maxHeight:260,overflowY:'auto',marginBottom:12}}>{(notes||[]).map(n=>{const fromBroker=n.author_role==='broker';return <div key={n.id} style={{background:fromBroker?'#EFF6FF':'#fff',border:'1px solid '+(fromBroker?'#BFDBFE':'#E5E7EB'),borderLeft:fromBroker?'4px solid #3B82F6':'1px solid #E5E7EB',borderRadius:10,padding:'10px 12px',marginBottom:8}}><div style={{fontSize:12,color:'#6B7280',marginBottom:4}}><b style={{color:fromBroker?'#1D4ED8':'#065F46'}}>{n.author_name||(fromBroker?'Broker':'Team')}</b> · {fmt(n.created_at)}</div><div style={{fontSize:14,color:'#111827',whiteSpace:'pre-wrap'}}>{n.body}</div>{fromBroker&&<div style={{fontSize:11,fontStyle:'italic',color:'#1D4ED8',marginTop:6}}>Notes on request (from broker)</div>}</div>;})}</div>
    <textarea value={text} onChange={e=>setText(e.target.value)} rows={2} maxLength={2000} placeholder='Add an internal note (the broker cannot see this)...' style={{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:14,fontFamily:'inherit',resize:'vertical'}}/>
    <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}><Btn size='sm' onClick={add} loading={busy} disabled={!text.trim()}>Add note</Btn></div>
  </div>;
}
function NotificationsBell({onOpenDeal}){
  const[data,setData]=useState({count:0,items:[],setup_needed:false}),[open,setOpen]=useState(false);
  const refresh=useCallback(async()=>{try{const r=await apiFetch('notifications');if(r&&Array.isArray(r.items))setData(r);}catch(e){}},[]);
  useEffect(()=>{refresh();const t=setInterval(refresh,60000);const h=()=>refresh();window.addEventListener('notes-seen',h);return()=>{clearInterval(t);window.removeEventListener('notes-seen',h);};},[refresh]);
  useLive(['notifs','events'],()=>{refresh();});
  const has=data.count>0;
  const ago=t=>{const m=Math.max(0,Math.round((Date.now()-new Date(t).getTime())/60000));return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' hr ago':Math.round(m/1440)+' d ago';};
  const icons={new_request:'🚗',credit_app:'📄',assigned:'👤',reassigned:'🔁',docs_uploaded:'📎',docs_complete:'✅',note:'📝',porter_note:'🧰'};
  function openItem(it){setOpen(false);if(it.kind==='event'&&it.unread){apiFetch('notifications?action=read',{method:'POST',body:{id:it.id}}).then(refresh).catch(()=>{});}if(it.deal)onOpenDeal(it.deal,it.type);}
  function markAll(){apiFetch('notifications?action=read',{method:'POST',body:{all:true}}).then(refresh).catch(()=>{});}
  return <div style={{position:'relative'}}>
    <style>{'@keyframes bellShake{0%,100%{transform:rotate(0)}15%{transform:rotate(14deg)}30%{transform:rotate(-12deg)}45%{transform:rotate(9deg)}60%{transform:rotate(-6deg)}75%{transform:rotate(3deg)}}@keyframes badgePulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.7)}50%{box-shadow:0 0 0 7px rgba(239,68,68,0)}}'}</style>
    <button onClick={()=>setOpen(o=>!o)} title={has?data.count+' new notification'+(data.count>1?'s':''):'No new notifications'} style={{background:'none',border:'none',cursor:'pointer',fontSize:22,position:'relative',padding:'4px 8px',animation:has?'bellShake 1.6s ease-in-out infinite':'none',transformOrigin:'50% 10%'}}>🔔{has&&<span style={{position:'absolute',top:-2,right:0,background:'#EF4444',color:'#fff',borderRadius:10,fontSize:11,fontWeight:800,padding:'1px 6px',animation:'badgePulse 1.4s infinite'}}>{data.count}</span>}</button>
    {open&&<><div onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,zIndex:2999}}/><div style={{position:'absolute',right:0,top:42,width:360,maxWidth:'calc(100vw - 24px)',maxHeight:460,overflowY:'auto',background:'#fff',borderRadius:12,boxShadow:'0 12px 40px rgba(0,0,0,.3)',zIndex:3000,border:'1px solid #E5E7EB'}}>
      <div style={{padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #F3F4F6'}}><span style={{fontWeight:700,fontSize:13,color:'#111827'}}>Notifications</span>{has&&<button onClick={markAll} style={{background:'none',border:'none',color:'#1D4ED8',fontSize:12,fontWeight:600,cursor:'pointer'}}>Mark all read</button>}</div>
      {data.setup_needed&&<div style={{padding:'8px 14px',fontSize:11,background:'#FEF3C7',color:'#92400E'}}>One-time database update needed to show request and credit app alerts.</div>}
      {data.items.length===0&&<div style={{padding:24,color:'#9CA3AF',fontSize:13,textAlign:'center'}}>You are all caught up.</div>}
      {data.items.map(it=><div key={it.kind+it.id} onClick={()=>openItem(it)} style={{padding:'10px 14px',borderBottom:'1px solid #F3F4F6',cursor:'pointer',display:'flex',gap:10,background:it.unread?'#EFF6FF':'#fff',opacity:it.unread?1:.7}}>
        <div style={{fontSize:20,lineHeight:'24px'}}>{icons[it.type]||'🔔'}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:'#111827'}}>{it.title}</div>
          <div style={{fontSize:12,color:'#374151',marginTop:1}}>{it.body}</div>
          <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{it.deal_number?'#'+it.deal_number+' · ':''}{ago(it.created_at)}</div>
        </div>
        {it.unread&&<span style={{width:8,height:8,borderRadius:4,background:'#2563EB',marginTop:8}}/>}
      </div>)}
    </div></>}
  </div>;
}
function LogTab({dealNumber}){
  const[rows,setRows]=useState(null),[lerr,setLerr]=useState('');
  const load=useCallback(()=>{apiFetch('deals?action=events&deal_number='+encodeURIComponent(dealNumber)).then(r=>{setRows(r);setLerr('');}).catch(e=>setLerr(e.message));},[dealNumber]);
  useEffect(()=>{load();},[load]);
  useLive(['events'],()=>{load();});
  const meta={requested:['🚗','requested the car'],credit_app_submitted:['📄','submitted the credit application'],status_changed:['🔄','changed the status'],vehicle_confirmed:['✅','confirmed the car is available'],vehicle_unconfirmed:['↩️','removed the availability confirmation'],assigned:['👤','claimed the deal'],reassigned:['🔁','reassigned the deal'],docs_requested:['📋','requested documents'],docs_cancelled:['❌','cancelled a document request'],doc_uploaded:['📎','uploaded a document'],doc_removed:['🗑️','removed a document'],doc_viewed:['👁️','opened a document'],viewed_credit_app:['👁️','viewed the credit application'],downloaded_credit_pdf:['⬇️','downloaded the credit application PDF'],viewed_customer_id:['🆔','opened the customer ID'],note_added:['📝','added an internal note'],doc_accepted:['✅','accepted a document'],doc_rejected:['⛔','rejected a document'],docs_zip:['📦','downloaded all documents as a ZIP'],payout_recorded:['💵','recorded the payout'],payout_edited:['✏️','edited the payout'],check_paid:['✅','marked the check paid'],check_unpaid:['↩️','marked the check unpaid'],car_added:['🧰','added the car to Get Ready'],car_moved:['🚗','moved the car'],car_note:['💬','left a car note'],car_file:['📎','added an inspection file'],car_file_removed:['🗑️','removed an inspection file'],invoice_added:['📎','attached the invoice'],invoice_removed:['🗑️','removed the invoice'],car_removed:['🗑️','removed the car from the board']};
  const fmt=t=>new Date(t).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
  const roleChip={admin:['Staff','#DBEAFE','#1E40AF'],broker:['Broker','#D1FAE5','#065F46'],system:['System','#F3F4F6','#374151']};
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div style={{fontSize:12,color:'#6B7280'}}>Who did what on this deal, newest first.</div><button onClick={load} style={{background:'none',border:'none',color:'#1D4ED8',fontWeight:600,fontSize:12,cursor:'pointer'}}>Refresh</button></div>
    {lerr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{lerr}</div>}
    {!rows&&!lerr&&<div style={{color:'#9CA3AF',fontSize:13}}>Loading...</div>}
    {rows&&rows.length===0&&<div style={{background:'#F8FAFC',borderRadius:12,padding:16,fontSize:13,color:'#6B7280'}}>No activity recorded yet. From now on, every action on this deal is logged here with who did it and when.</div>}
    {rows&&rows.map(e=>{const m=meta[e.action]||['•',String(e.action).replace(/_/g,' ')];const rc=roleChip[e.actor_role]||roleChip.system;return <div key={e.id} style={{display:'flex',gap:12,padding:'10px 0',borderBottom:'1px solid #F3F4F6'}}>
      <div style={{fontSize:18,width:26,textAlign:'center'}}>{m[0]}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,color:'#111827'}}><b>{e.actor_name||'Someone'}</b><span style={{marginLeft:6,background:rc[1],color:rc[2],borderRadius:8,padding:'1px 7px',fontSize:10,fontWeight:700}}>{rc[0]}</span> {m[1]}</div>
        {e.detail&&<div style={{fontSize:13,color:'#6B7280',marginTop:2,wordBreak:'break-word'}}>{e.detail}</div>}
      </div>
      <div style={{fontSize:11,color:'#9CA3AF',whiteSpace:'nowrap'}}>{fmt(e.created_at)}</div>
    </div>;})}
  </div>;
}
function CreditTab({dealNumber}){
  const[info,setInfo]=useState(null),[cerr,setCerr]=useState('');
  const token=localStorage.getItem('auth_token')||'';
  useEffect(()=>{let live=true;apiFetch('myapp?deal_number='+encodeURIComponent(dealNumber)).then(r=>{if(live)setInfo(r);}).catch(e=>{if(live)setCerr(e.message);});return()=>{live=false;};},[dealNumber]);
  const box={background:'#F8FAFC',borderRadius:12,padding:16};
  const lbl={fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',marginBottom:4};
  const when=t=>t?new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
  const q='&deal_number='+encodeURIComponent(dealNumber)+'&_t='+encodeURIComponent(token);
  return <div>
    {cerr&&<div style={{color:'#DC2626',fontSize:13,marginBottom:10}}>{cerr}</div>}
    {!info&&!cerr&&<div style={{color:'#9CA3AF',fontSize:13}}>Loading...</div>}
    {info&&!info.has_app&&<div style={box}>No credit application has been submitted for this deal yet.</div>}
    {info&&info.has_app&&<>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10,marginBottom:6}}>
        <div style={{fontSize:13,color:'#6B7280'}}>{info.app_type_label} application{info.submitted_at?' · submitted '+when(info.submitted_at):''}</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {info.has_id_file&&<a href={'/api/deals?action=id_file'+q} target='_blank' rel='noreferrer' style={{textDecoration:'none'}}><Btn variant='outline'>🆔 View Customer ID</Btn></a>}
          <a href={'/api/myapp?action=pdf'+q} download style={{textDecoration:'none'}}><Btn variant='primary'>⬇ Download PDF</Btn></a>
        </div>
      </div>
      <div style={{fontSize:11,color:'#9CA3AF',marginBottom:12}}>Social Security numbers show the last 4 digits only. Opening or downloading this is recorded in the Log tab.</div>
      {info.sections.map(sec=><div key={sec.title} style={{...box,marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10,paddingBottom:6,borderBottom:'1px solid #E5E7EB'}}>{sec.title}</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 24px'}}>{sec.fields.map(([l,v,full],i)=><div key={l+i} style={{gridColumn:full?'1 / -1':'auto',marginBottom:8}}><div style={lbl}>{l}</div><div style={{fontWeight:600,fontSize:14,color:'#111827',whiteSpace:'pre-wrap'}}>{v}</div></div>)}</div></div>)}
    </>}
  </div>;
}
function DealModal({deal,onClose,onStatusChange,onToggleAvailable,staff,me,onAssign,startTab,onDealPatch}){
  const pre=!!deal&&['Request','Dead'].includes(deal.status);
  const[tab,setTab]=useState(startTab||'status'),[closing,setClosing]=useState(false),[gr,setGr]=useState(null),[declining,setDeclining]=useState(false);
  async function askGetReady(){try{const r=await apiFetch('porter?action=deal_card&deal_number='+encodeURIComponent(deal.deal_number));if(r&&r.card){onStatusChange(deal.deal_number,'Approved');return;}}catch(e){}setGr({inspection:false});}
  if(!deal)return null;
  const availDt=deal.vehicle_available_at?new Date(deal.vehicle_available_at).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):null;
  const sum=deal.doc_summary,docsNeed=!!sum&&sum.requested>0&&sum.received<sum.requested;
  const lbl={fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6};
  const card={background:'#F8FAFC',borderRadius:12,padding:16};
  const tabs=[['status','Deal Status'],['credit','Credit'],['docs','Docs'+(sum&&sum.requested>0?' ('+sum.received+'/'+sum.requested+')':'')],['car','Car Status'],['notes','Notes'],['assignment','Assignment'],['log','Log']];
  return <Modal title={'Deal #'+deal.deal_number} onClose={onClose} extraWide>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:16,marginBottom:18}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div style={card}><div style={lbl}>Customer</div><div style={{fontSize:17,fontWeight:800,marginBottom:4}}>{deal.customer_name}</div>{deal.customer_phone&&<div style={{fontSize:13}}>📞 {deal.customer_phone}</div>}{deal.customer_email&&<div style={{fontSize:13,wordBreak:'break-all'}}>✉️ {deal.customer_email}</div>}</div>
        <div style={card}><div style={lbl}>Broker</div><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,flexWrap:'wrap'}}><div><div style={{fontSize:15,fontWeight:700}}>{deal.broker_name}</div><div style={{fontSize:12,color:'#6B7280'}}>{deal.broker_code}</div></div><MessageBrokerButton deal={deal}/></div>{deal.broker_user_name&&<div style={{fontSize:12,color:'#1D4ED8',fontWeight:600,marginTop:3}}>Salesperson: {deal.broker_user_name}</div>}{deal.broker_contact&&<div style={{fontSize:13,marginTop:4}}>{deal.broker_contact}</div>}{deal.broker_email&&<div style={{fontSize:12,wordBreak:'break-all'}}>✉️ {deal.broker_email}</div>}</div>
      </div>
      <div className='navy-keep' style={{background:'linear-gradient(135deg,#0F172A,#1E3A8A)',borderRadius:14,padding:18,color:'#fff'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:6}}><div style={{fontSize:11,fontWeight:700,color:'#93C5FD',textTransform:'uppercase',letterSpacing:'0.05em'}}>🚗 Car</div><SBadge status={deal.status}/></div>
        <div style={{fontSize:18,fontWeight:800,lineHeight:1.25}}>{deal.vehicle_desc}</div>
        <div style={{display:'flex',gap:18,flexWrap:'wrap',marginTop:10,fontSize:12,color:'#CBD5E1'}}>{deal.stock_num&&<span>Stock # <b style={{color:'#fff'}}>{deal.stock_num}</b></span>}{deal.msrp&&<span>MSRP <b style={{color:'#fff'}}>{deal.msrp}</b></span>}{deal.vin&&<span style={{fontFamily:'monospace'}}>VIN {deal.vin}</span>}</div>
        <div style={{marginTop:10,fontSize:12,fontWeight:700,color:deal.vehicle_available?'#6EE7B7':'#FCD34D'}}>{deal.vehicle_available?'✓ Confirmed available'+(availDt?' · '+availDt:''):'Availability not confirmed yet'}</div>
      </div>
    </div>
    <div style={{display:'flex',gap:4,borderBottom:'2px solid #E5E7EB',marginBottom:16,flexWrap:'wrap'}}>{tabs.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:'10px 16px',border:'none',background:'none',cursor:'pointer',fontWeight:700,fontSize:14,color:tab===k?'#1D4ED8':'#6B7280',borderBottom:tab===k?'3px solid #1D4ED8':'3px solid transparent',marginBottom:-2}}>{l}{k==='docs'&&docsNeed&&<span style={{marginLeft:6,background:'#DC2626',color:'#fff',borderRadius:10,fontSize:10,padding:'1px 6px'}}>!</span>}{k==='docs'&&sum&&sum.awaiting>0&&<span style={{marginLeft:6,background:'#F59E0B',color:'#fff',borderRadius:10,fontSize:10,padding:'1px 6px'}}>{sum.awaiting} to review</span>}</button>)}</div>
    {tab==='assignment'&&(pre?<div style={card}>Assignment opens once the credit application has been received.</div>:onAssign?<div style={{background:'#EFF6FF',border:'1.5px solid #BFDBFE',borderRadius:12,padding:20}}>
      <div style={{fontSize:11,fontWeight:700,color:'#1D4ED8',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10}}>Assigned to</div>
      <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}><div style={{fontSize:17,fontWeight:700,color:deal.assigned_to?'#111827':'#9CA3AF'}}>{deal.assigned_to?(deal.assigned_to_name||('Staff #'+deal.assigned_to)):'Unassigned'}</div>{String(deal.assigned_to)!==String(me&&me.id)&&<Btn size='sm' onClick={()=>onAssign(deal.deal_number,'me')}>Assign to me</Btn>}<select value='' onChange={e=>{if(e.target.value)onAssign(deal.deal_number,e.target.value);}} style={{padding:'7px 10px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:13,background:'#fff'}}><option value=''>Assign to...</option>{(staff||[]).filter(a=>String(a.id)!==String(deal.assigned_to)).map(a=><option key={a.id} value={a.id}>{a.name}{a.role==='fleet_manager'?' (Fleet Manager)':''}</option>)}</select></div>
      <div style={{fontSize:12,color:'#6B7280',marginTop:10}}>The first claim emails the broker automatically. Reassigning asks you to confirm and lets you choose whether to notify them.</div>
      {deal.assigned_to&&<div style={{marginTop:12}}><Btn size='sm' variant='outline' onClick={()=>window.dispatchEvent(new CustomEvent('open-chat',{detail:{dealNumber:deal.deal_number}}))}>💬 Message the broker</Btn></div>}
    </div>:<div style={card}>{deal.assigned_to_name?'Handled by '+deal.assigned_to_name:'Not assigned yet'}</div>)}
    {tab==='credit'&&<CreditTab dealNumber={deal.deal_number}/>}
    {tab==='docs'&&(pre?<div style={card}>Documents open once the credit application has been received.</div>:<DocsPanel dealNumber={deal.deal_number} isStaff={true} onMarkAllIn={()=>onStatusChange(deal.deal_number,'All Docs In')}/>)}
    {tab==='car'&&<CarStatusTab deal={deal}/>}
    {tab==='status'&&<div>
      <div style={{...card,marginBottom:14}}><div style={{fontSize:13,fontWeight:700,marginBottom:14}}>Status: <SBadge status={deal.status}/></div><div style={lbl}>Move to:</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{ADMIN_STATUSES.filter(s=>s!==deal.status).map(s=>{const c=SC[s]||{color:'#6B7280'};return <button key={s} onClick={()=>s==='Completed'?setClosing(true):s==='Approved'?askGetReady():s==='Declined'?setDeclining(true):onStatusChange(deal.deal_number,s)} style={{padding:'8px 16px',borderRadius:8,border:`2px solid ${c.color}`,background:'#fff',color:c.color,fontWeight:700,fontSize:13,cursor:'pointer',transition:'all 0.15s'}} onMouseEnter={e=>{e.target.style.background=c.color;e.target.style.color='#fff';}} onMouseLeave={e=>{e.target.style.background='#fff';e.target.style.color=c.color;}}>{s}</button>;})}</div></div>
      {gr&&<GetReadyPrompt deal={deal} inspection={gr.inspection} setInspection={v=>setGr({inspection:v})} onClose={()=>setGr(null)} onChoose={add=>{const ins=gr.inspection;setGr(null);onStatusChange(deal.deal_number,'Approved',add?{get_ready:true,needs_inspection:ins}:undefined);}}/>}
      {declining&&<DeclinePrompt deal={deal} onClose={()=>setDeclining(false)} onChoose={note=>{setDeclining(false);onStatusChange(deal.deal_number,'Declined',note?{decline_note:note}:undefined);}}/>}       {closing&&<CloseDealModal deal={deal} onClose={()=>setClosing(false)} onSaved={patch=>{setClosing(false);if(onDealPatch)onDealPatch(deal.deal_number,{status:'Completed',...patch});}}/>}
      {deal.status==='Completed'&&<PayoutCard deal={deal} onPatch={onDealPatch}/>}
      <div style={{...card,marginBottom:14}}><div style={lbl}>Car availability</div><div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}><Btn variant={deal.vehicle_available?'outline':'success'} onClick={()=>onToggleAvailable(deal.deal_number,deal.vehicle_available)}>{deal.vehicle_available?'✓ Available (remove)':'Mark Vehicle Available → Notify Broker'}</Btn>{availDt&&<span style={{fontSize:12,color:'#059669',fontWeight:600}}>✓ {availDt}</span>}</div><InvoiceSlot deal={deal} onDealPatch={onDealPatch}/></div>
      <div style={card}><div style={lbl}>Timeline</div><div style={{display:'flex',gap:24,flexWrap:'wrap'}}>{[['Requested',deal.request_date],['Application',deal.app_date],['Approved',deal.approved_date],['Completed',deal.sold_date]].map(([l,d])=><div key={l}><span style={{fontSize:11,color:'#9CA3AF',display:'block'}}>{l.toUpperCase()}</span><span style={{fontWeight:600,color:d?'#111827':'#D1D5DB'}}>{d||'—'}</span></div>)}</div></div>
    </div>}
    {tab==='notes'&&<div>{deal.notes&&<div style={{background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:10,padding:14,marginBottom:14}}><span style={{fontSize:13,color:'#92400E'}}>📝 {deal.notes}</span></div>}<NotesPanel dealNumber={deal.deal_number} isStaff={true}/></div>}
    {tab==='log'&&<LogTab dealNumber={deal.deal_number}/>}
    <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}><Btn variant='outline' onClick={onClose}>Close</Btn></div>
  </Modal>;
}
function BrokerModal({broker,onClose,onResetPW,staff,me,onAssign}){
  const[deals,setDeals]=useState([]),[loading,setL]=useState(true),[sf,setSF]=useState("All"),[selDeal,setSelDeal]=useState(null),[editing,setEditing]=useState(false),[btab,setBTab]=useState("deals");
  const[form,setForm]=useState({company_name:broker.company_name||"",contact_name:broker.contact_name||"",email:broker.email||"",phone:broker.phone||"",username:broker.username||""});
  const[saving,setSaving]=useState(false),[toast,setToast]=useState(null);
  function t2(msg,type="success"){setToast({msg,type});setTimeout(()=>setToast(null),3000);}
  useEffect(()=>{apiFetch(`deals?broker_id=${broker.id}`).then(d=>{setDeals(d);setL(false);}).catch(()=>setL(false));},[broker.id]);
  useLive(['deals','events'],()=>{apiFetch(`deals?broker_id=${broker.id}`).then(d=>{setDeals(d);setSelDeal(q=>q?(d.find(x=>x.deal_number===q.deal_number)||q):q);}).catch(()=>{});});
  const filtered=sf==="All"?deals:deals.filter(d=>d.status===sf);
  const req=deals.length,sold=deals.filter(d=>d.status==="Completed").length,cr=req?Math.round(sold/req*100):0;
  async function saveEdit(){setSaving(true);try{await apiFetch("brokers",{method:"PUT",body:{broker_code:broker.broker_code,...form}});t2("Broker updated!");}catch(e){t2(e.message,"error");}finally{setSaving(false);setEditing(false);}}
  useEffect(()=>{const h=e=>{const x=e&&e.detail;if(!x||!x.deal_number)return;const patch={assigned_to:x.assigned_to,assigned_to_name:x.assigned_to_name};setDeals(p=>p.map(d=>d.deal_number===x.deal_number?{...d,...patch}:d));setSelDeal(p=>p&&p.deal_number===x.deal_number?{...p,...patch}:p);};window.addEventListener('deal-assigned',h);return()=>window.removeEventListener('deal-assigned',h);},[]);
  async function changeStatus(dn,s,extra){try{const r=await apiFetch("deals?action=status",{method:"PUT",body:{deal_number:dn,status:s,...(extra||{})}});if(r&&r.car&&r.car.card)t2("Added to Get Ready");else if(r&&r.car&&r.car.error)t2(r.car.error,"error");setDeals(p=>p.map(d=>d.deal_number===dn?{...d,status:s}:d));if(selDeal?.deal_number===dn)setSelDeal(p=>({...p,status:s}));}catch(e){t2(e.message,"error");}}
  async function toggleAvail(dn,curr){try{await apiFetch("deals?action=status",{method:"PUT",body:{deal_number:dn,vehicle_available:!curr}});setDeals(p=>p.map(d=>d.deal_number===dn?{...d,vehicle_available:!curr}:d));if(selDeal?.deal_number===dn)setSelDeal(p=>({...p,vehicle_available:!curr}));}catch(e){t2(e.message,"error");}}
  function patchDeal(dn,patch){setDeals(p=>p.map(d=>d.deal_number===dn?{...d,...patch}:d));setSelDeal(p=>p&&p.deal_number===dn?{...p,...patch}:p);}
  if(selDeal)return <DealModal deal={selDeal} onClose={()=>setSelDeal(null)} onStatusChange={changeStatus} onDealPatch={patchDeal} onToggleAvailable={toggleAvail} staff={staff} me={me} onAssign={onAssign}/>;
  return <Modal title={broker.company_name} onClose={onClose} wide>
    {toast&&<Toast {...toast}/>}
    <div style={{display:"flex",gap:6,borderBottom:"2px solid #E5E7EB",marginBottom:20,flexWrap:"wrap"}}>{[["deals","📋 Deals ("+deals.length+")"],["stats","📊 Stats"],["team","👥 Team"],["info","ℹ️ Info"]].map(([k,l])=><button key={k} onClick={()=>setBTab(k)} style={{padding:"10px 18px",border:"none",background:"none",cursor:"pointer",fontWeight:700,fontSize:14,color:btab===k?"#1D4ED8":"#6B7280",borderBottom:btab===k?"3px solid #1D4ED8":"3px solid transparent",marginBottom:-2}}>{l}</button>)}</div>
    {btab==="deals"&&<><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h3 style={{margin:0,fontSize:16,fontWeight:700}}>Deals ({deals.length})</h3><select value={sf} onChange={e=>setSF(e.target.value)} style={{padding:"7px 12px",borderRadius:8,border:"1.5px solid #D1D5DB",fontSize:13,background:"#fff"}}><option value="All">All</option>{ADMIN_STATUSES.map(s=><option key={s} value={s}>{sLabel(s)}</option>)}</select></div>
    {loading?<div style={{textAlign:"center",padding:40,color:"#9CA3AF"}}>Loading…</div>:filtered.length===0?<div style={{textAlign:"center",padding:40,color:"#9CA3AF",background:"#F8FAFC",borderRadius:12}}>No deals.</div>:
    <div style={{display:"flex",flexDirection:"column",gap:8}}>{filtered.map(d=>{const cfg=SC[d.status]||{color:"#6B7280"};return <div key={d.id} onClick={()=>setSelDeal(d)} style={{background:"#fff",border:"1.5px solid #E5E7EB",borderLeft:`4px solid ${cfg.color}`,borderRadius:10,padding:"14px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=cfg.color} onMouseLeave={e=>e.currentTarget.style.borderColor="#E5E7EB"}><div><div style={{fontWeight:700,fontSize:14}}>{d.customer_name}</div><div style={{fontSize:12,color:"#6B7280",marginTop:2}}>{d.vehicle_desc} · #{d.stock_num}</div><div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>#{d.deal_number} · {d.request_date}</div></div><div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}><SBadge status={d.status}/>{d.vehicle_available&&<span style={{fontSize:11,background:"#D1FAE5",color:"#065F46",padding:"2px 8px",borderRadius:10,fontWeight:600}}>✓ Available</span>}</div></div>;})}
    </div>}
  </>}
    {btab==="stats"&&<StatsLoader brokerId={broker.id} isStaff/>}
    {btab==="team"&&<TeamPanel broker={broker} brokerId={broker.id}/>}
    {btab==="info"&&<>{!editing?<div style={{background:"#F8FAFC",borderRadius:12,padding:20,marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontSize:13,fontWeight:700}}>Broker Info</div><Btn size="sm" variant="outline" onClick={()=>setEditing(true)}>✏️ Edit</Btn></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[["Broker ID",broker.broker_code],["Username",broker.username],["Contact",broker.contact_name||"—"],["Phone",broker.phone||"—"],["Email",broker.email||"—","1/-1"]].map(([l,v,span])=><div key={l} style={{gridColumn:span||"auto"}}><span style={{fontSize:11,color:"#9CA3AF",display:"block"}}>{l}</span><span style={{fontWeight:600}}>{v}</span></div>)}</div><div style={{marginTop:14}}><Btn size="sm" variant="outline" onClick={()=>onResetPW(broker)}>🔑 Reset Password</Btn></div></div>:
    <div style={{background:"#F0F9FF",border:"2px solid #3B82F6",borderRadius:12,padding:20,marginBottom:20}}><div style={{fontSize:13,fontWeight:700,color:"#1D4ED8",marginBottom:14}}>✏️ Editing</div><div style={{display:"flex",gap:16,flexWrap:"wrap"}}><Inp half label="Company Name" value={form.company_name} onChange={v=>setForm(p=>({...p,company_name:v}))}/><Inp half label="Contact" value={form.contact_name} onChange={v=>setForm(p=>({...p,contact_name:v}))}/><Inp half label="Email" value={form.email} onChange={v=>setForm(p=>({...p,email:v}))} type="email"/><Inp half label="Phone" value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))}/><Inp half label="Username" value={form.username} onChange={v=>setForm(p=>({...p,username:v}))}/></div><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="outline" size="sm" onClick={()=>setEditing(false)}>Cancel</Btn><Btn size="sm" onClick={saveEdit} loading={saving}>Save</Btn></div></div>}
    </>}
  </Modal>;
}
function ForgotPage({onBack}){const[email,setEmail]=useState(""),[sent,setSent]=useState(false),[loading,setL]=useState(false),[err2,setErr]=useState("");async function submit(e){e.preventDefault();setErr("");setL(true);try{await apiFetch("auth?action=forgot_password",{method:"POST",body:{email}});setSent(true);}catch(e){setErr(e.message);}finally{setL(false);}}return <div className="navy-root" style={{minHeight:"100vh",background:"linear-gradient(135deg,#0F172A 0%,#1E3A5F 100%)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:420}}><div className="navy-keep" style={{textAlign:"center",marginBottom:36}}><BrooklynLogo variant="stack"/><p style={{color:"#93C5FD",margin:"4px 0 0",fontSize:14}}>Password Reset</p></div><div style={{background:"#fff",borderRadius:16,padding:32,boxShadow:"0 24px 60px rgba(0,0,0,0.4)"}}>{sent?<div style={{textAlign:"center"}}><div style={{fontSize:48}}>📧</div><h3>Check your email</h3><p style={{color:"#6B7280",fontSize:14}}>Reset link sent if that email is registered.</p><Btn variant="outline" style={{width:"100%",marginTop:16}} onClick={onBack}>Back to Login</Btn></div>:<form onSubmit={submit}><p style={{color:"#6B7280",fontSize:14,margin:"0 0 20px"}}>Enter your email for a reset link.</p><Inp label="Email" value={email} onChange={setEmail} type="email" required placeholder="your@email.com"/>{err2&&<p style={{color:"#EF4444",fontSize:13,margin:"0 0 12px"}}>{err2}</p>}<Btn style={{width:"100%"}} loading={loading}>Send Reset Link</Btn><button type="button" onClick={onBack} style={{width:"100%",marginTop:12,background:"none",border:"none",cursor:"pointer",color:"#6B7280",fontSize:13,textDecoration:"underline"}}>Back to Login</button></form>}</div></div></div>;}
function ResetPage({token,onDone}){const[p,setP]=useState(""),[c,setC]=useState(""),[done,setDone]=useState(false),[loading,setL]=useState(false),[err2,setErr]=useState("");async function submit(e){e.preventDefault();setErr("");setL(true);try{await apiFetch("auth?action=reset_password",{method:"POST",body:{token,password:p,confirm_password:c}});setDone(true);}catch(e){setErr(e.message);}finally{setL(false);}}return <div className="navy-root" style={{minHeight:"100vh",background:"linear-gradient(135deg,#0F172A 0%,#1E3A5F 100%)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:420}}><div className="navy-keep" style={{textAlign:"center",marginBottom:36}}><BrooklynLogo variant="stack"/></div><div style={{background:"#fff",borderRadius:16,padding:32,boxShadow:"0 24px 60px rgba(0,0,0,0.4)"}}>{done?<div style={{textAlign:"center"}}><div style={{fontSize:48}}>✅</div><h3>Password Updated!</h3><p style={{color:"#6B7280",fontSize:13,margin:"0 0 4px"}}>Porters: sign in with the Porter Login button at the top right.</p><Btn style={{width:"100%",marginTop:16}} onClick={onDone}>Go to Login</Btn></div>:<form onSubmit={submit}><Inp label="New Password" value={p} onChange={setP} type="password" required placeholder="Min. 8 characters"/><Inp label="Confirm" value={c} onChange={setC} type="password" required/>{err2&&<p style={{color:"#EF4444",fontSize:13,margin:"0 0 12px"}}>{err2}</p>}<Btn style={{width:"100%"}} loading={loading} disabled={p.length<8||p!==c}>Update Password</Btn></form>}</div></div></div>;}

// Brooklyn CDJR logo: bridge tower + cables over a car roofline, drawn as vectors (no image files)
const BL_TOWER="M62 92L62 22L67 22L67 14L75 14L75 22L85 22L85 14L93 14L93 22L98 22L98 92ZM67 92L67 62Q67 50 72.5 42Q78 50 78 62L78 92ZM82 92L82 62Q82 50 87.5 42Q93 50 93 62L93 92Z";
const BL_CLIP="M0 0L204 0L204 92L200 92C186 90 160 74 122 74C82 74 40 90 2 94L0 94Z";
const BL_DECK="M2 94C40 86 80 62 122 62C158 62 186 80 200 92C186 90 160 74 122 74C82 74 40 90 2 94Z";
const BL_DECK_TOP="M2 94C40 86 80 62 122 62C158 62 186 80 200 92";
const BL_SPEED="M12 101C54 95 96 86 134 86C162 86 184 93 197 99";
const BL_CABLES=["M62 22Q30 44 3 93","M98 22Q152 38 199 91"];
const BL_STAYS=["M62 25L9 94.36","M62 25L16 92.43","M62 25L24 89.94","M62 25L33 86.88","M62 25L43 83.3","M62 25L53 79.67","M98 25L134 64.67","M98 25L145 66.46","M98 25L156 69.39","M98 25L167 73.51","M98 25L178 78.87","M98 25L189 85.61"];
const BL_FLAG="M80 14L80 3",BL_PENNANT="M80 3L92 6.5L80 10Z";
const BL_WORD=[[0,"M3 0V36M3 3H16Q24 3 24 10.5Q24 18 16 18H3M16 18H19Q27 18 27 26Q27 33 19 33H3"],[36,"M3 0V36M3 3H16Q24 3 24 10.5Q24 18 16 18H3M15 18L26 36"],[72,"M16 3H18Q31 3 31 16V20Q31 33 18 33H16Q3 33 3 20V16Q3 3 16 3Z"],[115,"M16 3H18Q31 3 31 16V20Q31 33 18 33H16Q3 33 3 20V16Q3 3 16 3Z"],[158,"M3 0V36M27 0L5 21M12 14L28 36"],[196,"M3 0V33H26"],[231,"M2 0L15 19L28 0M15 19V36"],[270,"M3 36V0L27 36V0"]],BL_WORD_W=300;
let blSeq=0;
function BrooklynMark({height=48,ink='#fff',animate=true,style}){
  const idRef=useRef(null);if(idRef.current===null)idRef.current='bl'+(++blSeq);const id=idRef.current;
  return <svg viewBox="0 0 200 120" height={height} width={Math.round(height*200/120)} role="img" aria-label="Brooklyn bridge and car" className={animate?'bl-anim':undefined} style={style}>
    <defs>
      <linearGradient id={id+'g'} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#22D3EE"/><stop offset=".55" stopColor="#3B82F6"/><stop offset="1" stopColor="#8B5CF6"/></linearGradient>
      <clipPath id={id+'c'}><path d={BL_CLIP}/></clipPath>
      <clipPath id={id+'d'}><path d={BL_DECK}/></clipPath>
    </defs>
    <g fill="none" stroke={ink} strokeLinecap="round">
      {BL_CABLES.map((d,i)=><path key={'c'+i} d={d} strokeWidth="2.4" pathLength="1" className="bl-draw" style={{animationDelay:(0.1+i*0.15)+'s'}}/>)}
      {BL_STAYS.map((d,i)=><path key={'s'+i} d={d} strokeWidth="1.1" opacity=".8" pathLength="1" className="bl-draw" style={{animationDelay:(0.35+i*0.06)+'s'}}/>)}
    </g>
    <g clipPath={'url(#'+id+'c)'}><path d={BL_TOWER} fill={ink} fillRule="evenodd"/></g>
    <path d={BL_FLAG} stroke={ink} strokeWidth="1.6" strokeLinecap="round" fill="none"/>
    <path d={BL_PENNANT} fill="#22D3EE"/>
    <path d={BL_DECK} fill={'url(#'+id+'g)'}/>
    <g clipPath={'url(#'+id+'d)'}><rect className="bl-shine" x="-40" y="50" width="26" height="60" fill="#fff" opacity=".5"/></g>
    <path d={BL_DECK_TOP} fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2"/>
    <path d={BL_SPEED} fill="none" stroke="#22D3EE" strokeOpacity=".7" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>;
}
function BrooklynWordmark({height=18,ink='#fff'}){
  return <svg viewBox={'0 0 '+BL_WORD_W+' 36'} height={height} width={Math.round(height*BL_WORD_W/36)} fill="none" stroke={ink} strokeWidth="6" strokeLinejoin="miter" strokeMiterlimit="3" overflow="visible" role="img" aria-label="Brooklyn">{BL_WORD.map(([x,d],i)=><path key={i} transform={'translate('+x+' 0)'} d={d}/>)}</svg>;
}
function BrooklynLogo({variant='stack',ink='#fff',markHeight,wordHeight,animate=true}){
  if(variant==='row')return <div style={{display:'flex',alignItems:'center',gap:12}}><BrooklynMark height={markHeight||44} ink={ink} animate={animate}/><BrooklynWordmark height={wordHeight||16} ink={ink}/></div>;
  return <div style={{display:'inline-flex',flexDirection:'column',alignItems:'center',gap:10}}><BrooklynMark height={markHeight||96} ink={ink} animate={animate}/><BrooklynWordmark height={wordHeight||26} ink={ink}/></div>;
}

// ---- dark mode: remembered per browser, shared by every screen ----
function applyTheme(t){const h=document.documentElement;if(t==='dark')h.classList.add('dark');else h.classList.remove('dark');}
function ThemeToggle({style}){
  const[dark,setDark]=useState(()=>typeof document!=='undefined'&&document.documentElement.classList.contains('dark'));
  useEffect(()=>{const h=e=>setDark(e.detail==='dark');window.addEventListener('theme-change',h);return()=>window.removeEventListener('theme-change',h);},[]);
  const flip=()=>{const n=dark?'light':'dark';applyTheme(n);try{localStorage.setItem('theme',n);}catch(e){}setDark(n==='dark');window.dispatchEvent(new CustomEvent('theme-change',{detail:n}));};
  const label=dark?'Switch to light mode':'Switch to dark mode';
  return <button type='button' onClick={flip} title={label} aria-label={label} style={{width:34,height:34,borderRadius:8,border:'1px solid #334155',background:'rgba(255,255,255,0.06)',color:'#E2E8F0',cursor:'pointer',fontSize:16,lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center',padding:0,...style}}>{dark?'☀️':'🌙'}</button>;
}

function LoginPage({onLogin,initialMode}){
  const[mode,setMode]=useState(initialMode||"broker"),[pu,setPU]=useState(""),[pp,setPP]=useState(""),[u,setU]=useState(""),[p,setP]=useState(""),[bl,setBL]=useState(""),[bp,setBP]=useState(""),[err2,setErr]=useState(""),[loading,setL]=useState(false),[forgot,setForgot]=useState(false);
  async function adminLogin(e){e.preventDefault();setErr("");setL(true);try{const d=await apiFetch("auth?action=admin_login",{method:"POST",body:{username:u,password:p}});localStorage.setItem("auth_token",d.token);localStorage.setItem("auth_role",d.role);localStorage.setItem("auth_name",d.name);localStorage.setItem("auth_email",d.email||"");localStorage.setItem("auth_admin_id",String(d.admin_id||""));localStorage.setItem("auth_admin_role",d.admin_role||"admin");onLogin({role:"admin",name:d.name,email:d.email,id:d.admin_id,adminRole:d.admin_role||"admin"});}catch(e){setErr(e.message);}finally{setL(false);}}
  async function brokerLogin(e){e.preventDefault();setErr("");setL(true);try{const d=await apiFetch("auth?action=broker_login",{method:"POST",body:{login:bl,password:bp}});localStorage.setItem("auth_token",d.token);localStorage.setItem("auth_role",d.role);localStorage.setItem("auth_broker",JSON.stringify(d));onLogin({role:"broker",broker:d});}catch(e){setErr(e.message);}finally{setL(false);}}
  async function porterLogin(e){e.preventDefault();setErr("");setL(true);try{const d=await apiFetch("porter?action=login",{method:"POST",body:{username:pu,password:pp}});localStorage.setItem("auth_token",d.token);localStorage.setItem("auth_role","porter");localStorage.setItem("auth_porter",JSON.stringify(d));onLogin({role:"porter",porter:d});}catch(e){setErr(e.message);}finally{setL(false);}}
  if(forgot)return <ForgotPage onBack={()=>setForgot(false)}/>;
  return <div className="navy-root" style={{minHeight:"100vh",position:"relative",background:"linear-gradient(135deg,#0F172A 0%,#1E3A5F 100%)",display:"flex",alignItems:"center",justifyContent:"center"}}><div className="navy-keep" style={{position:"absolute",top:18,right:22,display:"flex",gap:8,alignItems:"center"}}><ThemeToggle/>{[["admin","Admin Login"],["porter","Porter Login"]].map(([m,l])=><button key={m} type="button" onClick={()=>{setMode(mode===m?"broker":m);setErr("");}} style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid rgba(147,197,253,0.5)",background:mode===m?"#fff":"transparent",color:mode===m?"#1D4ED8":"#93C5FD",fontWeight:700,fontSize:12,cursor:"pointer"}}>{l}</button>)}</div><div style={{width:440,maxWidth:"92vw"}}><div className="navy-keep" style={{textAlign:"center",marginBottom:36}}><BrooklynLogo variant="stack"/><p style={{color:"#93C5FD",margin:"4px 0 0",fontSize:14}}>Broker Deal Portal</p></div><div style={{background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 24px 60px rgba(0,0,0,0.4)"}}><div style={{padding:"18px 28px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",color:"#1D4ED8"}}>{mode==="admin"?"Admin Login":mode==="porter"?"Porter Login":"Broker Login"}</div>{mode!=="broker"&&<button type="button" onClick={()=>{setMode("broker");setErr("");}} style={{background:"none",border:"none",cursor:"pointer",color:"#6B7280",fontSize:13,textDecoration:"underline"}}>Broker login</button>}</div><div style={{padding:28}}>{mode==="admin"?<form onSubmit={adminLogin} autoComplete="off"><Inp label="Username or Email" value={u} onChange={setU} required placeholder="admin"/><Inp label="Password" value={p} onChange={setP} type="password" required placeholder="••••••••"/>{err2&&<p style={{color:"#EF4444",fontSize:13,margin:"0 0 12px"}}>{err2}</p>}<Btn style={{width:"100%"}} loading={loading}>Sign In as Admin</Btn><button type="button" onClick={()=>setForgot(true)} style={{width:"100%",marginTop:12,background:"none",border:"none",cursor:"pointer",color:"#6B7280",fontSize:13,textDecoration:"underline"}}>Forgot password?</button></form>:mode==="porter"?<form onSubmit={porterLogin} autoComplete="off"><Inp label="Username" value={pu} onChange={setPU} required placeholder="your porter username"/><Inp label="Password" value={pp} onChange={setPP} type="password" required placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}/>{err2&&<p style={{color:"#EF4444",fontSize:13,margin:"0 0 12px"}}>{err2}</p>}<Btn style={{width:"100%"}} loading={loading}>Sign In as Porter</Btn><button type="button" onClick={()=>setForgot(true)} style={{width:"100%",marginTop:12,background:"none",border:"none",cursor:"pointer",color:"#6B7280",fontSize:13}}>Forgot password?</button></form>:<form onSubmit={brokerLogin} autoComplete="off"><Inp label="Username, email or Broker ID" value={bl} onChange={setBL} required placeholder="e.g. B001, your username or your email"/><Inp label="Password" value={bp} onChange={setBP} type="password" required placeholder="••••••••"/><p style={{fontSize:12,color:"#9CA3AF",margin:"-8px 0 16px"}}>Don't have an account? Contact Brooklyn CDJR.</p>{err2&&<p style={{color:"#EF4444",fontSize:13,margin:"0 0 12px"}}>{err2}</p>}<Btn style={{width:"100%"}} loading={loading}>Sign In</Btn><button type="button" onClick={()=>setForgot(true)} style={{width:"100%",marginTop:12,background:"none",border:"none",cursor:"pointer",color:"#6B7280",fontSize:13,textDecoration:"underline"}}>Forgot password?</button></form>}</div></div></div></div>;
}

function BrokerPortal({broker,onLogout,initialDeals}){
  const[dealModal,setDealModal]=useState(null);
  const myRole=broker.user_role||"owner",canManage=myRole==="owner"||myRole==="admin";
  const[ownerView,setOwnerView]=useState("all"),[team,setTeam]=useState(null);
  const refreshTeam=()=>{if(canManage)apiFetch("brokers?action=team").then(setTeam).catch(()=>{});};
  const ownerSelect=canManage?<select value={ownerView} onChange={e=>setOwnerView(e.target.value)} title="Choose whose deals to show" style={{padding:"8px 12px",borderRadius:10,border:"1.5px solid #D1D5DB",background:"#fff",fontWeight:700,fontSize:13,color:"#1F2937",cursor:"pointer",minWidth:210}}><option value="all">All deals</option><option value="me">My deals</option>{myRole==="admin"&&<option value="owner">{team&&team.owner?team.owner.name+" (Owner)":"Account owner"}</option>}{((team&&team.users)||[]).filter(u=>String(u.id)!==String(broker.broker_user_id||"")).map(u=><option key={u.id} value={String(u.id)}>{u.name}{u.suspended?" (suspended)":""}</option>)}</select>:null;
  const[tab,setTab]=useState("mydeals"),[inv,setInv]=useState([]),[deals,setDeals]=useState(initialDeals||[]),[dealsReady,setDealsReady]=useState(!!initialDeals),[search,setSearch]=useState(""),[sel,setSel]=useState(null),[showReq,setShowReq]=useState(false),[showApp,setShowApp]=useState(null),[showProf,setSP]=useState(false),[toast,setToast]=useState(null),[loading,setL]=useState(false),[statusTab,setStatusTab]=useState("All");
  const[req,setReq]=useState({customer_name:"",customer_phone:"",customer_email:"",notes:""});
  const[profForm,setPF]=useState({contact_name:broker.contact_name||"",email:broker.email||"",phone:broker.phone||""});
  const[pw,setPW]=useState({current_password:"",new_password:"",confirm_password:""});
  const[filterMake,setFM]=useState(""),[filterTrim,setFT]=useState(""),[sortMSRP,setSM]=useState(""),[colorFilters,setCF]=useState(new Set());
  function t2(msg,type="success"){setToast({msg,type});setTimeout(()=>setToast(null),3500);}
  const loadInv=useCallback(async(quiet)=>{try{setInv(await apiFetch("inventory"));}catch(e){if(quiet!==true)t2(e.message,"error");}},[]);
  const loadDeals=useCallback(async(quiet)=>{try{setDeals(await apiFetch(canManage&&ownerView!=="all"?"deals?owner="+ownerView:"deals"));setDealsReady(true);}catch(e){if(quiet!==true)t2(e.message,"error");}},[ownerView,canManage]);
  useEffect(()=>{refreshTeam();},[canManage]);
  useLive(['deals','events','msgs'],()=>{loadDeals(true);});
  useLive(['inv','deals'],()=>{loadInv(true);});
  useLive(['team'],()=>{refreshTeam();});
  useEffect(()=>{loadInv();},[loadInv]);
  useEffect(()=>{loadDeals();},[loadDeals]);
  useEffect(()=>{const h=e=>{const d0=e&&e.detail;if(!d0||!d0.deal_number)return;setTab('mydeals');setDealModal({dn:d0.deal_number,tab:d0.tab||'overview'});if(!deals.some(x=>x.deal_number===d0.deal_number)){if(canManage&&ownerView!=='all')setOwnerView('all');else loadDeals(true);}};window.addEventListener('open-deal',h);return()=>window.removeEventListener('open-deal',h);},[deals,loadDeals,canManage,ownerView]);
  const filteredDeals=useMemo(()=>statusTab==="All"?deals:deals.filter(d=>d.status===statusTab),[deals,statusTab]);
  const requestedVins=useMemo(()=>new Set(deals.map(d=>d.vin)),[deals]);
  const uniqueMakes=useMemo(()=>[...new Set(inv.map(v=>v.year_make_model).filter(Boolean))].sort(),[inv]);
  const uniqueTrims=useMemo(()=>[...new Set(inv.filter(v=>!filterMake||v.year_make_model===filterMake).map(v=>v.trim).filter(Boolean))].sort(),[inv,filterMake]);
  const uniqueColors=useMemo(()=>[...new Set(inv.map(v=>v.exterior_color).filter(Boolean))].sort(),[inv]);
  const filteredInv=useMemo(()=>{let r=[...inv];if(search)r=r.filter(v=>v.year_make_model?.toLowerCase().includes(search.toLowerCase())||v.trim?.toLowerCase().includes(search.toLowerCase())||v.exterior_color?.toLowerCase().includes(search.toLowerCase())||v.stock_num?.toLowerCase().includes(search.toLowerCase()));if(filterMake)r=r.filter(v=>v.year_make_model===filterMake);if(filterTrim)r=r.filter(v=>v.trim===filterTrim);if(colorFilters.size>0)r=r.filter(v=>colorFilters.has(v.exterior_color));if(sortMSRP==="high")r.sort((a,b)=>parseFloat((b.msrp||"0").replace(/[^0-9.]/g,""))-parseFloat((a.msrp||"0").replace(/[^0-9.]/g,"")));if(sortMSRP==="low")r.sort((a,b)=>parseFloat((a.msrp||"0").replace(/[^0-9.]/g,""))-parseFloat((b.msrp||"0").replace(/[^0-9.]/g,"")));return r;},[inv,search,filterMake,filterTrim,colorFilters,sortMSRP]);
  function toggleColor(color){setCF(prev=>{const n=new Set(prev);n.has(color)?n.delete(color):n.add(color);return n;});}
  const statusColors={All:"#6B7280",Request:"#3B82F6",Application:"#F59E0B",Approved:"#DC2626",Declined:"#EF4444","All Docs In":"#0D9488","eDocs Sent":"#8B5CF6","Docs Sent":"#8B5CF6","Ready to Pick Up":"#F97316",Completed:"#059669"};
  async function submitReq(){if(!req.customer_name||!sel)return;setL(true);try{await apiFetch("deals?action=request",{method:"POST",body:{...req,vin:sel}});setShowReq(false);setSel(null);setReq({customer_name:"",customer_phone:"",customer_email:"",notes:""});t2("Request submitted!");setTab("mydeals");}catch(e){t2(e.message,"error");}finally{setL(false);}}
  async function submitApp(appData){setL(true);try{const{worksheet,...rest}=appData;const dn=showApp;await apiFetch('deals?action=submit_app',{method:'POST',body:{...rest,deal_number:dn}});setShowApp(null);let wsFail='';if(worksheet){try{await apiFetch('docs?action=upload',{method:'POST',body:{deal_number:dn,doc_key:'worksheet',file:worksheet}});}catch(e){wsFail=e.message;}}if(wsFail)t2('Application submitted, but the worksheet did not upload ('+wsFail+'). You can add it from the Docs tab of your deal.','error');else t2('Application submitted!');loadDeals();}catch(e){t2(e.message,'error');}finally{setL(false);}}
  async function saveProfForm(){setL(true);try{await apiFetch("brokers",{method:"PUT",body:profForm});t2("Profile updated!");}catch(e){t2(e.message,"error");}finally{setL(false);}}
  async function savePW(){setL(true);try{await apiFetch("brokers",{method:"PUT",body:pw});t2("Password updated!");setPW({current_password:"",new_password:"",confirm_password:""});}catch(e){t2(e.message,"error");}finally{setL(false);}}
  const TAB=(k,l)=><button onClick={()=>setTab(k)} style={{padding:"10px 20px",border:"none",cursor:"pointer",fontWeight:600,fontSize:14,background:"none",borderBottom:tab===k?"3px solid #1D4ED8":"3px solid transparent",color:tab===k?"#1D4ED8":"#6B7280",transition:"all 0.15s"}}>{l}</button>;
  return <div style={{minHeight:"100vh",background:"#F8FAFC",fontFamily:"system-ui,-apple-system,sans-serif"}}>
    <div className="navy-keep" style={{background:"#0F172A",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px 0"}}><BrooklynMark height={40}/><div><div style={{marginBottom:3}}><BrooklynWordmark height={14}/></div><div style={{color:"#93C5FD",fontSize:12}}>Broker Portal</div></div></div>
      <div style={{display:"flex",alignItems:"center",gap:12}}><button onClick={()=>setSP(true)} style={{background:"none",border:"none",cursor:"pointer",textAlign:"right"}}><div style={{color:"#fff",fontWeight:600,fontSize:14}}>{broker.company_name}</div><div style={{color:"#93C5FD",fontSize:12}}>{broker.user_name&&broker.user_role!=="owner"?broker.user_name+" · "+(broker.user_role==="admin"?"Admin":"Sales"):broker.broker_code+" · "+broker.username}</div></button><ThemeToggle/><Btn variant="outline" size="sm" onClick={onLogout} style={{borderColor:"#334155",color:"#94A3B8"}}>Sign Out</Btn></div>
    </div>
    <div style={{background:"#fff",borderBottom:"1px solid #E5E7EB",padding:"0 24px",display:"flex",gap:8}}>{TAB("inventory","🔍 Browse Inventory")}{TAB("mydeals",dealsReady?`📋 My Deals (${deals.length})`:"📋 My Deals")}{TAB("earnings","💰 Earnings")}{canManage&&TAB("team","👥 Team")}</div>
    <div style={{maxWidth:1200,margin:"0 auto",padding:"24px 16px"}}>
      {tab==="inventory"&&<>
        <div style={{background:"#fff",borderRadius:12,padding:16,marginBottom:20,boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
            <div style={{flex:"1 1 200px"}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:4}}>Search</label><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Model, trim, color, stock#…" style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D5DB",fontSize:14,outline:"none",boxSizing:"border-box"}}/></div>
            <div style={{flex:"1 1 180px"}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:4}}>Year/Make/Model</label><select value={filterMake} onChange={e=>{setFM(e.target.value);setFT("");}} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D5DB",fontSize:14,background:"#fff"}}><option value="">All Models</option>{uniqueMakes.map(m=><option key={m}>{m}</option>)}</select></div>
            <div style={{flex:"1 1 180px"}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:4}}>Trim</label><select value={filterTrim} onChange={e=>setFT(e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D5DB",fontSize:14,background:"#fff"}}><option value="">All Trims</option>{uniqueTrims.map(t=><option key={t}>{t}</option>)}</select></div>
            <div style={{flex:"1 1 160px"}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:4}}>Sort MSRP</label><select value={sortMSRP} onChange={e=>setSM(e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D5DB",fontSize:14,background:"#fff"}}><option value="">Default</option><option value="low">Low → High</option><option value="high">High → Low</option></select></div>
          </div>
          <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #F3F4F6"}}><div style={{fontSize:12,fontWeight:600,color:"#374151",marginBottom:8}}>Filter by Color:</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{uniqueColors.map(color=>{const active=colorFilters.has(color);return <label key={color} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"4px 10px",borderRadius:20,border:`1.5px solid ${active?"#1D4ED8":"#E5E7EB"}`,background:active?"#EFF6FF":"#fff",fontSize:12,fontWeight:active?700:400,color:active?"#1D4ED8":"#374151",transition:"all 0.15s"}}><input type="checkbox" checked={active} onChange={()=>toggleColor(color)} style={{display:"none"}}/>{active?"✓ ":""}{color}</label>;})}</div></div>
          <div style={{marginTop:8,fontSize:12,color:"#6B7280"}}>Showing {filteredInv.length} of {inv.length} vehicles</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
          {filteredInv.map(v=>{const requested=requestedVins.has(v.vin);return <div key={v.vin} onClick={()=>!requested&&setSel(sel===v.vin?null:v.vin)} style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 6px rgba(0,0,0,0.08)",cursor:requested?"default":"pointer",border:sel===v.vin?"2px solid #1D4ED8":"2px solid transparent",opacity:requested?0.8:1,transition:"all 0.15s",position:"relative"}}>
            {requested&&<div style={{position:"absolute",top:12,right:12,background:"#F59E0B",color:"#fff",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10}}>REQUESTED</div>}{v.credit_pending&&<div title="A credit application has been submitted on this vehicle" style={{position:"absolute",top:requested?38:12,right:12,background:"#EA580C",color:"#fff",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10}}>CREDIT PENDING</div>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{fontWeight:700,fontSize:15,paddingRight:(requested||v.credit_pending)?120:0}}>{v.year_make_model}</div>{!requested&&!v.credit_pending&&<SBadge status={v.inv_status}/>}</div>
            <div style={{color:"#6B7280",fontSize:13,marginTop:4}}>{v.trim}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
              <div><span style={{fontSize:11,color:"#9CA3AF",display:"block"}}>STOCK #</span><span style={{fontSize:13,fontWeight:600}}>{v.stock_num}</span></div>
              <div><span style={{fontSize:11,color:"#9CA3AF",display:"block"}}>MSRP</span><span style={{fontSize:13,fontWeight:600}}>{v.msrp}</span></div>
              <div><span style={{fontSize:11,color:"#9CA3AF",display:"block"}}>EXTERIOR</span><span style={{fontSize:12}}>{v.exterior_color}</span></div>
              <div><span style={{fontSize:11,color:"#9CA3AF",display:"block"}}>AGE (DAYS)</span><span style={{fontSize:13,fontWeight:600,color:v.age_days>60?"#EF4444":"#374151"}}>{v.age_days}</span></div>
            </div>
            {sel===v.vin&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #E5E7EB"}}><Btn style={{width:"100%"}} onClick={e=>{e.stopPropagation();setShowReq(true);}}>Request This Vehicle →</Btn></div>}
            {requested&&<div style={{marginTop:10,padding:"8px 12px",background:"#FFFBEB",borderRadius:8,fontSize:12,color:"#92400E"}}>✓ Already requested — view in My Deals</div>}
          </div>;})}
          {filteredInv.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:60,color:"#9CA3AF",background:"#fff",borderRadius:12}}><div style={{fontSize:40}}>🔍</div><p>No vehicles match your filters.</p></div>}
        </div>
      </>}
      {tab==="earnings"&&<><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,margin:"0 0 16px"}}><h2 style={{margin:0,fontSize:20,fontWeight:700}}>Earnings</h2>{ownerSelect}</div><StatsLoader owner={canManage?ownerView:"all"}/></>}
      
{tab==="team"&&canManage&&<TeamPanel broker={broker} onChanged={refreshTeam}/>}
      {tab==="mydeals"&&<>
        <div style={{marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,margin:"0 0 16px"}}><h2 style={{margin:0,fontSize:20,fontWeight:700}}>My Deals</h2>{ownerSelect}</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{BROKER_STATUSES.map(s=>{const count=s==="All"?deals.length:deals.filter(d=>d.status===s).length;const active=statusTab===s||s==="Approved";const color=statusColors[s]||"#6B7280";return <button key={s} onClick={()=>setStatusTab(s)} style={{padding:"7px 14px",borderRadius:20,border:`2px solid ${active?color:"#E5E7EB"}`,background:active?color:"#fff",color:active?"#fff":color,fontWeight:700,fontSize:12,cursor:"pointer",transition:"all 0.15s",outline:statusTab===s&&s==="Approved"?"3px solid #7F1D1D":"none",outlineOffset:2}}>{sLabel(s)}{count>0&&<span style={{marginLeft:4,background:active?"rgba(255,255,255,0.3)":"rgba(0,0,0,0.08)",borderRadius:10,padding:"1px 6px"}}>{count}</span>}</button>;})}</div></div>
        {!dealsReady?<div style={{textAlign:"center",padding:60,color:"#9CA3AF",background:"#fff",borderRadius:12,fontSize:14}}>Loading your deals...</div>:filteredDeals.length===0?<div style={{textAlign:"center",padding:60,color:"#9CA3AF",background:"#fff",borderRadius:12}}><div style={{fontSize:40}}>📭</div><p>{statusTab==="All"?"No deals yet.":"No deals with this status."}</p>{statusTab==="All"&&<Btn onClick={()=>setTab("inventory")}>Browse Inventory</Btn>}</div>:
        <div style={{display:"flex",flexDirection:"column",gap:12}}>{filteredDeals.map(d=>{const cfg=SC[d.status]||{color:"#6B7280"};const canApp=d.vehicle_available&&d.status==="Request";const availDt=d.vehicle_available_at?new Date(d.vehicle_available_at).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):null;return <div key={d.id} style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 6px rgba(0,0,0,0.07)",borderLeft:`4px solid ${cfg.color}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
            <div><div style={{fontWeight:700,fontSize:15}}>{d.customer_name}</div><div style={{color:"#6B7280",fontSize:13,marginTop:2}}>{d.vehicle_desc} · Stock #{d.stock_num}</div><div style={{color:"#9CA3AF",fontSize:12,marginTop:4}}>Deal #{d.deal_number} · {d.request_date}</div>{d.vehicle_available&&<div style={{marginTop:6}}><span style={{display:"inline-block",background:"#D1FAE5",color:"#065F46",fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:10}}>✓ Vehicle Confirmed Available</span>{availDt&&<span style={{fontSize:11,color:"#6B7280",marginLeft:8}}>as of {availDt}</span>}{d.invoice_name&&<span style={{marginLeft:8}}><InvoiceChip deal={d}/></span>}</div>}{d.status==="Request"&&!d.vehicle_available&&<div style={{marginTop:6,background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,padding:"6px 12px",fontSize:12,color:"#92400E",display:"inline-block"}}>⏳ Awaiting availability confirmation</div>}</div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}><SBadge status={d.status}/><Btn size="sm" variant="outline" onClick={()=>setDealModal({dn:d.deal_number,tab:"overview"})}>Open deal</Btn>{canApp&&<Btn size="sm" variant="success" onClick={()=>setShowApp(d.deal_number)}>Submit Credit App →</Btn>}{d.status==="Request"&&!d.vehicle_available&&<span style={{fontSize:11,color:"#9CA3AF"}}>Credit app locked</span>}{(d.status==="Request"?!!d.vehicle_available:d.status!=="Dead"&&(!!d.assigned_to||d.status==="Declined"))&&<button onClick={()=>window.dispatchEvent(new CustomEvent("open-chat",{detail:{dealNumber:d.deal_number}}))} style={{background:"#1D4ED8",border:"none",borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>💬 Message</button>}{(d.doc_summary&&d.doc_summary.requested>0)&&<button onClick={()=>setDealModal({dn:d.deal_number,tab:"docs"})} style={{background:d.doc_summary.received<d.doc_summary.requested?"#DC2626":"#059669",border:"none",borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>📎 Documents ({d.doc_summary.received}/{d.doc_summary.requested}){d.doc_summary.rejected>0?' · '+d.doc_summary.rejected+' rejected':''}</button>}</div>
          </div>
          
        </div>;})}
        </div>}
      </>}
    </div>
    {dealModal&&<BrokerDealModal dealNumber={dealModal.dn} startTab={dealModal.tab} deal={deals.find(x=>x.deal_number===dealModal.dn)} onClose={()=>setDealModal(null)} onRefresh={loadDeals}/>}{showProf&&<Modal title="My Account" onClose={()=>setSP(false)}><div style={{background:"#F8FAFC",borderRadius:10,padding:16,marginBottom:20}}><div style={{fontWeight:700,fontSize:16}}>{broker.company_name}</div><div style={{fontSize:13,color:"#6B7280",marginTop:2}}>{broker.broker_code} · {broker.username}</div></div><h4 style={{margin:"0 0 16px",fontSize:14,fontWeight:700,color:"#374151",textTransform:"uppercase"}}>Contact Info</h4><div style={{display:"flex",gap:16,flexWrap:"wrap"}}><Inp half label="Contact Name" value={profForm.contact_name} onChange={v=>setPF(p=>({...p,contact_name:v}))}/><Inp half label="Email" value={profForm.email} onChange={v=>setPF(p=>({...p,email:v}))} type="email"/><Inp half label="Phone" value={profForm.phone} onChange={v=>setPF(p=>({...p,phone:v}))} placeholder="718-555-0000"/></div><Btn onClick={saveProfForm} loading={loading} style={{marginBottom:24}}>Save</Btn><h4 style={{margin:"0 0 16px",fontSize:14,fontWeight:700,color:"#374151",textTransform:"uppercase",borderTop:"1px solid #E5E7EB",paddingTop:20}}>Change Password</h4><Inp label="Current Password" value={pw.current_password} onChange={v=>setPW(p=>({...p,current_password:v}))} type="password"/><div style={{display:"flex",gap:16,flexWrap:"wrap"}}><Inp half label="New Password" value={pw.new_password} onChange={v=>setPW(p=>({...p,new_password:v}))} type="password" hint="Min 8"/><Inp half label="Confirm" value={pw.confirm_password} onChange={v=>setPW(p=>({...p,confirm_password:v}))} type="password"/></div><div style={{display:"flex",gap:12}}><Btn onClick={savePW} loading={loading} disabled={!pw.current_password||pw.new_password.length<8||pw.new_password!==pw.confirm_password}>Update Password</Btn><Btn variant="outline" onClick={()=>setSP(false)}>Close</Btn></div></Modal>}
    {showReq&&sel&&(()=>{const v=inv.find(x=>x.vin===sel);return <Modal title="Request Vehicle" onClose={()=>setShowReq(false)}><div style={{background:"#F8FAFC",borderRadius:10,padding:16,marginBottom:20}}><div style={{fontWeight:700}}>{v.year_make_model} — {v.trim}</div><div style={{fontSize:13,color:"#6B7280"}}>Stock #{v.stock_num} · {v.exterior_color} · {v.msrp}</div></div><Inp label="Customer Full Name" value={req.customer_name} onChange={val=>setReq(p=>({...p,customer_name:val}))} required/><Inp label="Phone" value={req.customer_phone} onChange={val=>setReq(p=>({...p,customer_phone:val}))} placeholder="718-555-0000"/><Inp label="Email" value={req.customer_email} onChange={val=>setReq(p=>({...p,customer_email:val}))} type="email"/><Inp label="Notes for Brooklyn CDJR (optional)" value={req.notes} onChange={val=>setReq(p=>({...p,notes:val}))} type="textarea" placeholder="Trade-in, timing, anything we should know. Once your credit app is claimed you can chat with us in Messages."/><div style={{display:"flex",gap:12,justifyContent:"flex-end"}}><Btn variant="outline" onClick={()=>setShowReq(false)}>Cancel</Btn><Btn onClick={submitReq} loading={loading} disabled={!req.customer_name}>Submit Request</Btn></div></Modal>;})()}
    {showApp&&<Modal title="Credit Application" onClose={()=>setShowApp(null)} wide><div style={{background:"#ECFDF5",border:"2px solid #10B981",borderRadius:10,padding:14,marginBottom:20}}><div style={{fontWeight:700,color:"#065F46"}}>✓ Vehicle confirmed — complete the application below</div></div><CreditAppForm onSubmit={submitApp} onCancel={()=>setShowApp(null)} loading={loading}/></Modal>}
    {toast&&<Toast {...toast}/>}
  </div>;
}

function AdminPortal({user,onLogout}){
  const[tab,setTab]=useState("dashboard"),[deals,setDeals]=useState([]),[inv,setInv]=useState([]),[brokers,setBrokers]=useState([]),[admins,setAdmins]=useState([]),[toast,setToast]=useState(null),[loading,setL]=useState(false);
  const[viewMode,setViewMode]=useState((()=>{const v=localStorage.getItem('admin_view');return v==='mine'?'me':(v||'all');})());
  const[reassign,setReassign]=useState(null),[rsNotify,setRsNotify]=useState(true),[rsMsg,setRsMsg]=useState(''),[rsBusy,setRsBusy]=useState(false);
  const[selTab,setSelTab]=useState(null);
  const[sf,setSF]=useState("All"),[bf,setBF]=useState("All"),[bs,setBS]=useState(""),[gs,setGS]=useState(""),[selDeal,setSelDeal]=useState(null),[selBroker,setSelBroker]=useState(null),[resetBroker,setResetBroker]=useState(null);
  const[sab,setSAB]=useState(false),[saa,setSAA]=useState(false),[csv,setCSV]=useState(null),[invSearch,setIS]=useState("");
  const[nb,setNB]=useState({company_name:"",contact_name:"",email:"",phone:"",username:"",password:""});
  const[na,setNA]=useState({username:"",name:"",email:"",password:"",confirm_password:"",notify_email:true});
  const[pf,setPF]=useState({name:user.name||"",email:user.email||"",current_password:"",new_password:"",confirm_password:""});
  const[rpw,setRPW]=useState({broker_code:"",new_password:""});
  function t2(msg,type="success"){setToast({msg,type});setTimeout(()=>setToast(null),3500);}
  const loadDeals=useCallback(async(quiet)=>{try{const p=new URLSearchParams();if(sf!=="All")p.set("status",sf);if(bf!=="All")p.set("broker_id",bf);if(gs)p.set("search",gs);if(viewMode!=='all')p.set('assigned',viewMode);const list=await apiFetch(`deals?${p}`);setDeals(list);setSelDeal(q=>q?(list.find(d=>d.deal_number===q.deal_number)||q):q);}catch(e){if(quiet!==true)t2(e.message,"error");}},[sf,bf,gs,viewMode,user.id]);
  const loadInv=useCallback(async(quiet)=>{try{setInv(await apiFetch("inventory"));}catch(e){if(quiet!==true)t2(e.message,"error");}},[]);
  const loadBrokers=useCallback(async(quiet)=>{try{setBrokers(await apiFetch("brokers"));}catch(e){if(quiet!==true)t2(e.message,"error");}},[]);
  const loadAdmins=useCallback(async()=>{try{setAdmins(await apiFetch("admins"));}catch(e){t2(e.message,"error");}},[]);
  useEffect(()=>{loadDeals();},[loadDeals]);
  useLive(['deals','events','msgs'],()=>{loadDeals(true);});
  useLive(['deals','events'],()=>{if(tab==="brokers"||tab==="dashboard")loadBrokers(true);});
  useLive(['inv','deals'],()=>{if(tab==="inventory")loadInv(true);});
  useEffect(()=>{if(tab==="inventory")loadInv();},[tab,loadInv]);
  useEffect(()=>{if(tab==="brokers"||tab==="dashboard")loadBrokers();},[tab,loadBrokers]);
  useEffect(()=>{if(tab==="settings")loadAdmins();},[tab,loadAdmins]);
  useEffect(()=>{if(selDeal)loadAdmins();},[selDeal&&selDeal.deal_number]);
  useEffect(()=>{loadAdmins();},[loadAdmins]);
  const stats=useMemo(()=>{const total=deals.length,apps=deals.filter(d=>["Application","Approved","All Docs In","eDocs Sent","Docs Sent","Ready to Pick Up","Completed"].includes(d.status)).length,approved=deals.filter(d=>["Approved","All Docs In","eDocs Sent","Docs Sent","Ready to Pick Up","Completed"].includes(d.status)).length,sold=deals.filter(d=>d.status==="Completed").length;return{total,apps,approved,sold,appRate:total?Math.round(apps/total*100):0,closeRate:total?Math.round(sold/total*100):0};},[deals]);
  const filteredBrokers=useMemo(()=>bs?brokers.filter(b=>b.company_name.toLowerCase().includes(bs.toLowerCase())||b.broker_code.toLowerCase().includes(bs.toLowerCase())):brokers,[brokers,bs]);
  function patchDeal(dn,patch){setDeals(p=>p.map(d=>d.deal_number===dn?{...d,...patch}:d));if(selDeal?.deal_number===dn)setSelDeal(p=>({...p,...patch}));}
  async function updateStatus(dn,s,extra){try{const r=await apiFetch("deals?action=status",{method:"PUT",body:{deal_number:dn,status:s,...(extra||{})}});t2(r&&r.car&&r.car.card?`Moved to ${s} and added to Get Ready`:r&&r.car&&r.car.error?`Moved to ${s}. Get Ready: ${r.car.error}`:`Moved to ${s}${s==="Declined"&&r&&r.notified?". The broker was notified.":""}`,r&&r.car&&r.car.error?"error":"success");setDeals(p=>p.map(d=>d.deal_number===dn?{...d,status:s}:d));if(selDeal?.deal_number===dn)setSelDeal(p=>({...p,status:s}));}catch(e){t2(e.message,"error");}}
  const viewToggle=<select value={viewMode} onChange={e=>{setViewMode(e.target.value);localStorage.setItem('admin_view',e.target.value);}} title='Choose whose deals to show' style={{padding:'8px 12px',borderRadius:10,border:'1.5px solid #D1D5DB',background:'#fff',fontWeight:700,fontSize:13,color:'#1F2937',cursor:'pointer',minWidth:210}}><option value='all'>All deals</option><option value='me'>My deals</option><option value='unassigned'>Unassigned (needs an owner)</option>{admins.filter(a=>String(a.id)!==String(user.id)&&a.email!==user.email).map(a=><option key={a.id} value={String(a.id)}>{a.name}{a.role==='fleet_manager'?' (Fleet Manager)':''}</option>)}</select>;
  async function doAssign(dn,assigneeId,extra){try{const r=await apiFetch('deals?action=assign',{method:'PUT',body:{deal_number:dn,assignee_id:assigneeId,...(extra||{})}});t2(r.message||'Assigned');setSelDeal(d=>d?{...d,assigned_to:r.assigned_to,assigned_to_name:r.assigned_to_name}:d);window.dispatchEvent(new CustomEvent('deal-assigned',{detail:{deal_number:dn,assigned_to:r.assigned_to,assigned_to_name:r.assigned_to_name}}));loadDeals();return true;}catch(e){if(String(e.message).startsWith('REASSIGN_CONFIRM:')){askReassign(dn,assigneeId,String(e.message).slice(17).trim());}else{t2(e.message,'error');}return false;}}
  function askReassign(dn,assigneeId,currentName){const t=assigneeId==='me'?{name:user.name}:(admins.find(a=>String(a.id)===String(assigneeId))||{});setRsNotify(true);setRsMsg('');setReassign({dn,assigneeId,targetName:t.name||'this user',currentName:currentName||(selDeal&&selDeal.assigned_to_name)||'the current owner',broker:(selDeal&&selDeal.broker_name)||(selBroker&&selBroker.company_name)||'the broker'});}
  async function assignDeal(dn,assigneeId){const cur=selDeal&&selDeal.deal_number===dn?selDeal:null;const tid=assigneeId==='me'?user.id:assigneeId;if(cur&&cur.assigned_to&&(!tid||String(cur.assigned_to)!==String(tid))){askReassign(dn,assigneeId,cur.assigned_to_name);return;}await doAssign(dn,assigneeId);}
  async function confirmReassign(){if(!reassign)return;setRsBusy(true);const okd=await doAssign(reassign.dn,reassign.assigneeId,{confirm_reassign:true,notify_broker:rsNotify,message:rsNotify?rsMsg.trim():''});setRsBusy(false);if(okd)setReassign(null);}
  async function toggleAvailable(dn,curr){try{await apiFetch("deals?action=status",{method:"PUT",body:{deal_number:dn,vehicle_available:!curr}});setDeals(p=>p.map(d=>d.deal_number===dn?{...d,vehicle_available:!curr,vehicle_available_at:!curr?new Date().toISOString():null}:d));if(selDeal?.deal_number===dn)setSelDeal(p=>({...p,vehicle_available:!curr}));t2(!curr?"Vehicle marked available — broker notified!":"Availability removed");}catch(e){t2(e.message,"error");}}
  function parseCSV(text){const rows=[];const lines=text.split(/\r?\n/);function parseLine(line){const result=[];let cur="",inQ=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else{inQ=!inQ;}}else if(ch===","&&!inQ){result.push(cur.trim());cur="";}else{cur+=ch;}}result.push(cur.trim());return result;}const headers=parseLine(lines[0]);for(let i=1;i<lines.length;i++){if(!lines[i].trim())continue;const vals=parseLine(lines[i]);if(vals.length<2)continue;const obj={};headers.forEach((h,j)=>{obj[h]=vals[j]||"";});rows.push(obj);}return{headers,rows};}
  function handleCSV(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const{headers,rows}=parseCSV(ev.target.result);setCSV({headers,rows,fileName:f.name});};r.readAsText(f);}
  async function confirmImport(){setL(true);try{const r=await apiFetch("inventory",{method:"POST",body:{rows:csv.rows}});setCSV(null);t2(`✓ ${r.inserted} vehicles imported`);loadInv();}catch(e){t2(e.message,"error");}finally{setL(false);}}
  async function addBroker(){if(!nb.company_name)return;setL(true);try{const r=await apiFetch("brokers",{method:"POST",body:nb});t2(`${r.company_name} added — Login: ${r.username} / ${r.default_pass}`);setNB({company_name:"",contact_name:"",email:"",phone:"",username:"",password:""});setSAB(false);loadBrokers();}catch(e){t2(e.message,"error");}finally{setL(false);}}
  async function addAdmin(){if(!na.username||!na.email||na.password.length<8)return;setL(true);try{await apiFetch("admins",{method:"POST",body:na});t2("Admin created");setNA({username:"",name:"",email:"",password:"",confirm_password:"",notify_email:true});setSAA(false);loadAdmins();}catch(e){t2(e.message,"error");}finally{setL(false);}}
  async function doResetBrokerPW(){if(!rpw.new_password||rpw.new_password.length<6)return;setL(true);try{await apiFetch("brokers",{method:"PUT",body:{broker_code:rpw.broker_code,new_password:rpw.new_password}});t2("Password reset!");setRPW({broker_code:"",new_password:""});setResetBroker(null);}catch(e){t2(e.message,"error");}finally{setL(false);}}
  async function toggleNotify(admin){try{await apiFetch("admins",{method:"PUT",body:{admin_id:admin.id,notify_email:!admin.notify_email}});t2("Updated");loadAdmins();}catch(e){t2(e.message,"error");}}
  const TAB=(k,l)=><button onClick={()=>setTab(k)} style={{padding:"12px 20px",border:"none",cursor:"pointer",fontWeight:600,fontSize:14,background:"none",borderBottom:tab===k?"3px solid #1D4ED8":"3px solid transparent",color:tab===k?"#1D4ED8":"#6B7280",transition:"all 0.15s"}}>{l}</button>;
  return <div style={{minHeight:"100vh",background:"#F1F5F9",fontFamily:"system-ui,-apple-system,sans-serif"}}>
    <div className="navy-keep" style={{background:"#0F172A",padding:"0 28px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px 0"}}><BrooklynMark height={42}/><div><div style={{marginBottom:3}}><BrooklynWordmark height={15}/></div><div style={{color:"#93C5FD",fontSize:12,letterSpacing:"0.05em"}}>ADMIN PORTAL</div></div></div>
      <div style={{display:"flex",alignItems:"center",gap:12}}><NotificationsBell onOpenDeal={(d,t)=>{setSelTab(({new_request:"status",credit_app:"credit",assigned:"assignment",reassigned:"assignment",docs_uploaded:"docs",docs_complete:"docs",note:"notes",porter_note:"car"})[t]||null);setSelDeal(d);}}/><button onClick={()=>setTab("settings")} style={{background:"none",border:"none",cursor:"pointer",textAlign:"right"}}><div style={{color:"#fff",fontSize:13,fontWeight:600}}>{user.name}{user.adminRole==="fleet_manager"&&<span style={{marginLeft:6,fontSize:10,background:"#FEF3C7",color:"#92400E",padding:"1px 6px",borderRadius:8}}>FLEET MANAGER</span>}</div><div style={{color:"#93C5FD",fontSize:11}}>{user.email}</div></button><ThemeToggle/><Btn variant="outline" size="sm" onClick={onLogout} style={{borderColor:"#334155",color:"#94A3B8"}}>Sign Out</Btn></div>
    </div>
    <div style={{background:"#fff",borderBottom:"1px solid #E5E7EB",padding:"0 28px",display:"flex",gap:4,overflowX:"auto"}}>{TAB("dashboard","📊 Dashboard")}{TAB("pipeline","🔄 Pipeline")}{TAB("inventory","🚘 Inventory")}{TAB("getready","🧰 Get Ready")}{TAB("brokers","👥 Brokers")}{TAB("settings","⚙️ Settings")}</div>
    <div style={{maxWidth:1200,margin:"0 auto",padding:"28px 20px"}}>
      {tab==="dashboard"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,marginBottom:20}}><h2 style={{margin:0,fontSize:22,fontWeight:800}}>Overview</h2>{viewToggle}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16,marginBottom:28}}><Card label="Total Requests" value={stats.total} accent="#3B82F6" sub="All time"/><Card label="Applications" value={stats.apps} accent="#F59E0B" sub={`${stats.appRate}% of requests`}/><Card label="Approved" value={stats.approved} accent="#8B5CF6" sub="Approved or further"/><Card label="Completed" value={stats.sold} accent="#10B981" sub={`${stats.closeRate}% close rate`}/></div>
        <div style={{background:"#fff",borderRadius:14,padding:24,marginBottom:24,boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}><h3 style={{margin:"0 0 16px",fontSize:16,fontWeight:700}}>Pipeline by Status</h3><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{ADMIN_STATUSES.map(s=>{const count=deals.filter(d=>d.status===s).length;const cfg=SC[s]||{color:"#6B7280",bg:"#F9FAFB"};return <div key={s} onClick={()=>{setSF(s);setTab("pipeline");}} style={{flex:"1 1 120px",background:s==="Approved"?"#DC2626":cfg.bg,borderRadius:10,padding:"14px 16px",border:`2px solid ${cfg.color}30`,minWidth:100,cursor:"pointer",transition:"all 0.15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=cfg.color} onMouseLeave={e=>e.currentTarget.style.borderColor=`${cfg.color}30`}><div style={{fontSize:24,fontWeight:800,color:s==="Approved"?"#fff":cfg.color}}>{count}</div><div style={{fontSize:12,fontWeight:600,color:s==="Approved"?"#fff":"#374151",marginTop:2}}>{sLabel(s)}</div></div>;})}</div></div>
        <div style={{background:"#fff",borderRadius:14,padding:24,boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{margin:0,fontSize:16,fontWeight:700}}>Top Brokers</h3><Btn size="sm" variant="ghost" onClick={()=>setTab("brokers")}>View All →</Btn></div><table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}><thead><tr style={{color:"#9CA3AF",fontSize:11,textTransform:"uppercase"}}>{["Broker","Req","Apps","Appr","Done","Close %",""].map(h=><th key={h} style={{textAlign:"left",padding:"0 0 10px",fontWeight:600}}>{h}</th>)}</tr></thead><tbody>{brokers.slice(0,5).map(b=>{const req=parseInt(b.total_requests)||0,sold=parseInt(b.total_sold)||0,cr=req?Math.round(sold/req*100):0;return <tr key={b.id} style={{borderTop:"1px solid #F3F4F6",cursor:"pointer"}} onClick={()=>setSelBroker(b)} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background=""}><td style={{padding:"12px 0",fontWeight:600,color:"#1D4ED8",textDecoration:"underline"}}>{b.company_name}</td><td style={{padding:"12px 0",color:"#3B82F6",fontWeight:700}}>{req}</td><td style={{padding:"12px 0",color:"#F59E0B",fontWeight:700}}>{parseInt(b.total_apps)||0}</td><td style={{padding:"12px 0",color:"#8B5CF6",fontWeight:700}}>{parseInt(b.total_approved)||0}</td><td style={{padding:"12px 0",color:"#10B981",fontWeight:700}}>{sold}</td><td style={{padding:"12px 0"}}><span style={{fontWeight:700,color:cr>=50?"#10B981":cr>=20?"#F59E0B":"#EF4444"}}>{cr}%</span></td><td style={{padding:"12px 0",color:"#6B7280",fontSize:12}}>View →</td></tr>;})}</tbody></table></div>
      </>}
      {tab==="pipeline"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:12}}>
          <h2 style={{margin:0,fontSize:22,fontWeight:800}}>Deal Pipeline</h2>{viewToggle}
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
            <div style={{position:"relative"}}><input value={gs} onChange={e=>setGS(e.target.value)} placeholder="🔍 Search…" style={{padding:"9px 14px",borderRadius:8,border:"1.5px solid #D1D5DB",fontSize:14,outline:"none",width:240}}/>{gs&&<button onClick={()=>setGS("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",fontSize:16}}>✕</button>}</div>
            <select value={sf} onChange={e=>setSF(e.target.value)} style={{padding:"8px 12px",borderRadius:8,border:"1.5px solid #D1D5DB",fontSize:14,background:"#fff"}}><option value="All">All Statuses</option>{ADMIN_STATUSES.map(s=><option key={s} value={s}>{sLabel(s)}</option>)}</select>
            <div><div style={{fontSize:11,fontWeight:600,color:"#374151",marginBottom:3}}>Broker</div><div style={{display:"flex",gap:0}}><input value={bs} onChange={e=>{setBS(e.target.value);if(!e.target.value)setBF("All");}} placeholder="Search broker…" style={{padding:"8px 12px",borderRadius:"8px 0 0 8px",border:"1.5px solid #D1D5DB",borderRight:"none",fontSize:14,outline:"none",width:150}}/><select value={bf} onChange={e=>{setBF(e.target.value);setBS(brokers.find(b=>b.id.toString()===e.target.value)?.company_name||"");}} style={{padding:"8px 8px",borderRadius:"0 8px 8px 0",border:"1.5px solid #D1D5DB",fontSize:13,background:"#fff",minWidth:40}}><option value="All">All</option>{filteredBrokers.map(b=><option key={b.id} value={b.id}>{b.company_name}</option>)}</select></div></div>
            {(sf!=="All"||bf!=="All"||gs)&&<Btn size="sm" variant="ghost" onClick={()=>{setSF("All");setBF("All");setGS("");setBS("");}}>Clear</Btn>}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {deals.length===0&&<div style={{textAlign:"center",padding:50,color:"#9CA3AF",background:"#fff",borderRadius:12}}>No deals found.</div>}
          {deals.map(deal=>{const cfg=SC[deal.status]||{color:"#6B7280"};return <div key={deal.id} onClick={()=>setSelDeal(deal)} style={{background:"#fff",borderRadius:12,padding:"16px 20px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",borderLeft:`4px solid ${cfg.color}`,border:`1px solid #E5E7EB`,borderLeftWidth:4,borderLeftColor:cfg.color,transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.12)";e.currentTarget.style.transform="translateY(-1px)";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";e.currentTarget.style.transform="";}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
              <div><div style={{fontWeight:700,fontSize:15}}>{deal.customer_name} <span style={{fontSize:12,color:"#9CA3AF",fontWeight:400}}>· #{deal.deal_number}</span></div><div style={{color:"#6B7280",fontSize:13,marginTop:2}}>{deal.vehicle_desc} · Stock #{deal.stock_num}</div><div style={{fontSize:12,color:"#9CA3AF",marginTop:2}}><span style={{fontWeight:600,color:"#374151"}}>{deal.broker_name}</span>{" "}<MessageBrokerButton deal={deal} small/>{deal.broker_user_name&&<span style={{color:"#1D4ED8"}}> ({deal.broker_user_name})</span>} · {deal.request_date}{deal.assigned_to_name&&<span style={{marginLeft:8,color:"#1D4ED8",fontWeight:600}}>· 👤 {deal.assigned_to_name}</span>}{deal.doc_summary&&deal.doc_summary.requested>0&&<span style={{marginLeft:8,color:deal.doc_summary.received<deal.doc_summary.requested?"#DC2626":"#059669",fontWeight:600}}>· 📎 {deal.doc_summary.received}/{deal.doc_summary.requested} docs{deal.doc_summary.awaiting>0?' · '+deal.doc_summary.awaiting+' to review':''}{deal.doc_summary.rejected>0?' · '+deal.doc_summary.rejected+' rejected':''}</span>}</div></div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>{deal.vehicle_available&&<span style={{fontSize:11,background:"#D1FAE5",color:"#065F46",padding:"2px 8px",borderRadius:10,fontWeight:600}}>✓ Available</span>}<SBadge status={deal.status}/><span style={{color:"#1D4ED8",fontSize:12,fontWeight:600}}>Open →</span></div>
            </div>
          </div>;})}
        </div>
      </>}
      {tab==="brokers"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{margin:0,fontSize:22,fontWeight:800}}>Broker Leaderboard</h2><Btn onClick={()=>setSAB(true)}>+ Add Broker</Btn></div>
        <div style={{background:"#fff",borderRadius:14,overflow:"auto",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}><thead style={{background:"#F8FAFC"}}><tr>{["#","Company","Username","Contact","ID","Req","Apps","Appr","Done","Close %","Rating",""].map(h=><th key={h} style={{textAlign:"left",padding:"14px 12px",fontWeight:700,fontSize:11,textTransform:"uppercase",color:"#6B7280",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{brokers.map((b,i)=>{const req=parseInt(b.total_requests)||0,sold=parseInt(b.total_sold)||0,cr=req?Math.round(sold/req*100):0;const rating=cr>=50?{l:"🔥 Hot",c:"#10B981"}:cr>=25?{l:"✅ Good",c:"#3B82F6"}:req===0?{l:"— No deals",c:"#9CA3AF"}:{l:"⚠️ Low",c:"#EF4444"};return <tr key={b.id} style={{borderTop:"1px solid #F3F4F6",cursor:"pointer",opacity:b.active?1:0.5}} onClick={()=>setSelBroker(b)} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background=""}><td style={{padding:"12px"}}>{i+1}</td><td style={{padding:"12px"}}><div style={{fontWeight:700,color:"#1D4ED8",textDecoration:"underline"}}>{b.company_name}</div><div style={{fontSize:11,color:"#9CA3AF"}}>{b.email}</div></td><td style={{padding:"12px"}}><code style={{fontSize:12,background:"#F3F4F6",padding:"2px 6px",borderRadius:4}}>{b.username}</code></td><td style={{padding:"12px",color:"#374151"}}>{b.contact_name}</td><td style={{padding:"12px"}}><code style={{fontSize:12,background:"#F3F4F6",padding:"2px 6px",borderRadius:4}}>{b.broker_code}</code></td><td style={{padding:"12px",color:"#3B82F6",fontWeight:700}}>{req}</td><td style={{padding:"12px",color:"#F59E0B",fontWeight:700}}>{parseInt(b.total_apps)||0}</td><td style={{padding:"12px",color:"#8B5CF6",fontWeight:700}}>{parseInt(b.total_approved)||0}</td><td style={{padding:"12px",color:"#10B981",fontWeight:700}}>{sold}</td><td style={{padding:"12px"}}><span style={{fontWeight:800,fontSize:16,color:rating.c}}>{cr}%</span></td><td style={{padding:"12px"}}><span style={{fontWeight:600,color:rating.c,fontSize:12}}>{rating.l}</span></td><td style={{padding:"12px",color:"#1D4ED8",fontWeight:600,fontSize:12}}>View →</td></tr>;})} </tbody></table></div>
        {sab&&<Modal title="Add New Broker" onClose={()=>setSAB(false)} wide><div style={{display:"flex",gap:16,flexWrap:"wrap"}}><Inp half label="Company Name" value={nb.company_name} onChange={v=>setNB(p=>({...p,company_name:v}))} required/><Inp half label="Contact" value={nb.contact_name} onChange={v=>setNB(p=>({...p,contact_name:v}))}/><Inp half label="Email" value={nb.email} onChange={v=>setNB(p=>({...p,email:v}))} type="email"/><Inp half label="Phone" value={nb.phone} onChange={v=>setNB(p=>({...p,phone:v}))}/><Inp half label="Username" value={nb.username} onChange={v=>setNB(p=>({...p,username:v}))} hint="Leave blank to auto-generate"/><Inp half label="Temp Password" value={nb.password} onChange={v=>setNB(p=>({...p,password:v}))} type="password" hint="Leave blank → Brooklyn2024!"/></div><div style={{display:"flex",gap:12,justifyContent:"flex-end"}}><Btn variant="outline" onClick={()=>setSAB(false)}>Cancel</Btn><Btn onClick={addBroker} loading={loading} disabled={!nb.company_name}>Add Broker</Btn></div></Modal>}
      </>}
      {tab==="inventory"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}><h2 style={{margin:0,fontSize:22,fontWeight:800}}>Inventory <span style={{fontSize:15,color:"#6B7280",fontWeight:400}}>({inv.length} vehicles)</span></h2><div style={{display:"flex",gap:10,alignItems:"center"}}><input value={invSearch} onChange={e=>setIS(e.target.value)} placeholder="Search..." style={{padding:"9px 14px",borderRadius:8,border:"1.5px solid #D1D5DB",fontSize:14,outline:"none"}}/><label style={{background:"#1D4ED8",color:"#fff",padding:"10px 18px",borderRadius:8,fontSize:14,fontWeight:700,cursor:"pointer"}}>📂 Upload CSV<input type="file" accept=".csv" style={{display:"none"}} onChange={handleCSV}/></label></div></div>
        {csv&&<div style={{background:"#ECFDF5",border:"2px solid #10B981",borderRadius:12,padding:20,marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:700,color:"#065F46"}}>📄 {csv.fileName}</div><div style={{fontSize:13,color:"#047857"}}>{csv.rows.length} vehicles detected</div></div><div style={{display:"flex",gap:10}}><Btn variant="outline" size="sm" onClick={()=>setCSV(null)}>Cancel</Btn><Btn variant="success" onClick={confirmImport} loading={loading}>✓ Confirm Import</Btn></div></div></div>}
        <div style={{background:"#fff",borderRadius:14,overflow:"auto",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead style={{background:"#F8FAFC"}}><tr>{["Stock #","VIN","Year/Make/Model","Trim","Status","MSRP","Exterior","Age"].map(h=><th key={h} style={{textAlign:"left",padding:"12px 14px",fontWeight:700,fontSize:11,textTransform:"uppercase",color:"#6B7280",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{inv.filter(v=>invSearch===""||v.year_make_model?.toLowerCase().includes(invSearch.toLowerCase())||v.stock_num?.toLowerCase().includes(invSearch.toLowerCase())||v.vin?.toLowerCase().includes(invSearch.toLowerCase())).map(v=><tr key={v.vin} style={{borderTop:"1px solid #F3F4F6"}}><td style={{padding:"11px 14px",fontWeight:700}}>{v.stock_num}</td><td style={{padding:"11px 14px",fontFamily:"monospace",fontSize:12,color:"#6B7280"}}>{v.vin}</td><td style={{padding:"11px 14px",fontWeight:600}}>{v.year_make_model}</td><td style={{padding:"11px 14px",color:"#6B7280"}}>{v.trim}</td><td style={{padding:"11px 14px"}}><SBadge status={v.inv_status}/></td><td style={{padding:"11px 14px",fontWeight:600}}>{v.msrp}</td><td style={{padding:"11px 14px",color:"#6B7280"}}>{v.exterior_color}</td><td style={{padding:"11px 14px",fontWeight:700,color:v.age_days>60?"#EF4444":v.age_days>30?"#F59E0B":"#374151"}}>{v.age_days}</td></tr>)}</tbody></table></div>
      </>}
      {tab==="getready"&&<GetReadyAdmin onOpenDeal={dn=>{const d=deals.find(x=>x.deal_number===dn);if(d){setSelTab("car");setSelDeal(d);}else t2("Open that deal from the Pipeline");}}/>}
      {tab==="settings"&&<>
        <h2 style={{margin:"0 0 24px",fontSize:22,fontWeight:800}}>Settings</h2>
        <div style={{background:"#fff",borderRadius:14,padding:24,boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:20}}><h3 style={{margin:"0 0 20px",fontSize:16,fontWeight:700}}>My Profile</h3><div style={{display:"flex",gap:16,flexWrap:"wrap"}}><Inp half label="Full Name" value={pf.name} onChange={v=>setPF(p=>({...p,name:v}))}/><Inp half label="Email" value={pf.email} onChange={v=>setPF(p=>({...p,email:v}))} type="email"/></div><h4 style={{margin:"8px 0 16px",fontSize:14,fontWeight:700,color:"#374151"}}>Change Password</h4><div style={{display:"flex",gap:16,flexWrap:"wrap"}}><Inp half label="Current Password" value={pf.current_password} onChange={v=>setPF(p=>({...p,current_password:v}))} type="password"/><Inp half label="New Password" value={pf.new_password} onChange={v=>setPF(p=>({...p,new_password:v}))} type="password" hint="Min 8"/><Inp half label="Confirm" value={pf.confirm_password} onChange={v=>setPF(p=>({...p,confirm_password:v}))} type="password"/></div><Btn onClick={async()=>{setL(true);try{await apiFetch("admins",{method:"PUT",body:pf});t2("Profile updated");setPF(p=>({...p,current_password:"",new_password:"",confirm_password:""}));}catch(e){t2(e.message,"error");}finally{setL(false);}}} loading={loading}>Save Changes</Btn></div>
        <div style={{background:"#fff",borderRadius:14,padding:24,boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{margin:0,fontSize:16,fontWeight:700}}>Admin Accounts & Notifications</h3>{user.adminRole!=="fleet_manager"&&<Btn size="sm" onClick={()=>setSAA(true)}>+ Add User</Btn>}</div><p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>Toggle 🔔 to control who gets emailed on new requests and credit apps.</p><table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}><thead><tr style={{color:"#9CA3AF",fontSize:11,textTransform:"uppercase"}}>{["Name","Username","Role","Email","Alerts","Created"].map(h=><th key={h} style={{textAlign:"left",padding:"0 0 10px",fontWeight:600}}>{h}</th>)}</tr></thead><tbody>{admins.map(a=><tr key={a.id} style={{borderTop:"1px solid #F3F4F6"}}><td style={{padding:"12px 0",fontWeight:600}}>{a.name}</td><td style={{padding:"12px 0"}}><code style={{fontSize:12,background:"#F3F4F6",padding:"2px 6px",borderRadius:4}}>{a.username}</code></td><td style={{padding:"12px 0"}}><span style={{fontSize:12,fontWeight:700,padding:"2px 10px",borderRadius:10,background:a.role==="fleet_manager"?"#FEF3C7":"#DBEAFE",color:a.role==="fleet_manager"?"#92400E":"#1E40AF"}}>{a.role==="fleet_manager"?"Fleet Manager":"Admin"}</span></td><td style={{padding:"12px 0",color:"#6B7280"}}>{a.email}</td><td style={{padding:"12px 0"}}><button onClick={()=>toggleNotify(a)} style={{background:a.notify_email?"#ECFDF5":"#F9FAFB",border:`2px solid ${a.notify_email?"#10B981":"#D1D5DB"}`,borderRadius:8,padding:"4px 12px",cursor:"pointer",fontWeight:700,fontSize:12,color:a.notify_email?"#065F46":"#9CA3AF"}}>{a.notify_email?"🔔 On":"🔕 Off"}</button></td><td style={{padding:"12px 0",color:"#9CA3AF",fontSize:12}}>{a.created_at?.split("T")[0]}</td></tr>)}</tbody></table></div>
        {saa&&<Modal title="Add User" onClose={()=>setSAA(false)}><Inp label="Role" value={na.role||"Admin"} onChange={v=>setNA(p=>({...p,role:v}))} options={["Admin","Fleet Manager"]}/><Inp label="Full Name" value={na.name} onChange={v=>setNA(p=>({...p,name:v}))} required/><Inp label="Username" value={na.username} onChange={v=>setNA(p=>({...p,username:v}))} required/><Inp label="Email" value={na.email} onChange={v=>setNA(p=>({...p,email:v}))} type="email" required/><Inp label="Password" value={na.password} onChange={v=>setNA(p=>({...p,password:v}))} type="password" required hint="Min 8"/><Inp label="Confirm" value={na.confirm_password} onChange={v=>setNA(p=>({...p,confirm_password:v}))} type="password" required/><div style={{marginBottom:16}}><label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><input type="checkbox" checked={na.notify_email} onChange={e=>setNA(p=>({...p,notify_email:e.target.checked}))} style={{width:16,height:16}}/><span style={{fontSize:14,fontWeight:600}}>Receive deal notifications</span></label></div><div style={{display:"flex",gap:12,justifyContent:"flex-end"}}><Btn variant="outline" onClick={()=>setSAA(false)}>Cancel</Btn><Btn onClick={addAdmin} loading={loading} disabled={!na.username||!na.email||na.password.length<8||na.password!==na.confirm_password}>Create Admin</Btn></div></Modal>}
        <ColumnsAdmin/>
      </>}
    </div>
    {selDeal&&<DealModal key={selDeal.deal_number} deal={selDeal} startTab={selTab} onClose={()=>{setSelDeal(null);setSelTab(null);}} onStatusChange={updateStatus} onDealPatch={patchDeal} onToggleAvailable={toggleAvailable} staff={admins} me={user} onAssign={assignDeal}/>}
    {reassign&&<div style={{position:'relative',zIndex:2000}}><Modal title='Reassign this deal?' onClose={()=>setReassign(null)}>
      <div style={{fontSize:15,color:'#111827',marginBottom:14,lineHeight:1.5}}>Are you sure you want to reassign Deal #{reassign.dn} from <b>{reassign.currentName}</b> to <b>{reassign.targetName}</b>?</div>
      <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:14,marginBottom:12}}><input type='checkbox' checked={rsNotify} onChange={e=>setRsNotify(e.target.checked)} style={{width:16,height:16}}/>Notify the broker ({reassign.broker}) by email and in their chat</label>
      {rsNotify&&<><div style={{fontSize:12,fontWeight:600,color:'#374151',marginBottom:4}}>Add a message for the broker (optional)</div>
      <textarea value={rsMsg} onChange={e=>setRsMsg(e.target.value)} rows={3} maxLength={500} placeholder='For example: Fran is covering while Evan is out today.' style={{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:8,border:'1.5px solid #D1D5DB',fontSize:14,fontFamily:'inherit',resize:'vertical'}}/>
      <div style={{background:'#F8FAFC',border:'1px solid #E5E7EB',borderRadius:8,padding:'10px 12px',fontSize:13,color:'#374151',marginTop:10}}><div style={{fontSize:10,fontWeight:700,color:'#9CA3AF',marginBottom:4}}>THE BROKER WILL SEE</div>Your deal is now being handled by {reassign.targetName}.{rsMsg.trim()?' '+rsMsg.trim():''}</div></>}
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:18}}><Btn variant='outline' onClick={()=>setReassign(null)}>Cancel</Btn><Btn onClick={confirmReassign} loading={rsBusy}>Yes, reassign</Btn></div>
    </Modal></div>}
    {selBroker&&<BrokerModal broker={selBroker} onClose={()=>setSelBroker(null)} onResetPW={b=>{setResetBroker(b);setRPW({broker_code:b.broker_code,new_password:""});setSelBroker(null);}} staff={admins} me={user} onAssign={assignDeal}/>}
    {resetBroker&&<Modal title={`Reset Password — ${resetBroker.company_name}`} onClose={()=>setResetBroker(null)}><div style={{background:"#F8FAFC",borderRadius:10,padding:14,marginBottom:16}}><div style={{fontSize:13}}>ID: <strong>{resetBroker.broker_code}</strong> · <strong>{resetBroker.username}</strong></div></div><Inp label="New Password" value={rpw.new_password} onChange={v=>setRPW(p=>({...p,new_password:v}))} type="password" hint="Min 6"/><div style={{display:"flex",gap:12,justifyContent:"flex-end"}}><Btn variant="outline" onClick={()=>setResetBroker(null)}>Cancel</Btn><Btn onClick={doResetBrokerPW} loading={loading} disabled={rpw.new_password.length<6}>Update</Btn></div></Modal>}
    {toast&&<Toast {...toast}/>}
  </div>;
}

export default function App(){
  const[auth,setAuth]=useState(null),[rt,setRT]=useState(null);
  useEffect(()=>{const params=new URLSearchParams(window.location.search);const token=params.get("reset_token");if(token){setRT(token);return;}const st=localStorage.getItem("auth_token"),role=localStorage.getItem("auth_role");if(!st||!role)return;if(role==="admin"){setAuth({role:"admin",name:localStorage.getItem("auth_name")||"Admin",email:localStorage.getItem("auth_email")||"",id:localStorage.getItem("auth_admin_id")||null,adminRole:localStorage.getItem("auth_admin_role")||"admin"});}else if(role==="porter"){try{setAuth({role:"porter",porter:JSON.parse(localStorage.getItem("auth_porter"))});}catch{localStorage.clear();}}else{try{setAuth({role:"broker",broker:JSON.parse(localStorage.getItem("auth_broker"))});}catch{localStorage.clear();}}},[]);
  function login(d){setAuth(d);}
  function logout(){const t=localStorage.getItem("auth_token"),r=localStorage.getItem("auth_role");if(t)apiFetch(r==="porter"?"porter?action=logout":"auth?action=logout",{method:"POST"}).catch(()=>{});localStorage.clear();setAuth(null);}
  if(rt)return <ResetPage token={rt} onDone={()=>{setRT(null);window.history.replaceState({},"","/");}}/>;
  if(!auth)return <LoginPage onLogin={login}/>;
  if(auth.role==="porter")return <PorterPortal porter={auth.porter} onLogout={logout}/>;
  if(auth.role==="broker")return <><BrokerPortal broker={auth.broker} onLogout={logout}/><ChatWidget/><LivePulse/></>;
  return <><AdminPortal user={auth} onLogout={logout}/><ChatWidget/><LivePulse/></>;
}
