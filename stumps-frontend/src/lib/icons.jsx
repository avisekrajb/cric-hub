export const IC = {
  Home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  Matches: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM6 6c4 3 4 9 0 12M18 6c-4 3-4 9 0 12",
  Watch: "M5 4l15 8-15 8z",
  Stats: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  back: "M15 5l-7 7 7 7",
  lock: "M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z",
};

export const Ic = ({ d, s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
