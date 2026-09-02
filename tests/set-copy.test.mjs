import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SET_BY_CODE } from "../lib/sets.ts";

test("keeps the editorial subtitles requested for sets two through four", () => {
  assert.equal(
    SET_BY_CODE.SFD.subtitle,
    "La collection s’étend avec 12 nouvelles légendes, de nouveaux objets, des réimpressions d’Origins ainsi que des runes et tokens hors set numéroté.",
  );
  assert.equal(
    SET_BY_CODE.UNL.subtitle,
    "Le troisième set introduit 12 nouvelles légendes, des réimpressions d’anciens sets et la rareté Ultime avec Baron Nashor.",
  );
  assert.equal(
    SET_BY_CODE.VEN.subtitle,
    "Le quatrième set ajoute 9 nouvelles légendes, des réimpressions des trois sets précédents, 22 Rival Overnumbered en 11 diptyques et les Crystal Rose.",
  );
});

test("keeps the long hero copy shrinkable and wrapped on mobile", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.hero-copy \{[^}]*width: 100%;[^}]*min-width: 0;/s);
  assert.match(css, /\.hero-subtitle \{[^}]*width: 100%;[^}]*overflow-wrap: break-word;/s);
  assert.match(
    css,
    /@media \(max-width: 680px\)[\s\S]*\.hero-subtitle \{[^}]*max-width: 100%;[^}]*text-wrap: pretty;/,
  );
});

test("keeps the Origins hero copy readable in the narrow desktop range", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /@media \(max-width: 1280px\)[\s\S]*\.set-hero--binder \{[^}]*display: block;[\s\S]*\.set-hero--binder \.hero-copy \{[^}]*max-width: 680px;/,
  );
});

test("keeps the Origins hero copy independent from a collapsed grid track", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.set-hero--binder \{[^}]*grid-template-columns: minmax\(34rem, 1fr\) minmax\(460px, 42vw\);/s,
  );
  assert.match(
    css,
    /\.set-hero--binder \.hero-copy \{[^}]*min-width: min\(34rem, calc\(100vw - 44px\)\);/s,
  );
});
