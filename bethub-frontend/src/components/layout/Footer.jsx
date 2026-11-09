import { Link } from "react-router-dom";
import { Camera, Globe, MessageCircle, Play, Radio } from "lucide-react";
import Logo from "../common/Logo";
import LanguageSwitcher from "../common/LanguageSwitcher";
import { useI18n } from "../../contexts/LanguageContext";

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t border-white/[0.06] bg-ink-950/60">
      <div className="container-x grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/45">{t("footer.tagline")}</p>
          <div className="mt-4 flex gap-2">
            {[MessageCircle, Camera, Play, Globe].map((Icon, index) => (
              <span key={index} className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/45 transition hover:border-lime/30 hover:text-lime">
                <Icon size={14} />
              </span>
            ))}
          </div>
          <div className="mt-4 max-w-[240px]">
            <LanguageSwitcher variant="block" />
          </div>
        </div>
        <div>
          <p className="eyebrow mb-3">{t("footer.watch")}</p>
          <ul className="space-y-2 text-sm text-white/50">
            <li><Link className="hover:text-lime" to="/live">{t("footer.liveMatches")}</Link></li>
            <li><Link className="hover:text-lime" to="/videos">{t("footer.highlightsShorts")}</Link></li>
            <li><Link className="hover:text-lime" to="/videos?type=replay">{t("footer.matchReplays")}</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-3">{t("footer.explore")}</p>
          <ul className="space-y-2 text-sm text-white/50">
            <li><Link className="hover:text-lime" to="/teams">{t("footer.teams")}</Link></li>
            <li><Link className="hover:text-lime" to="/players">{t("footer.players")}</Link></li>
            <li><Link className="hover:text-lime" to="/stats">{t("footer.statsStandings")}</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-3">{t("footer.platform")}</p>
          <ul className="space-y-2 text-sm text-white/50">
            <li><Link className="hover:text-lime" to="/admin">{t("footer.adminDashboard")}</Link></li>
            <li><Link className="hover:text-lime" to="/admin/matches">{t("footer.scoringConsole")}</Link></li>
            <li><Link className="hover:text-lime" to="/admin/settings">{t("footer.settings")}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/[0.05]">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-4 text-[11px] text-white/35 sm:flex-row">
          <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <p className="inline-flex items-center gap-1.5"><Radio size={11} className="text-coral" /> {t("footer.poweredBy")}</p>
        </div>
      </div>
    </footer>
  );
}
