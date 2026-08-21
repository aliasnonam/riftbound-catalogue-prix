import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const component = readFileSync(
  new URL("../app/components/catalog-page.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("uses the signed Ahri and Baron Nashor as the featured set hero cards", () => {
  assert.match(component, /SFD:[\s\S]*Ahri, Inquisitive — signée[\s\S]*sfd-ahri-signed\.webp/);
  assert.match(component, /UNL:[\s\S]*Baron Nashor[\s\S]*unl-baron-nashor\.webp/);
  assert.match(component, /featured-hero-card--\$\{setCode\.toLowerCase\(\)\}/);
  assert.ok(existsSync(new URL("../public/hero/sfd-ahri-signed.webp", import.meta.url)));
  assert.ok(existsSync(new URL("../public/hero/unl-baron-nashor.webp", import.meta.url)));
});

test("orders all 12 Origins signed cards from 299 to 310 in the binder", () => {
  let previousIndex = -1;

  for (let number = 299; number <= 310; number += 1) {
    const token = `number: "${number}*"`;
    const currentIndex = component.indexOf(token);

    assert.ok(currentIndex > previousIndex, `${number}* doit suivre la carte précédente`);
    assert.ok(
      existsSync(new URL(`../public/hero/ogn-${number}-signed.webp`, import.meta.url)),
      `l’image ${number}* doit être disponible`,
    );
    assert.ok(
      statSync(new URL(`../public/hero/ogn-${number}-signed.webp`, import.meta.url)).size >
        50_000,
      `l’image ${number}* doit utiliser la source haute définition`,
    );
    previousIndex = currentIndex;
  }

  assert.match(component, /ORIGINS_SIGNED_HERO_CARDS\.map/);
  assert.match(component, /Planche de collection des 12 cartes signées Outnumbered d’Origins/);
});

test("renders a four-column binder and tappable mobile hero visuals", () => {
  assert.match(
    css,
    /\.origins-binder-grid \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/s,
  );
  assert.match(
    css,
    /@media \(max-width: 680px\)[\s\S]*\.origins-binder-hero \{[^}]*width: 252px;[^}]*opacity: \.6;/,
  );
  assert.match(
    css,
    /@media \(max-width: 680px\)[\s\S]*\.featured-hero-card \{[^}]*width: 188px;[^}]*opacity: \.58;/,
  );
  assert.match(component, /onClick=\{\(\) => setOriginsGalleryIndex\(cardIndex\)\}/);
  assert.match(component, /onClick=\{\(\) => setHeroPreview\(featuredHeroCard\)\}/);
  assert.match(component, /function HeroCardDialog/);
});

test("opens the Origins gallery on the selected card and supports continuous navigation", () => {
  assert.match(component, /function OriginsSignedGalleryDialog/);
  assert.match(component, /initialIndex: number/);
  assert.match(component, /current === 0 \? ORIGINS_SIGNED_HERO_CARDS\.length - 1/);
  assert.match(component, /\(current \+ 1\) % ORIGINS_SIGNED_HERO_CARDS\.length/);
  assert.match(component, /event\.key === "ArrowLeft"/);
  assert.match(component, /event\.key === "ArrowRight"/);
  assert.match(component, /onTouchStart=/);
  assert.match(component, /onTouchEnd=/);
  assert.match(component, /Carte \$\{index \+ 1\} sur \$\{ORIGINS_SIGNED_HERO_CARDS\.length\}/);
});

test("keeps the soft set glow without a circular outline behind featured cards", () => {
  assert.match(
    css,
    /\.featured-hero-card::before \{[^}]*radial-gradient/s,
  );
  assert.doesNotMatch(css, /\.featured-hero-card::after\s*\{/);
});
