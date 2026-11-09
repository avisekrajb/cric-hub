import mongoose from "mongoose";
import { connectDatabase } from "./config/db.js";
import logger from "./config/logger.js";
import Country from "./models/Country.model.js";
import { CRICKET_COUNTRIES } from "./data/cricket-countries.js";

/**
 * Non-destructive country top-up.
 *
 * Adds every cricket-playing nation that is missing from the directory while
 * leaving existing countries, custom flags, teams, players and matches exactly
 * as they are. Safe to run repeatedly.
 */
const main = async () => {
  await connectDatabase();

  const existing = await Country.find({}, "name code flag");
  const byName = new Map(existing.map((row) => [row.name.trim().toLowerCase(), row]));

  let added = 0;
  let filledFlags = 0;
  let skipped = 0;

  for (const row of CRICKET_COUNTRIES) {
    const current = byName.get(row.name.trim().toLowerCase());

    if (!current) {
      await Country.create({
        name: row.name,
        code: row.code,
        color: row.color,
        flag: { url: row.flag, publicId: "" },
        isActive: true,
      });
      added += 1;
      continue;
    }

    // Don't overwrite custom uploads — only fill a missing flag.
    if (!current.flag?.url && row.flag) {
      await Country.updateOne({ _id: current._id }, { $set: { "flag.url": row.flag } });
      filledFlags += 1;
    } else {
      skipped += 1;
    }
  }

  const total = await Country.countDocuments();
  logger.ok(`Country directory ready · ${total} total`);
  logger.info(`Added ${added} · filled ${filledFlags} missing flags · kept ${skipped} existing`);
  await mongoose.disconnect();
};

main().catch(async (error) => {
  logger.error("Country seed failed:", error.message);
  logger.error(error.stack);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
