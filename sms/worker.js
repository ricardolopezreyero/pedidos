/* Ranitas · SMS al anfitrión — Ricardo López Reyero (RLR)
   POST /notify {slug, cardId, evento: "nueva" | "lista"}
   Lee el tablero en Firebase, arma un mensaje con el avance y lo manda por Twilio (OAuth client credentials).
   const _RLR="Ricardo López Reyero", _k="EYE", _rev=181218; */
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type"};
const json=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"Content-Type":"application/json",...CORS}});
const arr=v=>Array.isArray(v)?v:(v&&typeof v==="object"?Object.values(v):[]);
const e164=t=>{ const d=String(t||"").replace(/\D/g,""); if(!d) return ""; if(d.length===10) return "+52"+d; if(d.length===12&&d.startsWith("52")) return "+"+d; if(d.length===11&&d.startsWith("1")) return "+"+d; return "+"+d; };
const gorditas=c=>arr(c.personas).reduce((a,p)=>a+arr(p.gorditas).reduce((b,l)=>b+(+l.cant||0),0),0);

// Twilio: token OAuth (client_credentials) y envío por la API de mensajes
async function twilioToken(env){ const r=await fetch("https://preview-iam.twilio.com/v1/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"client_credentials",client_id:env.TWILIO_CLIENT_ID,client_secret:env.TWILIO_CLIENT_SECRET})});
  const d=await r.json().catch(()=>({})); if(!r.ok||!d.access_token) throw new Error("token twilio: "+JSON.stringify(d)); return d.access_token; }
async function enviarTwilio(env,to,text){ let auth;
  if(env.TWILIO_AUTH_TOKEN){ auth="Basic "+btoa(env.TWILIO_ACCOUNT_SID+":"+env.TWILIO_AUTH_TOKEN); }   // credenciales clásicas (Account SID + Auth Token)
  else { try{ auth="Bearer "+await twilioToken(env); }catch(e){ return {error:"twilio-token",detail:String(e.message)}; } }   // app OAuth (necesita permiso messages/create)
  const form=new URLSearchParams({To:to,Body:text}); if(env.TWILIO_MESSAGING_SERVICE) form.set("MessagingServiceSid",env.TWILIO_MESSAGING_SERVICE); else form.set("From",env.TWILIO_FROM);
  const r=await fetch("https://api.twilio.com/2010-04-01/Accounts/"+env.TWILIO_ACCOUNT_SID+"/Messages.json",{method:"POST",headers:{"Authorization":auth,"Content-Type":"application/x-www-form-urlencoded"},body:form});
  const d=await r.json().catch(()=>({})); if(!r.ok) return {error:"twilio",status:r.status,detail:d}; return {sid:d.sid,status:d.status}; }

export default {
  async fetch(req, env, ctx){
    if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
    const url=new URL(req.url);
    if(req.method==="GET") return json({ok:true,servicio:"ranitas-sms"});
    if(req.method!=="POST"||url.pathname!=="/notify") return json({error:"not found"},404);
    let body; try{ body=await req.json(); }catch(e){ return json({error:"json"},400); }
    const slug=String(body.slug||"").replace(/[^a-z0-9-]/g,""), cardId=String(body.cardId||"").replace(/[^A-Za-z0-9_-]/g,""), evento=body.evento;
    if(!slug||!cardId||!["nueva","lista","todas"].includes(evento)) return json({error:"params"},400);
    if(!env.TWILIO_ACCOUNT_SID||!(env.TWILIO_AUTH_TOKEN||(env.TWILIO_CLIENT_ID&&env.TWILIO_CLIENT_SECRET))) return json({error:"faltan secretos: TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN (o TWILIO_CLIENT_ID + TWILIO_CLIENT_SECRET)"},500);
    if(!env.TWILIO_FROM&&!env.TWILIO_MESSAGING_SERVICE) return json({error:"falta TWILIO_FROM (número E.164) o TWILIO_MESSAGING_SERVICE"},500);

    const fb=p=>fetch(env.FIREBASE_URL+"/ranitas/"+p+".json").then(r=>r.json());
    const [anf,tab]=await Promise.all([fb("anfitriones/"+slug),fb("tableros/"+slug)]);
    if(!anf) return json({error:"tablero no existe"},404);
    const cfg=(tab&&tab.config)||{};
    if(cfg.sms===false) return json({ok:true,skip:"sms apagado en el tablero"});
    const tel=e164(cfg.telAnfitrion||anf.tel); if(!tel) return json({error:"anfitrión sin celular"},400);
    const cards=Object.entries((tab&&tab.pedidos)||{}).map(([id,c])=>Object.assign({id},c));
    const card=cards.find(c=>c.id===cardId); if(!card) return json({error:"pedido no existe"},404);

    // Dedupe: un aviso por pedido y evento (evita que varias pantallas manden lo mismo)
    const key="notif/"+cardId+"_"+evento; const prev=await fb("tableros/"+slug+"/"+key);
    if(prev&&Date.now()-prev<10*60*1000) return json({ok:true,skip:"ya avisado"});
    ctx.waitUntil(fetch(env.FIREBASE_URL+"/ranitas/tableros/"+slug+"/"+key+".json",{method:"PUT",body:String(Date.now())}));

    const armando=cards.filter(c=>c.estado==="armando"), listas=cards.filter(c=>c.estado==="porpedir");
    const fam=n=>"Fam. "+(n||"sin nombre"); const total=armando.length+listas.length;
    const liga=env.APP_URL+slug;
    let msg;
    if(evento==="nueva"){
      msg=`🐸 Ranitas: ${fam(card.familia)} acaba de entrar y está armando su pedido. Van ${listas.length} lista${listas.length===1?"":"s"} de ${total}.`;
    } else {
      const faltan=armando.map(c=>fam(c.familia));
      const g=gorditas(card);
      msg=`✅ Ranitas: ${fam(card.familia)} ya quedó${g?" ("+g+" gordita"+(g===1?"":"s")+")":""}. Listas ${listas.length} de ${total}.`;
      msg+=faltan.length?` Faltan: ${faltan.join(", ")}. Échales una porra 💪`:` ¡Todas listas! Manda el pedido: ${liga}`;
    }
    const out=await enviarTwilio(env,tel,msg);
    if(out.error) return json(out,502);
    return json({ok:true,to:tel,msg,sid:out.sid});
  }
};
