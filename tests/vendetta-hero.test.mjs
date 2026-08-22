import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(
  new URL("../app/components/catalog-page.tsx", import.meta.url),
  "utf8",
);
const rivalsGallery = readFileSync(
  new URL("../app/components/galleries/RivalsGallery.tsx", import.meta.url),
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

  assert.match(component, /<RivalsGallery/);
  assert.match(rivalsGallery, /export function RivalsGallery/);
  assert.match(rivalsGallery, /Diptyque précédent/);
  assert.match(rivalsGallery, /Diptyque suivant/);
  assert.match(rivalsGallery, /touchStartXRef/);
  assert.match(rivalsGallery, /index \+ 1/);
  assert.match(rivalsGallery, /diptyches\.length/);
  assert.match(rivalsGallery, /Ouvrir la fiche de \$\{card\.name\}/);
  assert.match(rivalsGallery, /Afficher le diptyque \$\{itemIndex \+ 1\}/);
  assert.match(rivalsGallery, /aria-current=\{itemIndex === index \? "true" : undefined\}/);
  assert.match(rivalsGallery, /onClick=\{\(\) => setIndex\(itemIndex\)\}/);
  assert.match(css, /\.rivals-gallery-progress button \{[\s\S]*cursor: pointer;/);
  assert.match(css, /\.rivals-gallery-slide \{[\s\S]*background: #070a10;/);
  assert.match(css, /\.rivals-gallery-slide > img \{[\s\S]*object-fit: contain;/);
  assert.doesNotMatch(css, /\.rivals-gallery-slide > img \{[\s\S]*transform: scale\(1\.028\);/);
});
