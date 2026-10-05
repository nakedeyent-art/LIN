import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LIN — NIL Ecosystem",
  description: "Role-based NIL platform for athletes, parents, coaches, sponsors, recruiters and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
