import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import ScoreTicker from "./ScoreTicker";
import { useSocketEvent } from "../../contexts/SocketContext";
import { useToast } from "../../contexts/ToastContext";

export default function Layout({ children, hideFooter = false }) {
  const location = useLocation();
  const { info } = useToast();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  useSocketEvent("notification", (payload) => {
    if (!payload?.title) return;
    info(payload.body ? `${payload.title} · ${payload.body}` : payload.title);
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <ScoreTicker />
      <main className="flex-1">{children}</main>
      {!hideFooter && <Footer />}
    </div>
  );
}
