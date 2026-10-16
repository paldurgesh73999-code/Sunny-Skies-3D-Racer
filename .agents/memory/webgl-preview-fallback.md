---
name: WebGL preview fallback
description: The browser used for the project's preview screenshot cannot create a WebGL context.
---

Use a renderer fallback for Three.js scenes so the game remains visible and usable in the Replit preview browser. The WebGL renderer can still be used where supported; `SVGRenderer` preserves the same scene and 3D camera when WebGL is unavailable.

**Why:** On 2026-10-16, the project preview browser failed to create a WebGL context, which caused the app to stop before the game UI could render.

**How to apply:** Keep rendering paths in sync when adding new 3D scene features, and verify the no-WebGL preview path as well as the normal WebGL path.
