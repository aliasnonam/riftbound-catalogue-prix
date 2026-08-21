import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const marketPriceCache = sqliteTable("market_price_cache", {
  key: text("key").primaryKey(),
  pricesJson: text("prices_json").notNull(),
  sourceVersion: integer("source_version").notNull(),
  sourceCreatedAt: text("source_created_at").notNull(),
  syncedAt: text("synced_at").notNull(),
  matchedProducts: integer("matched_products").notNull(),
});
