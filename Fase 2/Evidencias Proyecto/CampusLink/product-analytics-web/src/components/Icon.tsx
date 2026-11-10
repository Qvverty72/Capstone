const paths: Record<string, string[]> = {
  cap: ['m2 8 10-5 10 5-10 5z', 'M6 10v7c4 3 8 3 12 0v-7', 'M22 8v7'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M16 3a4 4 0 0 1 0 8', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
  pulse: ['M3 12h4l3-8 4 16 3-8h4'],
  bag: ['M5 7h14l2 14H3z', 'M9 7V5a3 3 0 0 1 6 0v2'],
  book: ['M12 7v14', 'M3 3c4-1 6 0 9 2 3-2 5-3 9-2v16c-4-1-6 0-9 2-3-2-5-3-9-2z'],
  calendar: ['M8 2v4M16 2v4M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2', 'm8 15 2 2 5-5'],
  arrow: ['M7 17 17 7M7 7h10v10'],
  down: ['m6 9 6 6 6-6'],
  right: ['m9 5 7 7-7 7'],
  info: ['M12 11v6M12 7h.01', 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'],
  filter: ['M4 7h16M7 12h10M10 17h4'],
  reset: ['M3 10a9 9 0 1 1 2 9', 'M3 4v6h6'],
  download: ['M12 3v12m-5-5 5 5 5-5', 'M5 16v5h14v-5'],
  upload: ['M12 16V4m-5 5 5-5 5 5', 'M4 16v5h16v-5'],
  clock: ['M12 8v4l3 2', 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'],
  target: ['M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0', 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'],
  chart: ['M4 3v18h17', 'm8 14 4-4 4 2 5-7'],
  shield: ['M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6z', 'm8 12 3 3 5-6'],
  close: ['m6 6 12 12M6 18 18 6'],
  check: ['m5 12 4 4L19 6'],
  help: ['M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01', 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'],
};
export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{(paths[name] ?? paths.chart).map((d, i) => <path d={d} key={i} />)}</svg>;
}
