export type AdaptiveForeground='light'|'dark';

export function contrastForeground(background:string):AdaptiveForeground{
  return contrastRatio(background,'#fff')>contrastRatio(background,'#151515')?'light':'dark';
}

export function contrastRatio(a:string,b:string):number{
  const [bright,dim]=[relativeLuminance(a),relativeLuminance(b)].sort((x,y)=>y-x);
  return (bright+.05)/(dim+.05);
}

function relativeLuminance(hex:string):number{
  const value=hex.replace('#',''),full=value.length===3?[...value].map(char=>char+char).join(''):value;
  const channels=[0,2,4].map(offset=>Number.parseInt(full.slice(offset,offset+2),16)/255).map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4);
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
}
