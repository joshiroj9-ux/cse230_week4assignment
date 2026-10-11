# Image Slider Library

A responsive, infinite-loop image slider built with **plain HTML, CSS and JavaScript** (no libraries or plugins).
Created by **Tanka Joshi**.

![Desktop preview](docs/preview-desktop.png)

## Features
- **Previous / Next arrows** on the left and right edges of the image window
- **Indicator dots** created automatically from the number of slides; the active dot updates itself and every dot is clickable
- **Horizontal sliding** with `transform: translateX()` and a CSS `transition` (no opacity fading)
- **Seamless infinite loop** in both directions (clone technique)
- **Responsive** layout: `aspect-ratio`, percentage-based track maths and `object-fit: cover`
- **Extras:** image counter, captions, autoplay with progress bar and play/pause, keyboard keys (← → Home End), mouse drag and touch swipe, ARIA labels and a screen-reader live region, reduced-motion support

![Wrap animation](docs/wrap-animation.png)

## Project structure
```
image-slider-library/
├── index.html     # page markup + the slides
├── style.css      # viewport mask, flex track, controls, breakpoints
├── slider.js      # ImageSlider class (state, events, loop logic)
├── images/        # 8 free photographs
└── docs/          # README screenshots
```

## Run locally
No build step is needed. Open `index.html` in any modern browser.

## Use it in your own page
```html
<section class="slider" id="gallery">
  <div class="slider__viewport">
    <div class="slider__track">
      <figure class="slide"><img src="a.jpg" alt="..."><figcaption><strong>Title</strong></figcaption></figure>
      <figure class="slide"><img src="b.jpg" alt="..."><figcaption><strong>Title</strong></figcaption></figure>
    </div>
  </div>
</section>

<link rel="stylesheet" href="style.css">
<script src="slider.js"></script>
<script>
  const slider = new ImageSlider("#gallery", { duration: 650, autoplay: true, interval: 5000 });
  // slider.next(); slider.prev(); slider.goTo(2); slider.pause(); slider.play();
</script>
```

| Option | Default | Meaning |
|---|---|---|
| `duration` | `650` | slide animation time in ms |
| `autoplay` | `false` | advance slides automatically |
| `interval` | `5000` | delay between slides in ms |

## How the infinite loop works
The track is built as `[clone of last] [slide 1 … slide n] [clone of first]`. Moving past an end slides onto a clone; when the animation ends (`transitionend`) the track jumps, with transitions switched off, to the identical real slide. The viewer only ever sees continuous movement in one direction.

## Photo credits
All photographs are free to use under the [Unsplash License](https://unsplash.com/license). They were taken from the
[elementary OS wallpaper collection](https://github.com/elementary/wallpapers), which lists the sources in its
[copyright file](https://raw.githubusercontent.com/elementary/wallpapers/deb-packaging/debian/copyright):

| File | Title | Photographer |
|---|---|---|
| valley.jpg | Photo of Valley | Aniket Deole |
| meadow.jpg | A Large Body of Water Surrounded By Mountains | Peter Thomas |
| dolomites.jpg | Canazei Granite Ridges | Unsplash |
| pier.jpg | Sunset by the Pier | Unsplash |
| canyon.jpg | Ashim D'Silva | Ashim D'Silva |
| forest.jpg | Morskie Oko | Unsplash |
| ocean.jpg | Nattu Adnan | Nattu Adnan |
| desert.jpg | A Trail of Footprints In The Sand | David Emrich |

Images were resized for the web (max 1800 px wide).

## Publish on GitHub Pages
1. Create a public repository named `image-slider-library` and push this folder to the `main` branch.
2. Go to **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then **Save**.
3. After a minute the site is live at `https://<your-username>.github.io/image-slider-library/`.

## License
Code: MIT (see `LICENSE`). Photos: Unsplash License.
