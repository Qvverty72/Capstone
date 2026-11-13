// Assets originales: ilustraciones vectoriales dibujadas en canvas y apuntes propios.
// Reutiliza las bibliotecas ya instaladas del backend, sin descargas externas.
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {createCanvas,DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';
import {physical,digital} from './fixtures.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const assets=resolve(here,'assets'), previews=resolve(here,'../local/demo/previews');
await mkdir(assets,{recursive:true});await mkdir(previews,{recursive:true});
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');

function product(item) {
  const canvas=createCanvas(960,640),c=canvas.getContext('2d');
  const rect=(x,y,w,h,fill,r=16)=>{c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
  c.fillStyle='#eef3f7';c.fillRect(0,0,960,640);
  c.fillStyle='#d9e6ee';c.beginPath();c.ellipse(480,480,265,28,0,0,Math.PI*2);c.fill();
  if(item.key==='calculadora') {
    rect(355,105,250,370,'#263e51',28);rect(380,138,200,66,'#cbdccf',8);
    c.font='28px monospace';c.fillStyle='#293d35';c.fillText('123.45',422,182);
    for(let row=0;row<5;row++)for(let col=0;col<4;col++)rect(380+col*50,230+row*43,35,29,col===3?'#df9b44':'#f2f5f7',6);
  } else if(item.key==='cuaderno') {
    rect(300,126,360,340,'#1e6c83',12);rect(320,126,15,340,'#174e63',3);
    c.fillStyle='#e8f1f4';c.font='bold 24px sans-serif';c.fillText('PROGRAMACIÓN',360,218);
    c.font='18px sans-serif';c.fillText('Ejercicios propios',360,258);
    for(let i=0;i<6;i++){c.strokeStyle='#77adba';c.lineWidth=3;c.beginPath();c.moveTo(360,302+i*19);c.lineTo(610,302+i*19);c.stroke();}
    for(let i=0;i<9;i++)rect(292,148+i*34,34,8,'#a6b5be',3);
  } else if(item.key==='monitor') {
    rect(220,142,520,300,'#253a49',14);rect(237,158,486,261,'#35617c',3);
    rect(272,196,300,14,'#98cbd2',4);rect(272,227,240,10,'#d3e6ee',3);rect(272,254,365,10,'#8caec3',3);
    rect(272,292,180,80,'#294e65',5);rect(470,292,202,80,'#466f89',5);
    rect(454,442,52,44,'#526575',0);rect(380,480,200,14,'#526575',7);
  } else if(item.key==='kit') {
    c.lineJoin='round';c.fillStyle='#dfad55';c.strokeStyle='#a57836';c.lineWidth=4;
    c.beginPath();c.moveTo(272,426);c.lineTo(272,160);c.lineTo(535,426);c.closePath();c.fill();c.stroke();
    c.fillStyle='#eef3f7';c.beginPath();c.moveTo(324,366);c.lineTo(324,279);c.lineTo(411,366);c.closePath();c.fill();
    rect(540,160,53,313,'#e3b86b',5);
    for(let i=0;i<15;i++)rect(540,175+i*19,i%5===0?25:14,2,'#76572a',0);
    c.fillStyle='#94c3c7';c.beginPath();c.moveTo(388,468);c.lineTo(686,468);c.lineTo(686,260);c.closePath();c.fill();
  } else if(item.key==='teclado') {
    rect(182,230,596,225,'#304b5d',20);
    for(let row=0;row<4;row++)for(let col=0;col<12;col++)rect(204+col*46,251+row*39,35,29,col===11?'#dca154':'#e3ebf1',4);
    rect(331,412,240,23,'#b5c7d5',4);
    c.strokeStyle='#718596';c.lineWidth=8;c.beginPath();c.moveTo(480,230);c.bezierCurveTo(480,105,700,185,700,107);c.stroke();
  } else {
    c.strokeStyle='#3c697e';c.lineWidth=24;c.lineCap='round';
    for(const delta of [-110,110]) {c.beginPath();c.moveTo(480+delta-90,456);c.lineTo(480+delta+58,230);c.lineTo(480+delta+99,456);c.stroke();}
    c.strokeStyle='#8ca9b8';c.lineWidth=16;c.beginPath();c.moveTo(286,240);c.lineTo(660,240);c.moveTo(275,456);c.lineTo(700,456);c.stroke();
  }
  c.fillStyle='#183a50';c.font='bold 24px sans-serif';c.textAlign='center';
  c.fillText(item.title,480,556,870);
  c.fillStyle='#536f80';c.font='16px sans-serif';c.fillText('ILUSTRACIÓN DEMOSTRATIVA · CAMPUSLINK · SAN ANDRÉS',480,591);
  return canvas.toBuffer('image/png');
}
function wrap(text,font,size,maxWidth) {
  const lines=[];let line='';
  for(const word of text.split(/\s+/)){const next=line?`${line} ${word}`:word;if(font.widthOfTextAtSize(next,size)>maxWidth&&line){lines.push(line);line=word;}else line=next;}
  if(line)lines.push(line);return lines;
}
async function academic(item,index) {
  const doc=await PDFDocument.create(),regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(item.title);doc.setAuthor('CampusLink - material original de demostración');
  doc.setCreationDate(new Date('2026-11-13T12:00:00Z'));doc.setModificationDate(new Date('2026-11-13T12:00:00Z'));
  const blue=rgb(.08,.22,.31),gray=rgb(.3,.38,.43),teal=rgb(.10,.39,.46);
  for(let number=1;number<=2;number++) {
    const p=doc.addPage([595,842]);
    p.drawRectangle({x:0,y:718,width:595,height:124,color:blue});
    p.drawText(`CAMPUSLINK / GUÍA ${String(index+1).padStart(2,'0')}`,{x:44,y:803,size:11,font:bold,color:rgb(.7,.86,.9)});
    let y=774;for(const line of wrap(item.title,bold,21,507)){p.drawText(line,{x:44,y,size:21,font:bold,color:rgb(1,1,1)});y-=27;}
    p.drawText('Piloto académico | Duoc UC | Concepción - San Andrés',{x:44,y:691,size:10,font:regular,color:gray});
    const paragraph=(text,size=12)=>{for(const line of wrap(text,regular,size,507)){p.drawText(line,{x:44,y,size,font:regular,color:gray});y-=19;}y-=17;};
    y=645;
    if(number===1) {
      for(const [title,body] of item.sections){p.drawText(title,{x:44,y,size:15,font:bold,color:teal});y-=27;paragraph(body);}
    } else {
      p.drawText('Actividad de aplicación y autoevaluación',{x:44,y,size:17,font:bold,color:teal});y-=39;
      paragraph(`Contexto: un equipo de estudiantes de San Andrés prepara un proyecto sobre ${item.title.toLowerCase()}. Usa los conceptos de la primera página para proponer una solución pequeña y explicable.`);
      for(const [n,text] of [['01','Describe el problema y el resultado que espera una persona usuaria.'],['02','Identifica dos decisiones técnicas y justifica cada una con un concepto de la guía.'],['03','Propón una comprobación con un resultado esperado y un caso que pueda fallar.']]){
        p.drawText(n,{x:44,y,size:18,font:bold,color:teal});
        let ty=y;for(const line of wrap(text,regular,12,458)){p.drawText(line,{x:90,y:ty,size:12,font:regular,color:gray});ty-=19;}
        y=ty-20;p.drawLine({start:{x:90,y},end:{x:550,y},thickness:1,color:rgb(.8,.85,.87)});y-=45;
      }
      p.drawText('Criterio de revisión',{x:44,y,size:15,font:bold,color:teal});y-=28;
      paragraph('La respuesta debe conectar conceptos con decisiones concretas, reconocer sus límites y permitir que otra persona reproduzca la comprobación. No se exige una única solución.');
    }
    p.drawLine({start:{x:44,y:80},end:{x:551,y:80},thickness:1,color:rgb(.8,.85,.87)});
    p.drawText('Contenido original ficticio. Uso académico demostrativo; no es material oficial de Duoc UC.',{x:44,y:60,size:9,font:regular,color:gray});
    p.drawText(`16 de noviembre de 2026 | ${number} / 2`,{x:44,y:43,size:9,font:regular,color:gray});
  }
  return Buffer.from(await doc.save());
}
for(const item of physical)await writeFile(resolve(assets,item.asset),product(item));
for(const [index,item] of digital.entries()) {
  const bytes=await academic(item,index);await writeFile(resolve(assets,`${item.key}.pdf`),bytes);
  const loading=getDocument({data:Uint8Array.from(bytes),useSystemFonts:true});
  const pdf=await loading.promise;
  for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++) {
    const page=await pdf.getPage(pageNumber),viewport=page.getViewport({scale:1});
    const canvas=createCanvas(viewport.width,viewport.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    await writeFile(resolve(previews,`${item.key}-${pageNumber}.png`),canvas.toBuffer('image/png'));
  }
  await loading.destroy();
}
console.log(JSON.stringify({images:physical.length,pdfs:digital.length,pages:10,assets,previews}));
