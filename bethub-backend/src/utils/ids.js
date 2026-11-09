import crypto from "node:crypto";

export const randomToken = (size = 16) => crypto.randomBytes(size).toString("hex");

export const slugify = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

export const buildStreamSlug = ({ teamA, teamB, matchNumber, series }) => {
  const a = slugify(teamA?.shortName || teamA?.name || "team-a");
  const b = slugify(teamB?.shortName || teamB?.name || "team-b");
  const s = slugify(series || "match");
  const n = matchNumber ? `-${matchNumber}` : "";
  const unique = crypto.randomBytes(3).toString("hex");
  return `${a}-vs-${b}${n}-${s}-${unique}`.replace(/-+/g, "-").slice(0, 90);
};

export const streamKey = () => crypto.randomBytes(12).toString("base64url");

export const objectIdString = (value) => {
  const s = String(value || "");
  return /^[a-f0-9]{24}$/i.test(s) ? s : null;
};
