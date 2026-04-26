import "./globals.css";
import "leaflet/dist/leaflet.css";
import { AuthProvider } from "./providers/AuthProvider";
import Header from "./components/Header";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Header />
          <main style={{ padding: "20px" }}>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}