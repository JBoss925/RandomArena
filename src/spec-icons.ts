const paths:Record<string,string>={
  shield:'<path d="M12 3 5 6v5c0 4.5 2.8 7.8 7 10 4.2-2.2 7-5.5 7-10V6z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',heart:'<path d="M20 8c0 6-8 11-8 11S4 14 4 8c0-5 6-6 8-2 2-4 8-3 8 2Z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',bolt:'<path d="m14 2-9 12h6l-1 8 9-13h-6z"/>',
  gauge:'<path d="M4 18a9 9 0 1 1 16 0M12 12l5-4"/>',weight:'<path d="M7 8h10l3 13H4zM9 8a3 3 0 0 1 6 0"/>',
  trend:'<path d="m4 17 6-6 4 4 6-8M15 7h5v5"/>',stack:'<path d="m12 3 9 5-9 5-9-5zM4 13l8 5 8-5M4 17l8 5 8-5"/>',
  drop:'<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>',dodge:'<path d="M3 12h14M12 7l5 5-5 5M7 5 3 9l4 4"/>',
  thorns:'<path d="m12 2 3 6 7-1-4 6 4 5-7-1-3 6-3-6-7 1 4-5-4-6 7 1z"/>',shuffle:'<path d="M4 7h3c5 0 5 10 10 10h3M17 14l3 3-3 3M4 17h3c2 0 3-2 4-4M17 4l3 3-3 3"/>',
  dice:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="16" r="1"/><circle cx="12" cy="12" r="1"/>',snow:'<path d="M12 2v20M3.5 7l17 10M3.5 17l17-10M8 4l4 4 4-4"/>',
  impact:'<path d="m12 2 2 7 7-2-4 6 5 5-8-1-2 6-3-6-7 1 5-5-4-6 7 2z"/>',flame:'<path d="M13 2c2 6-3 7 0 12 1-2 3-3 3-5 5 5 4 13-4 13-9 0-10-10-4-15 0 4 2 6 5 7 1-5 0-8 0-12Z"/>',
  echo:'<path d="M4 9c4 2 4 4 0 6M9 5c8 5 8 9 0 14M15 2c9 6 9 14 0 20"/>',block:'<path d="M4 4h16v16H4zM8 8h8v8H8z"/>',wind:'<path d="M3 8h12c5 0 5-6 1-6M3 12h17M3 16h10c5 0 5 6 1 6"/>',
  zap:'<path d="m14 2-9 12h6l-1 8 9-13h-6z"/>',damage:'<path d="M4 20 20 4M7 4l13 13M4 7l13 13"/>',anchor:'<path d="M12 5v16M7 8h10M4 14c0 5 4 8 8 8s8-3 8-8M4 14l-2 3M20 14l2 3"/>',
  orbit:'<circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-25 12 12)"/>',sword:'<path d="m18 3 3 3L10 17l-3-3zM5 12l7 7M4 17l3 3"/>',ruler:'<path d="m5 19 14-14 3 3L8 22zM12 10l2 2M16 6l2 2"/>',
  rotate:'<path d="M20 8a9 9 0 1 0 1 7M20 3v5h-5"/>',bat:'<path d="M17 3c4 2 4 5 2 8L9 21c-2 2-5 1-6-1s0-4 2-6L15 4z"/>',launch:'<path d="M3 12h15M13 6l6 6-6 6"/>',
};

export function specIcon(name:string):string{return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]??paths.impact}</svg>`;}
