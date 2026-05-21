import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: '3PL Inbound Onboarding | Mars Integration Automation',
  description: 'Automate MuleSoft YAML config + Translation Table entries for new 3PL partners',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {/* Top navbar */}
        <header className="bg-brand text-white shadow-lg">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold text-sm">M</div>
            <div className="flex-1">
              <p className="font-bold text-base leading-tight">3PL Inbound Onboarding Automation</p>
              <p className="text-blue-200 text-xs">Mars Navision Integration · EOS Transformation Team</p>
            </div>
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                New Onboarding
              </Link>
              <Link
                href="/tools"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                Tools Dashboard
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
        <footer className="mt-12 border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400">
          iHub EOS Transformation Delivery Team · Internal Tool
        </footer>
      </body>
    </html>
  );
}
