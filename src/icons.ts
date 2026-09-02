const wrap = (body:string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#151515" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const fighterIcons:Record<string,string> = {
  volt: wrap('<path fill="#fff" d="M37 5 15 35h15l-3 24 22-34H34z"/>'),
  brick: wrap('<path fill="#fff" d="M7 14h50v36H7z"/><path d="M7 27h50M7 39h50M23 14v13m20-13v13M16 27v12m31-12v12M26 39v11"/>'),
  mint: wrap('<path fill="#fff" d="M33 54C12 44 10 20 32 9c23 10 20 34 1 45Z"/><path d="M32 14v34M19 31h26"/>'),
  goldie: wrap('<circle fill="#fff" cx="32" cy="32" r="24"/><path d="M39 21c-2-2-5-3-8-3-5 0-9 3-9 7s4 6 10 7 10 3 10 7-4 7-10 7c-5 0-9-2-11-5M32 13v38"/>'),
  void: wrap('<circle fill="#fff" cx="32" cy="32" r="23"/><circle fill="#151515" cx="32" cy="32" r="10"/><path d="M32 4v8M32 52v8M4 32h8M52 32h8"/>'),
  bubble: wrap('<circle fill="#fff" cx="25" cy="35" r="16"/><circle fill="#fff" cx="43" cy="19" r="9"/><circle fill="#fff" cx="47" cy="46" r="6"/>'),
  moss: wrap('<path fill="#fff" d="M32 55V30M32 33C15 31 11 19 13 10c15 0 23 8 19 23Zm0 8c17-2 22-12 21-22-15 0-24 8-21 22Z"/>'),
  glitch: wrap('<path fill="#fff" d="M10 13h20v12H18v13h17v13H10zM40 8h14v14H40zM42 34h12v19H39V43h-8"/>'),
  frost: wrap('<path d="M32 5v54M9 18l46 28M9 46l46-28M22 10l10 9 10-9M22 54l10-9 10 9M8 31l13 3-2 13M56 33l-13-3 2-13"/>'),
  ember: wrap('<path fill="#fff" d="M34 5c4 14-8 17-2 28 4-4 7-8 8-13 10 9 14 19 9 29-7 14-29 14-36 0-7-14 3-27 13-35-1 10 1 15 8 19 3-10 1-18 0-28Z"/>'),
  echo: wrap('<path d="M9 23c8 5 8 13 0 18M21 15c15 10 15 24 0 34M34 8c23 14 23 34 0 48"/>'),
  rook: wrap('<path fill="#fff" d="M15 8h10v10h14V8h10v18l-5 7v21H20V33l-5-7z"/><path d="M20 34h24M27 54V42h10v12"/>'),
  comet: wrap('<path fill="#fff" d="m43 10 4 13 12 5-11 7-1 14-11-8-13 4 4-13-8-11 14-1z"/><path d="M24 40 7 55M20 30 5 37"/>'),
  static: wrap('<path fill="#fff" d="M37 5 15 35h15l-3 24 22-34H34z"/><path d="M8 12h8M48 52h8"/>'),
  anchor: wrap('<path d="M32 10v42M19 18h26M12 39c3 13 14 18 20 18s17-5 20-18M12 39l-5 7M52 39l5 7"/><circle fill="#fff" cx="32" cy="10" r="6"/>'),
  orbit: wrap('<circle fill="#fff" cx="32" cy="32" r="13"/><ellipse cx="32" cy="32" rx="29" ry="12" transform="rotate(-22 32 32)"/><circle fill="#151515" stroke="none" cx="54" cy="21" r="5"/>'),
  saber: wrap('<path fill="#fff" d="m45 7 7 7-27 29-8-8z"/><path d="m13 31 20 20M11 45l8 8"/>'),
  slugger: wrap('<path fill="#fff" d="M45 7c7 3 9 8 6 15L28 51c-3 4-8 5-12 2s-4-8-1-12L38 12c2-3 4-5 7-5Z"/><path d="m17 39 12 10"/>'),
  shotgun: wrap('<path fill="#fff" d="M8 27h40l8 7-8 7H8z"/><path d="M18 41 13 55h13l7-14M45 27l8-7M49 41l7 5"/>'),
  sniper: wrap('<path fill="#fff" d="M6 29h49v8H6z"/><path d="M18 37 13 54h12l8-17M47 29V18M40 18h14"/><circle fill="#fff" cx="35" cy="24" r="8"/>'),
};

const cache = new Map<string,HTMLImageElement>();

export function drawFighterIcon(ctx:CanvasRenderingContext2D, fighterId:string, x:number, y:number, size:number):void {
  let image = cache.get(fighterId);
  if (!image) {
    image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fighterIcons[fighterId])}`;
    cache.set(fighterId, image);
  }
  if (image.complete) ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
}
