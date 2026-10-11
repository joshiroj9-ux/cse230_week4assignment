/**
 * slider.js - ImageSlider (vanilla ES6+, no libraries)
 * Author: Tanka Joshi
 *
 * HOW THE SLIDER WORKS
 * --------------------
 * 1. The track is a flex row. Every slide is exactly 100% of the viewport.
 * 2. Moving to a slide = changing the track's translateX() in whole
 *    percentages (-100%, -200% ...). Percentages make it resize-proof.
 * 3. INFINITE LOOP: a clone of the last slide is placed before the first
 *    slide and a clone of the first slide after the last one:
 *
 *        [clone of last] [1] [2] [3] ... [n] [clone of first]
 *             pos 0       1   2   3      n        pos n+1
 *
 *    Going past either end slides onto a clone. When that animation ends
 *    the track jumps (with transitions off) to the identical real slide.
 *    The user only ever sees motion in one direction.
 */
class ImageSlider {
  /**
   * @param {string|HTMLElement} root       The .slider element.
   * @param {object}  [options]
   * @param {number}  [options.duration=650]  Slide animation time in ms.
   * @param {boolean} [options.autoplay=false] Advance slides automatically.
   * @param {number}  [options.interval=5000]  Delay between slides in ms.
   */
  constructor(root, options = {}) {
    this.root = typeof root === "string" ? document.querySelector(root) : root;
    if (!this.root) throw new Error("ImageSlider: root element not found");

    this.options = { duration: 650, autoplay: false, interval: 5000, ...options };

    this.viewport = this.root.querySelector(".slider__viewport");
    this.track = this.root.querySelector(".slider__track");
    this.slides = [...this.track.children];
    this.total = this.slides.length;
    if (this.total === 0) throw new Error("ImageSlider: no slides found");

    // ----- state -----
    this.current = 0;          // logical slide shown (0 ... total-1)
    this.position = 1;         // physical position inside the cloned track
    this.isAnimating = false;  // blocks input while a slide is moving
    this.userPaused = false;   // pressed the pause button
    this.hovering = false;     // mouse is over the slider
    this.dragging = false;
    this.dragStartX = 0;
    this.dragDelta = 0;
    this.timer = null;
    this.safetyTimer = null;

    // Respect users who ask the OS for less motion
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (this.reduceMotion) this.options.autoplay = false;

    this.#build();
    this.#bind();
    this.#render(false);
    this.#schedule();
  }

  /* =========================== PUBLIC API =========================== */

  next() { this.#step(+1, true); }
  prev() { this.#step(-1, true); }

  /** Go straight to one slide with a single smooth slide (used by dots). */
  goTo(index, fromUser = true) {
    index = this.#wrap(index);
    if (this.isAnimating || index === this.current) return;
    this.current = index;
    this.position = index + 1;
    this.#render(true, fromUser);
  }

  play()  { this.userPaused = false; this.#syncPlayButton(); this.#schedule(); }
  pause() { this.userPaused = true;  this.#syncPlayButton(); this.#halt(); }

  /* ============================= BUILD ============================== */

  #build() {
    this.root.style.setProperty("--duration", `${this.options.duration}ms`);
    this.root.style.setProperty("--interval", `${this.options.interval}ms`);
    this.root.setAttribute("role", "region");
    this.root.setAttribute("aria-roledescription", "carousel");
    this.root.tabIndex = 0;

    // Clones for the infinite loop (hidden from screen readers)
    const cloneOf = (node) => {
      const c = node.cloneNode(true);
      c.setAttribute("aria-hidden", "true");
      c.querySelector("img").alt = "";
      return c;
    };
    this.track.prepend(cloneOf(this.slides[this.total - 1]));
    this.track.append(cloneOf(this.slides[0]));

    // Arrows (left / right edges of the viewport)
    const chevron = (d) =>
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
    this.prevBtn = this.#el("button", "slider__arrow slider__arrow--prev",
                            chevron("M15 5l-7 7 7 7"));
    this.nextBtn = this.#el("button", "slider__arrow slider__arrow--next",
                            chevron("M9 5l7 7-7 7"));
    this.prevBtn.setAttribute("aria-label", "Previous image");
    this.nextBtn.setAttribute("aria-label", "Next image");

    // Counter "01 / 08"
    this.counter = this.#el("div", "slider__counter");

    // Autoplay progress bar
    this.progress = this.#el("div", "slider__progress", "<i></i>");

    this.viewport.append(this.prevBtn, this.nextBtn, this.counter, this.progress);

    // Bottom bar: dots (one per real slide) + play/pause
    this.dots = this.slides.map((_, i) => {
      const dot = this.#el("button", "slider__dot");
      dot.setAttribute("aria-label", `Go to image ${i + 1}`);
      dot.dataset.index = i;
      return dot;
    });
    this.dotsWrap = this.#el("div", "slider__dots");
    this.dotsWrap.append(...this.dots);

    const icon = (cls, shape) =>
      `<svg class="${cls}" viewBox="0 0 12 12" aria-hidden="true">${shape}</svg>`;
    this.playBtn = this.#el("button", "slider__play",
      icon("i-pause", '<rect x="1" y="1" width="3.5" height="10"/><rect x="7.5" y="1" width="3.5" height="10"/>') +
      icon("i-play", '<path d="M2 1l9 5-9 5z"/>') +
      '<span class="label"></span>');
    this.bar = this.#el("div", "slider__bar");
    this.bar.append(this.dotsWrap);
    if (this.options.autoplay) this.bar.append(this.playBtn);

    // Live region so screen readers announce slide changes
    this.live = this.#el("div", "sr-only");
    this.live.setAttribute("aria-live", "polite");

    this.root.append(this.bar, this.live);
    this.#syncPlayButton();
  }

  #el(tag, className, html = "") {
    const node = document.createElement(tag);
    if (tag === "button") node.type = "button";
    node.className = className;
    node.innerHTML = html;
    return node;
  }

  /* ============================= EVENTS ============================= */

  #bind() {
    // Arrows
    this.prevBtn.addEventListener("click", () => this.prev());
    this.nextBtn.addEventListener("click", () => this.next());

    // Dots: ONE delegated listener for all of them
    this.dotsWrap.addEventListener("click", (e) => {
      const dot = e.target.closest(".slider__dot");
      if (dot) this.goTo(Number(dot.dataset.index));
    });

    // Play / pause button
    this.playBtn.addEventListener("click", () =>
      this.userPaused ? this.play() : this.pause());

    // After each slide animation finishes
    this.track.addEventListener("transitionend", (e) => {
      if (e.target === this.track && e.propertyName === "transform") this.#settle();
    });

    // Keyboard
    this.root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") this.next();
      else if (e.key === "ArrowLeft") this.prev();
      else if (e.key === "Home") this.goTo(0);
      else if (e.key === "End") this.goTo(this.total - 1);
    });

    // Pause autoplay while the mouse is over the slider. One document-level
    // listener is used because "mouseleave" is not fired if the hovered node
    // is removed from the page.
    document.addEventListener("mouseover", (e) => {
      const inside = this.root.contains(e.target);
      if (inside === this.hovering) return;
      this.hovering = inside;
      inside ? this.#halt() : this.#schedule();
    });

    // Pause when the browser tab is hidden
    document.addEventListener("visibilitychange", () =>
      document.hidden ? this.#halt() : this.#schedule());

    // Drag / swipe (mouse, touch and pen through Pointer Events)
    this.viewport.addEventListener("pointerdown", (e) => this.#dragStart(e));
    this.viewport.addEventListener("pointermove", (e) => this.#dragMove(e));
    this.viewport.addEventListener("pointerup", (e) => this.#dragEnd(e));
    this.viewport.addEventListener("pointercancel", (e) => this.#dragEnd(e));
  }

  /* ========================= CORE SLIDE LOGIC ========================= */

  #step(direction, fromUser) {
    if (this.isAnimating) return;              // ignore clicks mid-animation
    this.position += direction;                // may land on a clone (0 or total+1)
    this.current = this.#wrap(this.position - 1);
    this.#render(true, fromUser);
  }

  /** Move the track to the current position and refresh the UI. */
  #render(animate, announce = false) {
    this.track.classList.toggle("no-anim", !animate);
    this.isAnimating = animate;
    this.track.style.transform = `translateX(${-this.position * 100}%)`;
    this.#updateUI(announce);

    if (animate) {
      // Fallback: unlock even if "transitionend" never fires (hidden tab etc.)
      clearTimeout(this.safetyTimer);
      this.safetyTimer = setTimeout(() => this.#settle(), this.options.duration + 150);
      this.#schedule();
    }
  }

  /** Animation finished: if we are on a clone, silently jump to the real slide. */
  #settle() {
    clearTimeout(this.safetyTimer);
    if (this.position === 0) this.position = this.total;
    else if (this.position === this.total + 1) this.position = 1;
    this.#render(false);
    void this.track.offsetWidth;               // flush styles before transitions return
    this.isAnimating = false;
  }

  #wrap(i) { return ((i % this.total) + this.total) % this.total; }

  #updateUI(announce) {
    this.dots.forEach((dot, i) => {
      const on = i === this.current;
      dot.classList.toggle("is-active", on);
      if (on) dot.setAttribute("aria-current", "true"); else dot.removeAttribute("aria-current");
    });
    const pad = (n) => String(n).padStart(2, "0");
    this.counter.textContent = `${pad(this.current + 1)} / ${pad(this.total)}`;
    if (announce) {
      const title = this.slides[this.current].querySelector("strong")?.textContent ?? "";
      this.live.textContent = `Image ${this.current + 1} of ${this.total}: ${title}`;
    }
  }

  /* ============================ AUTOPLAY ============================ */

  get #canPlay() {
    return this.options.autoplay && !this.userPaused && !this.hovering
        && !this.dragging && !document.hidden;
  }

  #schedule() {
    this.#halt();
    if (!this.#canPlay) return;
    this.root.classList.add("is-playing");     // restarts the progress bar
    this.timer = setTimeout(() => this.#step(+1, false), this.options.interval);
  }

  #halt() {
    clearTimeout(this.timer);
    this.root.classList.remove("is-playing");
    void this.root.offsetWidth;
  }

  #syncPlayButton() {
    this.playBtn.classList.toggle("is-paused", this.userPaused);
    this.playBtn.querySelector(".label").textContent = this.userPaused ? "Play" : "Pause";
    this.playBtn.setAttribute("aria-label", this.userPaused ? "Start autoplay" : "Pause autoplay");
  }

  /* ========================== DRAG / SWIPE =========================== */

  #dragStart(e) {
    if (this.isAnimating || e.target.closest("button")) return;
    this.dragging = true;
    this.dragStartX = e.clientX;
    this.dragDelta = 0;
    this.viewport.setPointerCapture(e.pointerId);
    this.viewport.classList.add("is-dragging");
    this.track.classList.add("no-anim");
    this.#halt();
  }

  #dragMove(e) {
    if (!this.dragging) return;
    this.dragDelta = e.clientX - this.dragStartX;
    // Live follow the pointer: percentage base + pixel offset
    this.track.style.transform = `translateX(calc(${-this.position * 100}% + ${this.dragDelta}px))`;
  }

  #dragEnd() {
    if (!this.dragging) return;
    this.dragging = false;
    this.viewport.classList.remove("is-dragging");

    const threshold = Math.min(120, this.viewport.clientWidth * 0.18);
    const moved = this.dragDelta;
    this.dragDelta = 0;

    if (moved <= -threshold)      this.#step(+1, true);       // swiped left -> next
    else if (moved >= threshold)  this.#step(-1, true);       // swiped right -> previous
    else if (Math.abs(moved) > 2) this.#render(true);         // not far enough: snap back
    else { this.track.classList.remove("no-anim"); this.#schedule(); }
  }
}

// Make the class available to plain <script> pages and to bundlers.
if (typeof module !== "undefined") module.exports = ImageSlider;
else window.ImageSlider = ImageSlider;
