import type { Metadata } from "next";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import "./styles.css";

export const metadata: Metadata = {
  title: "IH Seeds",
  description: "Western Australia's pasture seed specialists.",
};

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <Header />
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}