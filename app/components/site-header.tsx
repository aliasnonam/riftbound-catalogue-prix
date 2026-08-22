"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { getSetHref, SETS, type SetCode } from "@/lib/sets";

export function SiteHeader({ activeSetCode }: { activeSetCode?: SetCode }) {
  const navRef = useRef<HTMLElement | null>(null);
  const [hints, setHints] = useState({ left: false, right: false });
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
  return <header className="topbar">
    <Link className="brand" href="/" aria-label="Catalogue Riftbound">
      <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><polygon points="16,3 27,9.5 16,16" opacity=".58"/><polygon points="27,9.5 27,22.5 16,16" opacity=".9"/><polygon points="27,22.5 16,29 16,16" opacity=".68"/><polygon points="16,29 5,22.5 16,16" opacity="1"/><polygon points="5,22.5 5,9.5 16,16" opacity=".72"/><polygon points="5,9.5 16,3 16,16" opacity=".86"/><polygon className="brand-hexagon-outline" points="16,3 27,9.5 27,22.5 16,29 5,22.5 5,9.5"/></svg></span>
      <span><strong>RIFTBOUND</strong><small>Catalogue & prix</small></span>
    </Link>
    <div className="set-nav-wrap">
      <nav className="set-nav" ref={navRef} aria-label="Navigation principale">
        {SETS.map((item) => <Link href={getSetHref(item.code)} key={item.code} aria-current={item.code === activeSetCode ? "page" : undefined}><span>{String(item.number).padStart(2, "0")}</span>{item.name}</Link>)}
        <span className="set-nav-separator" aria-hidden="true" />
        <Link className="collection-nav-link" href="/collection" aria-current={!activeSetCode ? "page" : undefined}><span aria-hidden="true">◇</span>Ma collection</Link>
      </nav>
      <span className={`set-nav-scroll-hint is-left${hints.left ? " is-visible" : ""}`} aria-hidden="true">‹</span>
      <span className={`set-nav-scroll-hint is-right${hints.right ? " is-visible" : ""}`} aria-hidden="true">›</span>
    </div>
  </header>;
}
