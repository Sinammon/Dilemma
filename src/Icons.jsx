import React from 'react';

export default function Icon({ name, size = 20, ...props }) {
  const paths = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    link: <><path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" /></>,
    compare: <><path d="M5 19V9m7 10V4m7 15v-7" /></>,
    spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    pause: <><path d="M9 6v12M15 6v12" /></>,
    play: <path d="m9 5 10 7-10 7Z" />,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-5" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.arrow}</svg>;
}
