(function () {
  if (!window.gsap || !window.ScrollTrigger) {
    return;
  }

  const track = document.getElementById("snapTrack");
  if (!track) {
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    return;
  }

  setupHero();
  track.querySelectorAll(".story-panel").forEach(setupPanel);

  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
  });

  function setupHero() {
    const hero = track.querySelector(".scroll-hero");
    if (!hero) {
      return;
    }
    const bg = hero.querySelector(".scroll-hero-bg");
    const content = hero.querySelector(".scroll-hero-content");
    const cue = hero.querySelector(".scroll-hero-cue");

    gsap.to(bg, {
      yPercent: 15,
      scale: 1.12,
      ease: "none",
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: true
      }
    });

    gsap.to(content, {
      yPercent: -20,
      opacity: 0,
      ease: "none",
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: true
      }
    });

    if (cue) {
      gsap.to(cue, {
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: hero,
          start: "top top",
          end: "15% top",
          scrub: true
        }
      });
    }
  }

  function setupPanel(panel) {
    const media = panel.querySelector(".story-media img, .story-media-layer");
    const copy = panel.querySelector(".story-copy");
    const elements = copy.querySelectorAll(".eyebrow, .value-step, h2, p, .story-link");

    const tl = gsap.timeline({ paused: true });

    if (media) {
      tl.from(media, { scale: 1.12, ease: "power2.out", duration: 0.7 }, 0);
    }

    tl.from(elements, {
      opacity: 0,
      y: 40,
      ease: "power2.out",
      duration: 0.6,
      stagger: 0.08
    }, 0.1);

    ScrollTrigger.create({
      trigger: panel,
      start: "top center",
      end: "bottom center",
      onEnter: function () {
        tl.play();
      },
      onEnterBack: function () {
        tl.play();
      },
      onLeave: function () {
        tl.reverse();
      },
      onLeaveBack: function () {
        tl.reverse();
      }
    });
  }
})();
