export class VectorRig {
  constructor(container, options = {}) {
    if (!container) throw new Error("VectorRig requires a container element.");
    this.container = container;
    this.options = options;
    this.manifest = null;
    this.svg = null;
    this.transforms = {};
    this.variants = {};
    this.blinkTimer = null;
  }

  async load() {
    const asset = this.options.asset || "/rig/character-rig.svg";
    const manifestUrl = this.options.manifest || "/rig/rig.json";
    const [svgResponse, manifestResponse] = await Promise.all([
      fetch(asset),
      fetch(manifestUrl),
    ]);
    if (!svgResponse.ok || !manifestResponse.ok) {
      throw new Error("Unable to load the vector rig assets.");
    }

    const [svgText, manifest] = await Promise.all([
      svgResponse.text(),
      manifestResponse.json(),
    ]);
    const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svg = parsed.documentElement;
    const assetUrl = new URL(asset, window.location.href);
    const spriteUrls = new Set();
    svg.querySelectorAll("image").forEach((node) => {
      const source = node.getAttribute("href") || node.getAttribute("xlink:href");
      if (!source || source.startsWith("data:")) return;
      const resolved = new URL(source, assetUrl).href;
      spriteUrls.add(resolved);
      node.setAttribute("href", resolved);
      node.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", resolved);
    });

    // Fetch and decode every variant before exposing the rig. Hidden SVG images
    // are otherwise decoded lazily by some browsers, causing the first swap to flash.
    await Promise.all(Array.from(spriteUrls, (url) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = async () => {
        try {
          if (image.decode) await image.decode();
          resolve();
        } catch {
          // A completed load is usable even when a browser declines decode().
          resolve();
        }
      };
      image.onerror = () => reject(new Error(`Unable to preload rig sprite: ${url}`));
      image.src = url;
    })));

    this.container.replaceChildren(document.importNode(svg, true));
    this.svg = this.container.querySelector("svg");
    this.manifest = manifest;
    this.svg.style.width = "100%";
    this.svg.style.height = "100%";
    this.svg.style.display = "block";

    for (const [part, definition] of Object.entries(manifest.parts)) {
      this.transforms[part] = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
      if (definition.default) this.setVariant(part, definition.default);
    }
    if (this.options.preset) this.setPreset(this.options.preset);
    return this;
  }

  getPart(part) {
    const definition = this.manifest?.parts?.[part];
    if (!definition || !this.svg) return null;
    return this.svg.querySelector(definition.selector);
  }

  setVariant(part, variant) {
    const definition = this.manifest?.parts?.[part];
    const target = this.getPart(part);
    if (!definition?.variants || !target || !definition.variants.includes(variant)) {
      return false;
    }
    target.querySelectorAll(":scope > [data-variant]").forEach((node) => {
      const visible = node.getAttribute("data-variant") === variant;
      node.style.display = "inline";
      node.setAttribute("visibility", visible ? "visible" : "hidden");
      node.style.opacity = visible ? "1" : "0";
    });
    this.variants[part] = variant;
    return true;
  }

  setPreset(name) {
    const preset = this.manifest?.presets?.[name];
    if (!preset) return false;
    for (const [part, variant] of Object.entries(preset)) {
      this.setVariant(part, variant);
    }
    return true;
  }

  setTransform(part, transform = {}) {
    const target = this.getPart(part);
    const definition = this.manifest?.parts?.[part];
    if (!target || !definition) return false;
    const current = this.transforms[part] || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    const next = { ...current, ...transform };
    const [pivotX, pivotY] = definition.pivot;
    target.setAttribute(
      "transform",
      `translate(${next.x} ${next.y}) translate(${pivotX} ${pivotY}) rotate(${next.rotation}) scale(${next.scaleX} ${next.scaleY}) translate(${-pivotX} ${-pivotY})`,
    );
    this.transforms[part] = next;
    return true;
  }

  setVisible(part, visible) {
    const target = this.getPart(part);
    if (!target) return false;
    target.style.display = visible ? "" : "none";
    return true;
  }

  async blink(duration = 110) {
    const previous = this.variants.eyes || "neutral";
    this.setVariant("eyes", "closed");
    window.clearTimeout(this.blinkTimer);
    await new Promise((resolve) => {
      this.blinkTimer = window.setTimeout(resolve, duration);
    });
    this.setVariant("eyes", previous);
  }

  exportPose() {
    return {
      format: "vn-vector-pose",
      version: 1,
      transforms: structuredClone(this.transforms),
      variants: structuredClone(this.variants),
    };
  }

  importPose(pose) {
    for (const [part, transform] of Object.entries(pose.transforms || {})) {
      this.setTransform(part, transform);
    }
    for (const [part, variant] of Object.entries(pose.variants || {})) {
      this.setVariant(part, variant);
    }
  }

  reset() {
    for (const part of Object.keys(this.manifest?.parts || {})) {
      this.setTransform(part, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
    }
    this.setPreset("neutral");
  }
}

class VNVectorRigElement extends HTMLElement {
  async connectedCallback() {
    if (this.rig) return;
    this.rig = new VectorRig(this, {
      asset: this.getAttribute("asset") || "/rig/character-rig.svg",
      manifest: this.getAttribute("manifest") || "/rig/rig.json",
      preset: this.getAttribute("preset") || "neutral",
    });
    try {
      await this.rig.load();
      this.dispatchEvent(new CustomEvent("rig-ready", { detail: this.rig }));
    } catch (error) {
      console.error("Unable to initialize character rig:", error);
      this.dispatchEvent(new CustomEvent("rig-error", { detail: error }));
    }
  }
}

if (!customElements.get("vn-vector-rig")) {
  customElements.define("vn-vector-rig", VNVectorRigElement);
}
