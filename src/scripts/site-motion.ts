import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type MagneticElement = HTMLElement & { __magneticReady?: boolean };
type TiltElement = HTMLElement & { __tiltReady?: boolean };

const CARD_SELECTOR = ".movie-card, .book-card, .featured-card";

function addMagneticMotion(elements: MagneticElement[]) {
  elements.forEach((element) => {
    if (element.__magneticReady) return;
    element.__magneticReady = true;

    const xTo = gsap.quickTo(element, "x", {
      duration: 0.45,
      ease: "power3.out",
    });
    const yTo = gsap.quickTo(element, "y", {
      duration: 0.45,
      ease: "power3.out",
    });

    let bounds = element.getBoundingClientRect();

    element.addEventListener("pointerenter", () => {
      bounds = element.getBoundingClientRect();
    });

    element.addEventListener("pointermove", (event) => {
      const offsetX = event.clientX - (bounds.left + bounds.width / 2);
      const offsetY = event.clientY - (bounds.top + bounds.height / 2);
      xTo(offsetX * 0.12);
      yTo(offsetY * 0.12);
    });

    element.addEventListener("pointerleave", () => {
      xTo(0);
      yTo(0);
    });
  });
}

function addCardTilt(cards: TiltElement[]) {
  cards.forEach((card) => {
    if (card.__tiltReady) return;
    card.__tiltReady = true;

    gsap.set(card, {
      transformPerspective: 900,
      transformOrigin: "50% 50%",
    });

    const rotateXTo = gsap.quickTo(card, "rotationX", {
      duration: 0.45,
      ease: "power3.out",
    });
    const rotateYTo = gsap.quickTo(card, "rotationY", {
      duration: 0.45,
      ease: "power3.out",
    });

    let bounds = card.getBoundingClientRect();

    card.addEventListener("pointerenter", () => {
      bounds = card.getBoundingClientRect();
      gsap.to(card, {
        y: -10,
        scale: 1.025,
        duration: 0.38,
        ease: "power3.out",
        overwrite: "auto",
      });
    });

    card.addEventListener("pointermove", (event) => {
      const xRatio = (event.clientX - bounds.left) / bounds.width;
      const yRatio = (event.clientY - bounds.top) / bounds.height;

      rotateYTo(gsap.utils.mapRange(0, 1, -8, 8, xRatio));
      rotateXTo(gsap.utils.mapRange(0, 1, 8, -8, yRatio));
      card.style.setProperty("--pointer-x", `${xRatio * 100}%`);
      card.style.setProperty("--pointer-y", `${yRatio * 100}%`);
    });

    card.addEventListener("pointerleave", () => {
      rotateXTo(0);
      rotateYTo(0);
      gsap.to(card, {
        y: 0,
        scale: 1,
        duration: 0.55,
        ease: "elastic.out(1, 0.55)",
        overwrite: "auto",
      });
      card.style.setProperty("--pointer-x", "50%");
      card.style.setProperty("--pointer-y", "50%");
    });
  });
}

function initGenericPageReveals() {
  if (document.body.classList.contains("home-page")) return;

  const headerParts = gsap.utils.toArray<HTMLElement>(
    ".page-header__eyebrow, .books-header__eyebrow, .page-hero__eyebrow, .page-header__title, .books-header__title, .page-hero__title, .page-header__desc, .books-header__desc, .page-hero__subtitle",
  );

  if (headerParts.length) {
    gsap.from(headerParts, {
      y: 34,
      autoAlpha: 0,
      rotationX: -12,
      duration: 0.9,
      stagger: 0.08,
      ease: "power4.out",
      clearProps: "transform,visibility",
    });
  }

  const revealTargets = gsap.utils.toArray<HTMLElement>(
    ".movie-card, .book-card, .stats-card, .about-section",
  );

  if (revealTargets.length) {
    gsap.set(revealTargets, { y: 54, autoAlpha: 0, scale: 0.96 });
    ScrollTrigger.batch(revealTargets, {
      start: "top 88%",
      once: true,
      interval: 0.08,
      batchMax: 8,
      onEnter: (batch) => {
        gsap.to(batch, {
          y: 0,
          autoAlpha: 1,
          scale: 1,
          duration: 0.85,
          stagger: 0.07,
          ease: "power3.out",
          overwrite: true,
          clearProps: "visibility",
        });
      },
    });
  }
}

export function initSiteMotion() {
  const root = document.documentElement;
  if (root.dataset.siteMotion === "ready") return;
  root.dataset.siteMotion = "ready";
  root.classList.add("motion-enabled");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const progressBar = document.querySelector<HTMLElement>(".scroll-progress__bar");
  if (progressBar && !reduceMotion) {
    gsap.set(progressBar, { scaleX: 0, transformOrigin: "left center" });
    gsap.to(progressBar, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        id: "site-scroll-progress",
        start: 0,
        end: "max",
        scrub: 0.25,
      },
    });
  } else if (progressBar) {
    gsap.set(progressBar, { autoAlpha: 0 });
  }

  const nav = document.querySelector<HTMLElement>(".nav");
  if (nav) {
    if (!reduceMotion) {
      const navIntro = gsap.timeline({
        defaults: { duration: 0.75, ease: "power3.out" },
      });

      navIntro
        .from(nav, { yPercent: -130, autoAlpha: 0 })
        .from(".nav__logo", { x: -18, autoAlpha: 0 }, "<0.22")
        .from(
          ".nav__link",
          { y: -12, autoAlpha: 0, stagger: 0.045 },
          "<0.06",
        );
    }

    ScrollTrigger.create({
      id: "site-nav-state",
      start: 0,
      end: "max",
      onUpdate: () => nav.classList.toggle("is-scrolled", window.scrollY > 28),
    });
  }

  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const auroraTimeline = gsap.timeline({
      repeat: -1,
      yoyo: true,
      defaults: { ease: "sine.inOut" },
    });

    auroraTimeline
      .to(".site-aurora--gold", { x: "12vw", y: "8vh", rotation: 18, duration: 13 }, 0)
      .to(".site-aurora--cyan", { x: "-10vw", y: "12vh", rotation: -14, duration: 16 }, 0)
      .to(".site-aurora--pink", { x: "8vw", y: "-10vh", scale: 1.14, duration: 18 }, 0);

    gsap.to(".nav__logo-reel", {
      rotation: 360,
      duration: 18,
      repeat: -1,
      ease: "none",
    });

    gsap.from(".footer__wordmark span", {
      yPercent: 70,
      autoAlpha: 0,
      stagger: 0.08,
      duration: 1.1,
      ease: "power4.out",
      scrollTrigger: {
        trigger: ".footer",
        start: "top 92%",
        toggleActions: "play none none reverse",
      },
    });

    initGenericPageReveals();

    return () => auroraTimeline.kill();
  });

  mm.add(
    "(min-width: 769px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    () => {
      const cursor = document.querySelector<HTMLElement>(".cursor-aura");
      if (cursor) {
        gsap.set(cursor, { xPercent: -50, yPercent: -50, autoAlpha: 0 });
        const cursorX = gsap.quickTo(cursor, "x", {
          duration: 0.65,
          ease: "power3.out",
        });
        const cursorY = gsap.quickTo(cursor, "y", {
          duration: 0.65,
          ease: "power3.out",
        });

        window.addEventListener("pointermove", (event) => {
          cursorX(event.clientX);
          cursorY(event.clientY);
          gsap.to(cursor, { autoAlpha: 1, duration: 0.25, overwrite: true });
        });

        document.documentElement.addEventListener("pointerleave", () => {
          gsap.to(cursor, { autoAlpha: 0, duration: 0.25, overwrite: true });
        });
      }

      addMagneticMotion(
        gsap.utils.toArray<MagneticElement>(".btn, .nav__link, .footer__link"),
      );
      addCardTilt(gsap.utils.toArray<TiltElement>(CARD_SELECTOR));
    },
  );

  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
}
