import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(
  new URL("../app/components/catalog-page.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("keeps the Vendetta Vi and Jinx Rival diptych in the hero", () => {
  assert.match(component, /setCode === "VEN"[\s\S]*rival-hero-cards/);
  assert.match(component, /Vi, Destructive/);
  assert.match(component, /Jinx, Demolitionist/);
  assert.match(component, /Diptyque Rival Overnumbered : Vi face à Jinx/);
  assert.match(component, /set-hero--rivals/);
});

test("keeps the Vendetta Rival diptych compact and faded on mobile", () => {
  assert.match(css, /\.set-hero--rivals \{[^}]*grid-template-columns:/s);
  assert.match(css, /\.rival-hero-card--vi \{[^}]*rotate\(-6deg\)/s);
  assert.match(css, /\.rival-hero-card--jinx \{[^}]*rotate\(6deg\)/s);
  assert.match(
    css,
    /@media \(max-width: 680px\)[\s\S]*\.rival-hero-cards \{[^}]*width: 180px;[^}]*opacity: \.22;/,
  );
});
