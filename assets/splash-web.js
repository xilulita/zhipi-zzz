<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>智批作文</title>
<style>
@font-face{font-family:"ZP";src:local("Microsoft YaHei")}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#fff}
#zp-splash{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle at 26% 14%,rgba(255,255,255,.20),transparent 32%),linear-gradient(135deg,#3a34a8 0%,#5b46cf 46%,#8d5ce4 100%);
  color:#fff;font-family:"Microsoft YaHei","PingFang SC",sans-serif;overflow:hidden;
  transition:opacity .48s ease,visibility .48s ease}
#zp-splash.zp-hide{opacity:0;visibility:hidden;pointer-events:none}
#zp-splash:before,#zp-splash:after{content:"";position:absolute;border-radius:50%}
#zp-splash:before{width:460px;height:460px;right:-170px;top:-210px;background:rgba(255,255,255,.10)}
#zp-splash:after{width:420px;height:420px;left:-190px;bottom:-215px;background:rgba(28,20,96,.24)}
.zps-main{position:relative;z-index:1;display:flex;align-items:center;gap:34px;transform:translateY(-10px);
  animation:zpsIn .62s cubic-bezier(.22,.9,.3,1) both}
.zps-icon{width:118px;height:118px;border-radius:30px;box-shadow:0 18px 44px rgba(26,18,88,.36),inset 0 0 0 1px rgba(255,255,255,.24)}
.zps-h1{margin:0 0 10px;font-size:38px;font-weight:800;letter-spacing:5px;text-shadow:0 5px 20px rgba(26,18,88,.30)}
.zps-p{margin:0;font-size:14px;letter-spacing:5.5px;color:rgba(255,255,255,.86)}
.zps-status{position:absolute;left:0;right:0;bottom:52px;z-index:1;text-align:center;font-size:12px;
  letter-spacing:1.6px;color:rgba(255,255,255,.82)}
.zps-bar{width:210px;height:3px;margin:11px auto 0;border-radius:9px;background:rgba(255,255,255,.18);overflow:hidden}
.zps-bar i{display:block;width:40%;height:100%;border-radius:9px;
  background:linear-gradient(90deg,transparent,#fff,transparent);animation:zpsLoad 1.15s ease-in-out infinite}
@keyframes zpsLoad{0%{transform:translateX(-120%)}100%{transform:translateX(360%)}}
@keyframes zpsIn{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:translateY(-10px) scale(1)}}
.zps-fade{animation:zpsFade .5s ease both}
@keyframes zpsFade{to{opacity:0}}
@media (max-width:640px){
  .zps-main{flex-direction:column;gap:16px;text-align:center}
  .zps-icon{width:86px;height:86px;border-radius:22px}
  .zps-h1{font-size:27px;letter-spacing:3px}
  .zps-p{font-size:11.5px;letter-spacing:3px}
  .zps-status{bottom:34px}
}
@media (prefers-reduced-motion:reduce){
  .zps-main{animation:none}.zps-bar i{animation:none;width:100%;opacity:.5}
}
</style>
</head>
<body>
<div id="zp-splash" role="status" aria-label="智批作文正在启动">
  <div class="zps-main">
    <img class="zps-icon" src="assets/app-icon.png" alt="">
    <div>
      <h1 class="zps-h1">智批作文</h1>
      <p class="zps-p">让每一次修改都有方向</p>
    </div>
  </div>
  <div class="zps-status">正在准备批改工作台<div class="zps-bar"><i></i></div></div>
</div>
<script>
(function(){
  var el=document.getElementById('zp-splash');
  var minShow=1100;           // 最短展示时间，避免一闪而过
  var t0=Date.now();
  var done=false;
  function hide(){
    if(done||!el)return;
    done=true;
    var wait=Math.max(0,minShow-(Date.now()-t0));
    setTimeout(function(){
      el.classList.add('zp-hide');
      setTimeout(function(){ if(el&&el.parentNode) el.parentNode.removeChild(el); },560);
    },wait);
  }
  // 页面资源与首帧都就绪后再淡出
  if(document.readyState==='complete'){ setTimeout(hide,60); }
  else { window.addEventListener('load',function(){ setTimeout(hide,60); }); }
  // 兜底：最多 4 秒必关，避免阻塞使用
  setTimeout(hide,4000);
})();
</script>
</body>
</html>