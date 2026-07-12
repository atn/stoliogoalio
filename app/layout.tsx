import type { Metadata, Viewport } from 'next';
import { Archivo, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { getClubRow, eaColor } from '@/lib/ea';
import SmoothScroll from '@/components/SmoothScroll';

const sans = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-sans',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'STOLIO GOALIO',
  description:
    'Stolio Goalio — FC 26 Pro Clubs. Live record, squad index and results, straight off the EA wire.',
};

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The single accent color = the club's real kit color, live from EA.
  const row = await getClubRow();
  const accent = eaColor(row?.clubInfo?.customKit?.kitColor1, '#6cacde');

  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body style={{ ['--accent' as string]: accent }}>
        <SmoothScroll />
        <div className="grain" aria-hidden />
        {children}
      </body>
    </html>
  );
}
