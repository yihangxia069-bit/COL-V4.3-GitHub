const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"Content-Type":"application/json; charset=utf-8", ...cors}
  });
}

function base(env) {
  return String(env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/,"");
}

async function upstream(env, path, body) {
  if (!env.OPENAI_API_KEY) throw new Error("后端尚未配置 OPENAI_API_KEY");
  const r = await fetch(`${base(env)}${path}`, {
    method:"POST",
    headers:{
      "Authorization":`Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify(body)
  });
  const text=await r.text();
  let data; try { data=JSON.parse(text); } catch { data={raw:text}; }
  if(!r.ok) {
    const msg=data?.error?.message || data?.message || `上游 API 返回 ${r.status}`;
    throw new Error(msg);
  }
  return data;
}

function extractText(data) {
  if (typeof data?.choices?.[0]?.message?.content === "string") return data.choices[0].message.content;
  if (Array.isArray(data?.choices?.[0]?.message?.content))
    return data.choices[0].message.content.map(x=>x?.text||"").join("");
  if (typeof data?.output_text === "string") return data.output_text;
  if (Array.isArray(data?.output)) {
    return data.output.flatMap(x=>x?.content||[]).map(x=>x?.text||"").join("");
  }
  return "";
}

function extractImage(data) {
  const item=data?.data?.[0] || data?.images?.[0] || data?.output?.[0] || {};
  if (item.url) return {url:item.url};
  if (item.b64_json) return {dataUrl:`data:image/png;base64,${item.b64_json}`};
  if (item.base64) return {dataUrl:`data:image/png;base64,${item.base64}`};
  throw new Error("上游生图 API 没有返回可识别的图片");
}

export default {
  async fetch(request, env) {
    if(request.method==="OPTIONS") return new Response(null,{headers:cors});
    const url=new URL(request.url);
    try {
      if(request.method==="GET" && url.pathname.endsWith("/health"))
        return json({ok:true,service:"COL API",textModel:env.TEXT_MODEL||"未设置",imageModel:env.IMAGE_MODEL||"未设置"});
      if(request.method!=="POST") return json({error:"只支持 GET /health 和 POST 接口"},405);

      const body=await request.json();

      if(url.pathname.endsWith("/chat")) {
        const instruction=String(body.instruction||"").trim();
        if(!instruction) return json({error:"缺少 instruction"},400);
        const data=await upstream(env,"/chat/completions",{
          model: env.TEXT_MODEL || "gpt-4o-mini",
          messages:[{role:"user",content:instruction}],
          temperature:Number(env.TEXT_TEMPERATURE || 0.7)
        });
        return json({text:extractText(data)});
      }

      if(url.pathname.endsWith("/image")) {
        const prompt=String(body.prompt||"").trim();
        if(!prompt) return json({error:"缺少 prompt"},400);
        const payload={
          model: env.IMAGE_MODEL || "gpt-image-1",
          prompt,
          size: body.resolution || env.IMAGE_SIZE || "1024x1024",
          n:1
        };
        if(body.seed != null && env.SUPPORTS_IMAGE_SEED==="true") payload.seed=Number(body.seed);
        const data=await upstream(env,"/images/generations",payload);
        return json(extractImage(data));
      }

      return json({error:"未知接口"},404);
    } catch(e) {
      return json({error:e?.message||String(e)},500);
    }
  }
};
