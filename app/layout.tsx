import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Mesma família do Codental, o sistema que o Dr. Mateus já usa.
const inter = Inter({
  variable: "--fonte-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Dr. Mateus Peixoto", template: "%s · Dr. Mateus Peixoto" },
  description: "O que a IA fez, o que espera você, a agenda de hoje.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

// Claro por padrão. Escuro só se ele escolher em Mais (guardado no aparelho).
const scriptTema = `(function(){try{var t=localStorage.getItem("tema");if(t==="dark"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.dataset.theme="dark"}else{document.documentElement.dataset.theme="light"}}catch(e){document.documentElement.dataset.theme="light"}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" suppressHydrationWarning data-theme="light" className={`${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          theme="light"
          position="bottom-center"
          offset={96}
          mobileOffset={{ bottom: 88, left: 16, right: 16 }}
          toastOptions={{ duration: 5000 }}
          closeButton={false}
        />
      </body>
    </html>
  );
}
