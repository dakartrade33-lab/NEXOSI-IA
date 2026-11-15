import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = { title: "NEXORA AI Studio", description: "CRM de contenu et studio de création IA.", applicationName: "NEXORA AI" };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) { return <html lang="fr"><body>{children}</body></html>; }

