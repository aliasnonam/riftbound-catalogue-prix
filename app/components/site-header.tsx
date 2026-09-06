"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { getSetDisplayName, getSetHref, SETS, type SetCode } from "@/lib/sets";
import { useSiteLanguage } from "@/app/lib/site-language";

type CollectionSection = "collection" | "tools";

export function SiteHeader({ activeSetCode, showLanguageSwitcher = true, collectionSection }: { activeSetCode?: SetCode; showLanguageSwitcher?: boolean; collectionSection?: CollectionSection }) {
  const navRef = useRef<HTMLElement | null>(null);
  const [hints, setHints] = useState({ left: false, right: false });
  const { language, setLanguage } = useSiteLanguage();
  const inferredCollectionSection: CollectionSection | undefined = typeof window === "undefined"
    ? undefined
    : window.location.pathname.startsWith("/outils")
      ? "tools"
      : window.location.pathname.startsWith("/collection")
        ? "collection"
        : undefined;
  const currentCollectionSection = collectionSection ?? inferredCollectionSection;
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () => setHints({ left: nav.scrollLeft > 4, right: nav.scrollWidth - nav.clientWidth - nav.scrollLeft > 4 });
    const frame = requestAnimationFrame(() => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (active) nav.scrollLeft = Math.max(0, active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2);
      update();
    });
    nav.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update); observer.observe(nav);
    return () => { cancelAnimationFrame(frame); nav.removeEventListener("scroll", update); observer.disconnect(); };
  }, [activeSetCode]);
  const scrollNavigation = (direction: -1 | 1) => navRef.current?.scrollBy({ left: direction * Math.max(180, navRef.current.clientWidth * 0.72), behavior: "smooth" });
  return <header className="topbar">
    <Link className="brand" href="/" aria-label={language === "en" ? "Riftbound catalogue" : "Catalogue Riftbound"}>
      <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><polygon points="16,3 27,9.5 16,16" opacity=".58"/><polygon points="27,9.5 27,22.5 16,16" opacity=".9"/><polygon points="27,22.5 16,29 16,16" opacity=".68"/><polygon points="16,29 5,22.5 16,16" opacity="1"/><polygon points="5,22.5 5,9.5 16,16" opacity=".72"/><polygon points="5,9.5 16,3 16,16" opacity=".86"/><polygon className="brand-hexagon-outline" points="16,3 27,9.5 27,22.5 16,29 5,22.5 5,9.5"/></svg></span>
      <span><strong>RIFTBOUND</strong><small>{language === "en" ? "Catalogue & prices" : "Catalogue & prix"}</small></span>
    </Link>
    <div className="set-nav-wrap">
      <nav className="set-nav" ref={navRef} aria-label={language === "en" ? "Main navigation" : "Navigation principale"}>
        {SETS.map((item) => <Link href={getSetHref(item.code)} key={item.code} aria-current={item.code === activeSetCode ? "page" : undefined}><span>{String(item.number).padStart(2, "0")}</span>{getSetDisplayName(item, language)}</Link>)}
        <span className="set-nav-separator" aria-hidden="true" />
        <Link className="collection-nav-link" href="/collection" aria-current={currentCollectionSection === "collection" ? "page" : undefined}><span aria-hidden="true">◇</span>{language === "en" ? "My collection" : "Ma collection"}</Link>
      </nav>
      <button className={`set-nav-scroll-hint is-left${hints.left ? " is-visible" : ""}`} type="button" aria-label={language === "en" ? "Show previous navigation items" : "Afficher les éléments précédents"} onClick={() => scrollNavigation(-1)}>‹</button>
      <button className={`set-nav-scroll-hint is-right${hints.right ? " is-visible" : ""}`} type="button" aria-label={language === "en" ? "Show next navigation items" : "Afficher les éléments suivants"} onClick={() => scrollNavigation(1)}>›</button>
    </div>
    <div className="topbar-actions">
      {currentCollectionSection ? <nav className="collection-tools-nav" aria-label={language === "en" ? "Collection navigation" : "Navigation de collection"}>
        <Link href="/collection" aria-current={currentCollectionSection === "collection" ? "page" : undefined}><span aria-hidden="true">◇</span>{language === "en" ? "My collection" : "Ma collection"}</Link>
        <Link href="/outils" aria-current={currentCollectionSection === "tools" ? "page" : undefined}><span aria-hidden="true">◇</span>{language === "en" ? "Tools" : "Outils"}</Link>
      </nav> : null}
      {showLanguageSwitcher ? <div className="language-switcher" aria-label={language === "en" ? "Site language" : "Langue du site"}><button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button><button type="button" aria-pressed={language === "fr"} onClick={() => setLanguage("fr")}>FR</button></div> : null}
    </div>
  </header>;
}
