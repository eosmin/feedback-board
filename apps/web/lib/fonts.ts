import { Inter } from 'next/font/google';

// `--font-inter` is mapped to Tailwind's `font-sans` in globals.css. `next/font` self-hosts the
// file at build time, so there is no request to Google and no layout shift on swap. Shared by the
// root layout and `global-error.tsx`, which replaces it and must load the same font.
export const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
