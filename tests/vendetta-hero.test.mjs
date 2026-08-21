import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

test("keeps the Vendetta Rival diptych compact and tappable on mobile", () => {
  assert.match(css, /\.set-hero--rivals \{[^}]*grid-template-columns:/s);
  assert.match(css, /\.rival-hero-card--vi \{[^}]*rotate\(-6deg\)/s);
  assert.match(css, /\.rival-hero-card--jinx \{[^}]*rotate\(6deg\)/s);
  assert.match(
    css,
    /@media \(max-width: 680px\)[\s\S]*\.rival-hero-cards \{[^}]*width: 214px;[^}]*opacity: \.62;/,
  );
  assert.match(component, /Voir les 11 diptyques Rivals/);
  assert.match(component, /setRivalsGalleryOpen\(true\)/);
});

test("ships all 11 Rival diptychs with arrows, counter and swipe navigation", () => {
  for (let index = 1; index <= 11; index += 1) {
    const prefix = String(index).padStart(2, "0");
    const matchingAsset = [
      "vi-jinx",
      "zed-shen",
      "riven-draven",
      "swain-irelia",
      "jayce-viktor",
      "renekton-nasus",
      "rengar-khazix",
      "gangplank-illaoi",
      "diana-leona",
      "kayle-morgana",
      "ambessa-mel",
    ][index - 1];
    assert.ok(
      existsSync(
        new URL(
          `../public/hero/rivals/${prefix}-${matchingAsset}.webp`,
          import.meta.url,
        ),
      ),
    );
  }

  assert.match(component, /function RivalsGalleryDialog/);
  assert.match(component, /Diptyque précédent/);
  assert.match(component, /Diptyque suivant/);
  assert.match(component, /touchStartXRef/);
  assert.match(component, /index \+ 1/);
  assert.match(component, /RIVAL_DIPTYCHES\.length/);
  assert.match(component, /Ouvrir la fiche de \$\{card\.name\}/);
});
