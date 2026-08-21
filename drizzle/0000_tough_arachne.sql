CREATE TABLE `market_price_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`prices_json` text NOT NULL,
	`source_version` integer NOT NULL,
	`source_created_at` text NOT NULL,
	`synced_at` text NOT NULL,
	`matched_products` integer NOT NULL
);
