import { Link } from "react-router-dom";
import { ArrowLeft, Home, Radio, Search } from "lucide-react";
import { useI18n } from "../contexts/LanguageContext";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="container-x grid min-h-[65vh] place-items-center py-10">
      <div className="max-w-md text-center">
        <span className="relative mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full border border-lime/20 bg-lime/[0.06]">
          <span className="absolute inset-0 animate-ping rounded-full bg-lime/5" />
          <span className="font-display text-3xl font-700 text-lime">404</span>
        </span>
        <h1 className="font-display text-2xl font-700 text-white">{t("notFound.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/45">{t("notFound.text")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/" className="btn-primary btn-xs"><Home size={13} /> {t("notFound.backHome")}</Link>
          <Link to="/live" className="btn-ghost btn-xs"><Radio size={13} className="text-coral" /> {t("notFound.liveScores")}</Link>
          <Link to="/players" className="btn-ghost btn-xs"><Search size={13} /> {t("notFound.findPlayer")}</Link>
        </div>
        <p className="mt-6">
          <Link to="/" className="inline-flex items-center gap-1 text-[11px] text-white/30 hover:text-lime"><ArrowLeft size={11} /> {t("notFound.return")}</Link>
        </p>
      </div>
    </div>
  );
}
