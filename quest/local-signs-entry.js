// Temporary local-only entry. Does not grant any entitlement or modify player state.
(() => {
 const host=location.hostname;
 if(!(['localhost','127.0.0.1','[::1]'].includes(host)))return;
 const link=document.createElement('a');
 link.href='signs-preview.html?restart=1';
 link.className='btn btn-secondary';
 link.textContent='Тест: вход со второго чата';
 link.style.cssText='position:fixed;bottom:18px;left:18px;z-index:9999;max-width:calc(100vw - 36px);background:#fff6dc;color:#382b15;border:2px solid #c29546;padding:12px 18px;border-radius:12px;box-shadow:0 4px 24px #0003;font:600 14px system-ui';
 document.body.append(link);
})();
