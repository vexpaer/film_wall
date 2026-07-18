import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function animateCounters() {
  const counters = gsap.utils.toArray<HTMLElement>("[data-count]");

  counters.forEach((counter) => {
    const endValue = Number(counter.dataset.count);
    if (!Number.isFinite(endValue)) return;

    const decimals = Number(counter.dataset.decimals ?? 0);
    const state = { value: 0 };
    counter.textContent = (0).toFixed(decimals);

    gsap.to(state, {
      value: endValue,
      duration: 1.8,
      ease: "power3.out",
      onUpdate: () => {
        counter.textContent = state.value.toFixed(decimals);
      },
      scrollTrigger: {
        trigger: counter.closest(".stat-card") ?? counter,
        start: "top 84%",
        once: true,
      },
    });
  });
}

function batchReveal(
  selector: string,
  from: gsap.TweenVars,
  to: gsap.TweenVars,
) {
  const targets = gsap.utils.toArray<HTMLElement>(selector);
  if (!targets.length) return;

  gsap.set(targets, from);
  ScrollTrigger.batch(targets, {
    start: "top 88%",
    once: true,
    interval: 0.1,
    batchMax: 8,
    onEnter: (batch) => {
      gsap.to(batch, {
        ...to,
        stagger: 0.08,
        overwrite: true,
      });
    },
  });
}

export function initHomeMotion() {
  if (!document.body.classList.contains("home-page")) return;

  const root = document.documentElement;
  if (root.dataset.homeMotion === "ready") return;
  root.dataset.homeMotion = "ready";

  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const intro = gsap.timeline({
      defaults: { duration: 0.95, ease: "expo.out" },
    });

    intro
      .addLabel("open", 0)
      .from(
        ".hero__bg-img",
        { scale: 1.2, autoAlpha: 0, duration: 1.8, ease: "power3.out" },
        "open",
      )
      .from(
        ".hero__prism",
        { scale: 0.35, autoAlpha: 0, stagger: 0.12, duration: 1.4 },
        "open",
      )
      .from(
        ".film-strip__hole",
        {
          scaleY: 0,
          autoAlpha: 0,
          stagger: { amount: 0.65, from: "center" },
          duration: 0.45,
          ease: "back.out(1.8)",
        },
        "open+=0.08",
      )
      .from(
        ".hero__eyebrow",
        { x: -38, autoAlpha: 0, duration: 0.8 },
        "open+=0.16",
      )
      .from(
        ".hero__title-word > span",
        {
          yPercent: 118,
          rotation: 4,
          stagger: 0.1,
          duration: 1.05,
          ease: "power4.out",
        },
        "open+=0.2",
      )
      .from(
        ".hero__subtitle",
        { y: 28, autoAlpha: 0, duration: 0.75 },
        "open+=0.48",
      )
      .from(
        ".hero__meta > span",
        { y: 18, autoAlpha: 0, stagger: 0.07, duration: 0.65 },
        "open+=0.58",
      )
      .from(
        ".hero__actions .btn",
        {
          y: 24,
          autoAlpha: 0,
          scale: 0.92,
          stagger: 0.1,
          ease: "back.out(1.7)",
        },
        "open+=0.66",
      )
      .from(
        ".hero__poster-scene",
        {
          xPercent: 28,
          rotation: 8,
          scale: 0.78,
          autoAlpha: 0,
          duration: 1.35,
          ease: "power4.out",
        },
        "open+=0.28",
      )
      .from(
        ".hero__ticket",
        { x: 80, rotation: 18, autoAlpha: 0, duration: 0.85 },
        "open+=0.84",
      )
      .from(
        ".hero__crosshair, .hero__scroll-cue",
        { autoAlpha: 0, scale: 0.5, stagger: 0.08, duration: 0.6 },
        "open+=0.9",
      );

    const heroParallax = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        id: "home-hero-parallax",
        trigger: "[data-home-hero]",
        start: "top top",
        end: "bottom top",
        scrub: 1,
      },
    });

    heroParallax
      .to(".hero__bg-img", { yPercent: 16, scale: 1.14 }, 0)
      .to(".hero__grid", { yPercent: 22 }, 0)
      .to(".hero__poster-scene", { yPercent: -18, rotation: -4 }, 0)
      .to(".hero__content", { yPercent: 18, autoAlpha: 0.18 }, 0)
      .to(".hero__film-strip--top .film-strip", { xPercent: -12 }, 0)
      .to(".hero__film-strip--bottom .film-strip", { xPercent: 12 }, 0);

    const orbitTimeline = gsap.timeline({ repeat: -1 });
    orbitTimeline
      .to(".hero__orbit--outer", { rotation: 360, duration: 26, ease: "none" }, 0)
      .to(".hero__orbit--inner", { rotation: -360, duration: 19, ease: "none" }, 0)
      .to(
        ".hero__poster-card",
        { y: -12, rotation: 1.5, duration: 3.2, yoyo: true, repeat: -1, ease: "sine.inOut" },
        0,
      );

    const glitchTimeline = gsap.timeline({ repeat: -1, repeatDelay: 3.4 });
    glitchTimeline
      .to(".hero__poster-glitch", { autoAlpha: 0.7, x: 5, duration: 0.05 })
      .to(".hero__poster-glitch", { x: -7, duration: 0.05 })
      .to(".hero__poster-glitch", { autoAlpha: 0, x: 0, duration: 0.08 });

    gsap.to(".cinema-marquee__track", {
      xPercent: -50,
      duration: 26,
      repeat: -1,
      ease: "none",
    });

    gsap.from(".stats-section__header > *", {
      y: 45,
      autoAlpha: 0,
      stagger: 0.1,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".stats-section__header",
        start: "top 86%",
        toggleActions: "play none none reverse",
      },
    });

    batchReveal(
      ".stat-card",
      { y: 72, autoAlpha: 0, scale: 0.9, rotationX: -14 },
      { y: 0, autoAlpha: 1, scale: 1, rotationX: 0, duration: 0.9, ease: "power3.out" },
    );
    batchReveal(
      ".home-movie-grid .movie-card",
      { y: 80, autoAlpha: 0, scale: 0.88, rotation: 2 },
      { y: 0, autoAlpha: 1, scale: 1, rotation: 0, duration: 1, ease: "power4.out" },
    );

    gsap.utils.toArray<HTMLElement>(".section__header:not(.featured-header)").forEach((header) => {
      gsap.from(header.children, {
        y: 46,
        autoAlpha: 0,
        stagger: 0.09,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: header,
          start: "top 86%",
          toggleActions: "play none none reverse",
        },
      });
    });

    const ctaTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: "[data-cta-section]",
        start: "top 72%",
        toggleActions: "play none none reverse",
      },
      defaults: { ease: "power4.out" },
    });

    ctaTimeline
      .from(".cta-block__ring", { scale: 0.2, autoAlpha: 0, stagger: 0.12, duration: 1.2 })
      .from(".cta-block__satellite", { scale: 0, autoAlpha: 0, stagger: 0.08, duration: 0.65 }, "<0.25")
      .from(".cta-block__eyebrow", { y: 24, autoAlpha: 0, duration: 0.6 }, "<0.1")
      .from(".cta-block__title", { y: 55, autoAlpha: 0, duration: 1 }, "<0.08")
      .from(".cta-block__desc", { y: 28, autoAlpha: 0, duration: 0.7 }, "<0.16")
      .from(
        ".cta-block__actions .btn",
        { y: 24, autoAlpha: 0, stagger: 0.08, duration: 0.7 },
        "<0.12",
      );

    gsap.to(".cta-block__ring--one", {
      rotation: 360,
      duration: 22,
      repeat: -1,
      ease: "none",
    });
    gsap.to(".cta-block__ring--two", {
      rotation: -360,
      duration: 17,
      repeat: -1,
      ease: "none",
    });

    animateCounters();

    return () => {
      intro.kill();
      heroParallax.kill();
      orbitTimeline.kill();
      glitchTimeline.kill();
      ctaTimeline.kill();
    };
  });

  mm.add(
    "(min-width: 901px) and (prefers-reduced-motion: no-preference)",
    () => {
      const section = document.querySelector<HTMLElement>("[data-featured-section]");
      const pin = section?.querySelector<HTMLElement>(".featured-pin");
      const viewport = section?.querySelector<HTMLElement>(".featured-viewport");
      const track = section?.querySelector<HTMLElement>(".featured-track");
      const cards = section
        ? gsap.utils.toArray<HTMLElement>(".featured-card", section)
        : [];

      if (!section || !pin || !viewport || !track || !cards.length) return;

      const maxShift = () => Math.max(0, track.scrollWidth - viewport.clientWidth);

      const featuredTimeline = gsap.timeline({
        scrollTrigger: {
          id: "home-featured-horizontal",
          trigger: section,
          start: "top top",
          end: () => `+=${Math.max(window.innerWidth * 1.8, maxShift() * 1.45)}`,
          pin,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      const featuredEntrance = gsap.timeline({
        scrollTrigger: {
          id: "home-featured-entrance",
          trigger: section,
          start: "top 82%",
          toggleActions: "play none none reverse",
        },
        defaults: { ease: "power4.out" },
      });

      featuredEntrance
        .from(".featured-header > *", {
          y: 44,
          autoAlpha: 0,
          stagger: 0.1,
          duration: 0.8,
        })
        .from(
          cards,
          {
            y: 110,
            autoAlpha: 0,
            rotation: (index) => (index % 2 === 0 ? -3 : 3),
            stagger: 0.12,
            duration: 1,
          },
          "<0.08",
        );

      featuredTimeline
        .to(
          track,
          { x: () => -maxShift(), duration: 3.6, ease: "none" },
          0,
        )
        .to(
          cards,
          {
            rotation: (index) => (index % 2 === 0 ? 1.5 : -1.5),
            y: (index) => (index % 2 === 0 ? -22 : 18),
            duration: 3.6,
            ease: "none",
          },
          0,
        );

      return () => {
        featuredEntrance.kill();
        featuredTimeline.kill();
      };
    },
  );

  mm.add(
    "(max-width: 900px) and (prefers-reduced-motion: no-preference)",
    () => {
      batchReveal(
        ".featured-card",
        { y: 70, autoAlpha: 0, scale: 0.94 },
        { y: 0, autoAlpha: 1, scale: 1, duration: 0.9, ease: "power3.out" },
      );
    },
  );

  if (document.fonts) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
}
