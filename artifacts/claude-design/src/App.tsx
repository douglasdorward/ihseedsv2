import { useEffect } from "react";
import Admin from "./pages/Admin";

export default function App() {
  useEffect(() => {
    document.title = "Admin — IH Seeds";
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", "IH Seeds catalogue administration.");
  }, []);

  return <Admin />;
}
