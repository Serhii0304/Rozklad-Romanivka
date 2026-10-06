import {bellsPoster} from './bells-poster.mjs';
import {openPrintPdf} from './print-files.mjs?v=20261006-romanivka';
const image=document.querySelector('#poster-preview'),button=document.querySelector('#print-poster'),status=document.querySelector('#poster-status');
function ready(){button.disabled=false;status.textContent='';}
image.addEventListener('load',ready);
image.addEventListener('error',()=>{status.textContent='Не вдалося завантажити зображення. Оновіть сторінку.';});
if(image.complete&&image.naturalWidth)ready();
button.addEventListener('click',()=>openPrintPdf(bellsPoster.pdfPath));
