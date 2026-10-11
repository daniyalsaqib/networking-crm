import "leaflet/dist/leaflet.css";
import "./globals.css";
import Providers from "../components/Providers";

export const metadata = {
  title: "Networking CRM",
  description: "Map and manage contacts by location",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
