import {readFileSync} from 'node:fs';

export function audioDurationSeconds(path:URL):number{
  const bytes=readFileSync(path);
  const signature=bytes.toString('ascii',0,4);
  if(signature==='RIFF')return wavDuration(bytes);
  if(signature==='OggS')return oggDuration(bytes);
  return mp3Duration(bytes);
}

function wavDuration(bytes:Buffer):number{
  const format=bytes.indexOf('fmt '),data=bytes.indexOf('data');
  if(format<0||data<0)throw new Error('Invalid WAV');
  return bytes.readUInt32LE(data+4)/bytes.readUInt32LE(format+16);
}

function oggDuration(bytes:Buffer):number{
  const vorbis=bytes.indexOf(Buffer.from([1,118,111,114,98,105,115]));
  if(vorbis<0)throw new Error('Invalid Ogg Vorbis');
  const sampleRate=bytes.readUInt32LE(vorbis+12);
  let page=-1,cursor=0;
  while((cursor=bytes.indexOf('OggS',cursor,'ascii'))>=0){page=cursor;cursor+=4;}
  if(page<0)throw new Error('Invalid Ogg page');
  return Number(bytes.readBigUInt64LE(page+6))/sampleRate;
}

function mp3Duration(bytes:Buffer):number{
  let cursor=0;
  if(bytes.toString('ascii',0,3)==='ID3'){
    const size=bytes.subarray(6,10);
    cursor=10+((size[0]&127)<<21|(size[1]&127)<<14|(size[2]&127)<<7|(size[3]&127));
  }
  while(cursor+4<bytes.length&&!(bytes[cursor]===0xff&&(bytes[cursor+1]&0xe0)===0xe0))cursor++;
  const bitRate=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320][(bytes[cursor+2]>>4)&15];
  if(!bitRate)throw new Error('Unsupported MP3');
  return (bytes.length-cursor)*8/(bitRate*1_000);
}
