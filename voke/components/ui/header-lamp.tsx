export function HeaderLamp() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-full h-64 overflow-hidden bg-transparent">
      <div className="lamp-cone lamp-cone-left absolute top-0 right-1/2 h-56 w-[30rem]" />
      <div className="lamp-cone lamp-cone-right absolute top-0 left-1/2 h-56 w-[30rem]" />
      <div className="absolute top-0 left-1/2 z-30 h-32 w-64 -translate-x-1/2 -translate-y-6 rounded-full bg-purple-500/40 blur-3xl" />
      <div className="absolute top-0 left-1/2 z-40 h-0.5 w-[min(40rem,calc(100%-2rem))] -translate-x-1/2 bg-[#d9b0ff] shadow-[0_0_20px_#c084fc]" />
    </div>
  );
}
