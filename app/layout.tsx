import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://needle-focus-player.jazzy-slug-4008.chatgpt.site'),
  title: 'Needle — focus in rhythm',
  description: 'A vinyl-inspired focus timer that builds a soundtrack around your session.',
  openGraph: {
    title: 'Needle — focus in rhythm',
    description: 'A vinyl-inspired focus timer that builds a soundtrack around your session.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Needle — focus in rhythm',
    description: 'A vinyl-inspired focus timer that builds a soundtrack around your session.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
