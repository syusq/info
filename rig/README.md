# Generated Character Image Rig

This package uses the generated character artwork directly. An SVG container keeps pose, face, eyes, and mouth as separate transformable groups while preserving the original raster rendering.

## Files

- `character-rig.svg` — layered SVG container
- `assets/base-crossed.png` — crossed-arm body sprite
- `assets/face-overlay.png` — stable glasses, brows, and blush layer
- `assets/eyes-*.png` — independently swappable eye sprites
- `assets/mouth-*.png` — independently swappable mouth sprites
- `rig.json` — selectors, pivots, variants, and presets
- `vector-rig.js` — dependency-free browser loader and control API

## Add it to a website

```html
<script type="module" src="/rig/vector-rig.js"></script>
<vn-vector-rig id="character" preset="neutral"></vn-vector-rig>
```

```js
const element = document.querySelector("#character");
element.addEventListener("rig-ready", ({ detail: rig }) => {
  rig.setVariant("eyes", "happy");
  rig.setVariant("mouth", "happy");
  rig.setTransform("eyes", { x: 4, y: -2 });
  rig.setTransform("mouth", { x: 0, y: 3 });
});
```

## API

- `setVariant(part, variant)` swaps the pose, eye, or mouth sprite.
- `setTransform(part, { x, y, rotation, scaleX, scaleY })` moves a rig group around its pivot.
- `setPreset(name)` applies a coordinated expression.
- `blink()` briefly swaps the eyes to `closed`.
- `exportPose()` and `importPose(pose)` save or restore transforms and sprite choices.
- `reset()` restores the neutral pose.
