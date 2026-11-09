import { useState } from "react";
import { useStore } from "./hooks/useStore";
import { useAdminSession } from "./hooks/useAdminSession";
import SideNav from "./layout/SideNav";
import TopBar from "./layout/TopBar";
import Footer from "./layout/Footer";
import HomePage from "./pages/HomePage";
import MatchesPage from "./pages/MatchesPage";
import WatchPage from "./pages/WatchPage";
import StatsPage from "./pages/StatsPage";
import MatchPage from "./pages/MatchPage";
import LoginModal from "./pages/LoginModal";
import AdminApp from "./admin/AdminApp";

export default function App() {
  const [db, upd] = useStore();
  const [view, setView] = useState({ tab: "Home", mid: null });
  const [login, setLogin] = useState(false);
  const [admin, setAdmin] = useAdminSession();

  const go = (tab) => { setView({ tab, mid: null }); window.scrollTo(0, 0); };
  const open = (m) => { setView((v) => ({ ...v, mid: m.id })); window.scrollTo(0, 0); };
  const flag = (on) => { setAdmin(on); setLogin(false); };

  if (admin) return <AdminApp db={db} upd={upd} logout={() => flag(false)} />;

  const cur = view.mid && db.matches.find((m) => m.id === view.mid);
  return (
    <div className="cr">
      <SideNav tab={view.tab} go={go} />
      <div className="wrap">
        <TopBar title={cur ? "Match" : view.tab === "Home" ? "Stumps" : view.tab} />
        <main className="main">
          {cur ? <MatchPage m={cur} players={db.players} back={() => setView((v) => ({ ...v, mid: null }))} /> : (
            <>
              {view.tab === "Home" && <HomePage db={db} open={open} go={go} />}
              {view.tab === "Matches" && <MatchesPage db={db} open={open} />}
              {view.tab === "Watch" && <WatchPage db={db} open={open} />}
              {view.tab === "Stats" && <StatsPage players={db.players} />}
            </>
          )}
          <Footer onAdmin={() => setLogin(true)} />
        </main>
      </div>
      {login && <LoginModal close={() => setLogin(false)} ok={() => flag(true)} />}
    </div>
  );
}
