import "./globals.css";
import type { Metadata } from "next";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import Sidebar from "@/components/Sidebar";
import Taskbar from "@/components/Taskbar";

const mont = Montserrat({
  subsets: ["latin"], weight: ["400", "500", "600", "700", "800"],
  variable: "--font-mont", display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono", display: "swap",
});

export const metadata: Metadata = {
  title: "Abu Dhabi Economic Intelligence",
  description: "Live news, read for Abu Dhabi — economic impact and actions for government officials.",
};

// Apply the saved light/dark mode before first paint to avoid a flash. Dark is the default.
const themeScript =
  "try{document.documentElement.dataset.mode=localStorage.getItem('eii-mode')||'dark';}catch(e){}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="dark" className={`${mont.variable} ${mono.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>
          <div className="app">
            <Sidebar />
            <main className="content">
              <Taskbar />
              <div className="page">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
