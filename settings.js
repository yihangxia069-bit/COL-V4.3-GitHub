import { getApiBase, setApiBase, health } from "./api.js";

function addButton() {
  const host=document.querySelector(".top-actions");
  if(!host || document.getElementById("apiSettingsBtn")) return;
  const b=document.createElement("button");
  b.id="apiSettingsBtn"; b.className="btn"; b.textContent="接口设置";
  b.onclick=async()=>{
    const current=getApiBase();
    const value=prompt("填写 AI 后端地址。\n例如：https://你的-worker.example.workers.dev\n留空则使用当前站点的 /api", current==="/api"?"":current);
    if(value===null) return;
    setApiBase(value);
    try { await health(); alert("接口连接正常。"); }
    catch(e) { alert("已保存，但健康检查失败：\n"+(e.message||e)); }
  };
  host.appendChild(b);
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",addButton); else addButton();
