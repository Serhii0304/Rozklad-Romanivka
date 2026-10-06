const button=document.querySelector('#qr-fullscreen');
const status=document.querySelector('#qr-status');
const root=document.documentElement;
if(document.fullscreenEnabled&&root.requestFullscreen){
 button.hidden=false;
 button.addEventListener('click',async()=>{
  status.textContent='';
  button.disabled=true;
  try{
   if(document.fullscreenElement)await document.exitFullscreen();
   else await root.requestFullscreen();
  }catch{status.textContent='Повноекранний режим недоступний. QR-код можна сканувати просто зі сторінки.';}
  finally{button.disabled=false;}
 });
 document.addEventListener('fullscreenchange',()=>{
  button.textContent=document.fullscreenElement?'Вийти з повного екрана':'На весь екран';
  button.setAttribute('aria-pressed',String(Boolean(document.fullscreenElement)));
 });
}
