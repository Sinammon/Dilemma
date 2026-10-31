import React from 'react';

export default function Icon({ name, size = 20, ...props }) {
  const paths = {
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    trophy: <><path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm4 10v6m-4 2h8M8 5H4v3a4 4 0 0 0 5 4m7-7h4v3a4 4 0 0 1-5 4" /></>,
    dollar: <><path d="M12 2v20m6-15c-1-4-12-4-12 1 0 5 12 3 12 8 0 5-11 5-12 1" /></>,
    seat: <><path d="M7 4v10H4v6h14V5a2 2 0 0 0-4 0v10H7M4 20v2m14-2v2" /></>,
    balance: <><path d="M12 3v17M7 21h10M4 7h16M6 7l-4 8h8L6 7Zm12 0-4 8h8l-4-8Z" /><circle cx="12" cy="5" r="2" /></>,
    engine: <><path d="M3 10h3l3-4h8v4h4v8h-4v2H8l-3-4H3v-6ZM9 3h7m-4 0v3M1 11v6" /></>,
    expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>,
    'check-circle': <><path d="M21 11v1a9 9 0 1 1-5-8M8 11l4 4 8-9" /></>,
    book: <><path d="M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v16" /></>,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    link: <><path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" /></>,
    compare: <><path d="M5 19V9m7 10V4m7 15v-7" /></>,
    spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    mileage: <><path d="M4 18a9 9 0 1 1 16 0M12 4v2M5 8l2 2m12-2-2 2M3 14h2m14 0h2m-9 1 4-5" /><circle cx="12" cy="15" r="1.5" /></>,
    transmission: <><path d="M6 4v16m12-16v8H6m6-8v16" /><path d="M4 4h4m2 0h4m2 0h4M4 20h4m2 0h4" /></>,
    location: <><path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    pause: <><path d="M9 6v12M15 6v12" /></>,
    play: <path d="m9 5 10 7-10 7Z" />,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-5" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.arrow}</svg>;
}
