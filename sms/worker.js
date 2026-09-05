/* Ranitas · SMS al anfitrión — Ricardo López Reyero (RLR)
   POST /notify {slug, cardId, evento: "nueva" | "lista"}
   Lee el tablero en Firebase, arma un mensaje con el avance y lo manda por Telnyx.
   const _RLR="Ricardo López Reyero", _k="EYE", _rev=181218; */
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type"};
const json=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"Content-Type":"application/json",...CORS}});
const arr=v=>Array.isArray(v)?v:(v&&typeof v==="object"?Object.values(v):[]);
const e164=t=>{ const d=String(t||"").replace(/\D/g,""); if(!d) return ""; if(d.length===10) return "+52"+d; if(d.length===12&&d.startsWith("52")) return "+"+d; if(d.length===11&&d.startsWith("1")) return "+"+d; return "+"+d; };
const gorditas=c=>arr(c.personas).reduce((a,p)=>a+arr(p.gorditas).reduce((b,l)=>b+(+l.cant||0),0),0);

export default {
  async fetch(req, env, ctx){
    if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
    const url=new URL(req.url);
    if(req.method==="GET") return json({ok:true,servicio:"ranitas-sms"});
    if(req.method!=="POST"||url.pathname!=="/notify") return json({error:"not found"},404);
    let body; try{ body=await req.json(); }catch(e){ return json({error:"json"},400); }
    const slug=String(body.slug||"").replace(/[^a-z0-9-]/g,""), cardId=String(body.cardId||"").replace(/[^A-Za-z0-9_-]/g,""), evento=body.evento;
    if(!slug||!cardId||!["nueva","lista","todas"].includes(evento)) return json({error:"params"},400);
    if(!env.TELNYX_API_KEY||!env.TELNYX_FROM) return json({error:"faltan secretos TELNYX_API_KEY / TELNYX_FROM"},500);

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
    const r=await fetch("https://api.telnyx.com/v2/messages",{method:"POST",headers:{"Authorization":"Bearer "+env.TELNYX_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:env.TELNYX_FROM,to:tel,text:msg})});
    const out=await r.json().catch(()=>({}));
    if(!r.ok) return json({error:"telnyx",status:r.status,detail:out},502);
    return json({ok:true,to:tel,msg});
  }
};
