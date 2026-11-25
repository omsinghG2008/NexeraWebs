/* ==========================================================================
   NEXERA · js/bg-webgl.js
   --------------------------------------------------------------------------
   The site-wide background: a live, lit "demand map" behind every page.

   What you see
     A topographic contour map with soft 3D shading. Each line joins points
     of equal demand. Warm marigold areas are demand peaks. The map drifts
     slowly, travels with the scroll (parallax), and raises a glowing peak
     under the pointer, with a slower glow trailing behind it.

   How it works (plain WebGL, no library)
     1. This file creates ONE fixed <canvas class="site-bg"> behind the page.
     2. One full-screen triangle is drawn.
     3. The fragment shader builds a height field (soft noise + Gaussian
        peaks that repeat down the page), draws a thin anti-aliased line
        wherever the height crosses a whole number, and lights the slopes
        with a simple "sun" so the terrain looks raised.
     4. JavaScript only feeds it time, size, scroll and pointer position.

   Good behaviour built in
     - Falls back to the static contour image (set in css/base.css) when
       WebGL is unavailable or the GPU resets.
     - Pauses when the tab is hidden. Caps pixel density so phones stay cool.
     - Respects "reduce motion": one still frame, no drift, no pointer effect.
     - Continues the animation from where the previous page left off, so
       moving between pages looks like one continuous scene.
     - Calms down as you scroll, so body text always stays easy to read.

   To restyle:  edit CONFIG and the colour constants inside FRAGMENT_BODY.
   Colours match css/tokens.css.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- Settings you may want to change ---------- */
  const CONFIG = {
    maxPixelRatio: 1.25, // lower = faster on weak devices
    lineCount: 16, // contour lines across the full height range
    driftSpeed: 0.85, // 0 = peaks stand still
    stillFrameTime: 14.0, // which moment to show when motion is reduced
    topIntensity: 1.0, // map strength at the very top of a page (0 to 1)
    pageIntensity: 0.5, // map strength further down, behind long text
    fadeDistance: 0.9, // screens of scrolling over which the map calms down
    scrollParallax: 0.3, // how far the map travels per screen scrolled
    relief: 0.22, // strength of the 3D light and shadow (0 = flat)
    pointerEase: 5, // higher = the pointer peak follows more tightly
    trailEase: 1.8, // lower = the trailing glow lags further behind
    scrollEase: 3.5, // higher = scroll effects settle faster
    storageKey: "nx-bg-time",
  };

  /* ---------- Shader source ---------- */

  /* Version headers differ between WebGL2 (GLSL 3.00) and WebGL1 (GLSL 1.00). */
  const HEADER_GL2 =
    "#version 300 es\nprecision highp float;\nout vec4 outColor;\n";
  const HEADER_GL1 =
    "#extension GL_OES_standard_derivatives : enable\nprecision highp float;\n#define outColor gl_FragColor\n";

  const VERTEX_GL2 =
    "#version 300 es\nin vec2 aPos;\nvoid main(){ gl_Position = vec4(aPos, 0.0, 1.0); }";
  const VERTEX_GL1 =
    "attribute vec2 aPos;\nvoid main(){ gl_Position = vec4(aPos, 0.0, 1.0); }";

  /* The picture itself. Works unchanged in both GLSL versions. */
  const FRAGMENT_BODY = `
    uniform vec2  uRes;         // canvas size in pixels
    uniform float uTime;        // seconds
    uniform vec2  uPointer;     // 0..1, origin bottom-left (follows tightly)
    uniform vec2  uTrail;       // 0..1, same, but lags behind
    uniform float uPower;       // 0..1, how strongly the pointer peak shows
    uniform float uLevels;      // number of contour lines
    uniform float uScroll;      // how far the map has travelled with the scroll
    uniform float uIntensity;   // 1 = full strength, lower = calmer
    uniform float uRelief;      // strength of the 3D shading

    /* Brand colours (see css/tokens.css) */
    const vec3 PAPER = vec3(0.961, 0.969, 0.980);   /* #F5F7FA page background   */
    const vec3 MINOR = vec3(0.600, 0.660, 0.760);   /* regular contour lines     */
    const vec3 MAJOR = vec3(0.137, 0.275, 0.851);   /* every 4th line, cobalt    */
    const vec3 GOLD  = vec3(1.000, 0.690, 0.000);   /* peak colour, marigold     */
    const vec3 GOLDW = vec3(1.000, 0.890, 0.540);   /* soft wash inside peaks    */
    const vec3 GOLDL = vec3(0.850, 0.500, 0.000);   /* contour lines on peaks    */

    /* --- smooth value noise --- */
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {                       /* four layers of noise */
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.3, 9.1); a *= 0.5; }
      return v;
    }

    /* A round hill of height 1 at c; s sets how wide it is. */
    float hill(vec2 p, vec2 c, float s) {
      vec2 d = p - c;
      return exp(-dot(d, d) / s);
    }

    /* The "demand" height at a point. Peaks repeat every BAND screens down the page. */
    float demand(vec2 p, float aspect, float t) {
      const float BAND = 1.6;
      float h = 0.38 * fbm(p * 1.5 + vec2(t * 0.020, -t * 0.014));          /* gentle rolling ground */
      vec2 q = vec2(p.x, mod(p.y, BAND));
      for (int k = -1; k <= 1; k++) {
        vec2 r = q - vec2(0.0, BAND * float(k));
        h += 0.62 * hill(r, vec2(aspect * 0.80 + 0.05 * sin(t * 0.17), 0.58 + 0.05 * cos(t * 0.13)), 0.060);  /* main peak   */
        h += 0.36 * hill(r, vec2(aspect * 0.60 + 0.04 * cos(t * 0.11), 0.30 + 0.04 * sin(t * 0.19)), 0.035);  /* second peak */
        h += 0.26 * hill(r, vec2(aspect * 0.93 + 0.03 * sin(t * 0.15), 0.16 + 0.03 * cos(t * 0.21)), 0.028);  /* small peak  */
        h += 0.50 * hill(r, vec2(aspect * 0.22 + 0.04 * sin(t * 0.14), 1.12 + 0.04 * cos(t * 0.16)), 0.050);  /* far peak    */
        h += 0.30 * hill(r, vec2(aspect * 0.52 + 0.03 * cos(t * 0.18), 1.40 + 0.03 * sin(t * 0.12)), 0.032);  /* far ridge   */
      }
      return h;
    }

    void main() {
      float aspect = uRes.x / uRes.y;
      vec2  p  = gl_FragCoord.xy / uRes.y;                  /* y runs 0..1, x runs 0..aspect */
      p.y -= uScroll;                                       /* the map travels with the scroll */
      float t  = uTime;

      float h = demand(p, aspect, t);

      /* The visitor's peak (tight) and a softer glow that trails behind it. */
      vec2 pointerAt = vec2(uPointer.x * aspect, uPointer.y - uScroll);
      vec2 trailAt   = vec2(uTrail.x   * aspect, uTrail.y   - uScroll);
      h += uPower * 0.60 * hill(p, pointerAt, 0.020);
      h += uPower * 0.30 * hill(p, trailAt,   0.070);

      /* Contour lines: distance (in level units) to the nearest whole number. */
      float level = h * uLevels;
      float dist  = abs(fract(level + 0.5) - 0.5);
      float w     = fwidth(level);                           /* how many levels fit in one pixel */
      float major = step(mod(floor(level + 0.5), 4.0), 0.5); /* 1.0 on every 4th line */
      float width = mix(0.55, 0.95, major);                  /* major lines are a little thicker */
      float line  = 1.0 - smoothstep(w * width * 0.5, w * width * 0.5 + w * 1.1, dist);
      line *= 1.0 - smoothstep(0.35, 0.8, w);                /* fade lines that would be too dense to see */

      /* Warm wash that grows with height, so peaks glow softly. */
      float peak = smoothstep(0.52, 1.05, h);
      vec3 col = mix(PAPER, GOLDW, peak);
      col = mix(col, GOLD, smoothstep(0.90, 1.35, h) * 0.75);

      /* Lines are grey-blue on low ground and switch to amber inside a peak (narrow band, so no muddy mixes). */
      vec3 ink = mix(MINOR, MAJOR, major);
      ink = mix(ink, GOLDL, smoothstep(0.69, 0.74, h));
      col = mix(col, ink, line * mix(0.62, 0.95, major));

      /* 3D relief: light the slopes from the upper left, so hills look raised. */
      vec2  slope = vec2(dFdx(h), dFdy(h)) * uRes.y;         /* height change per screen height */
      vec3  n     = normalize(vec3(-slope * 0.35, 1.0));
      vec3  sun   = normalize(vec3(-0.55, 0.65, 0.55));
      col += (dot(n, sun) - sun.z) * uRelief;

      outColor = vec4(mix(PAPER, col, uIntensity), 1.0);
    }
  `;

  /* ---------- Create the canvas and start WebGL (WebGL2 first, then WebGL1) ---------- */
  /* If the live map cannot start, put the static fallback image back (and forget that it worked). */
  const fail = () => {
    document.documentElement.classList.remove("bg-live");
    try {
      sessionStorage.removeItem("nx-bg-ok");
    } catch (error) {
      /* ignore */
    }
  };

  const canvas = document.createElement("canvas");
  canvas.className = "site-bg";
  canvas.setAttribute("aria-hidden", "true");

  const contextOptions = {
    antialias: false,
    alpha: false,
    powerPreference: "low-power",
  };
  let gl = canvas.getContext("webgl2", contextOptions);
  const isGL2 = !!gl;
  if (!gl) {
    gl = canvas.getContext("webgl", contextOptions);
    if (!gl || !gl.getExtension("OES_standard_derivatives")) {
      fail();
      return;
    } // no support: keep the static image
  }

  /* Compile one shader and report any problem in the console. */
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn(
        "[NEXERA background] shader error:",
        gl.getShaderInfoLog(shader),
      );
      return null;
    }
    return shader;
  }

  const vertexShader = compile(
    gl.VERTEX_SHADER,
    isGL2 ? VERTEX_GL2 : VERTEX_GL1,
  );
  const fragmentShader = compile(
    gl.FRAGMENT_SHADER,
    (isGL2 ? HEADER_GL2 : HEADER_GL1) + FRAGMENT_BODY,
  );
  if (!vertexShader || !fragmentShader) {
    fail();
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn(
      "[NEXERA background] link error:",
      gl.getProgramInfoLog(program),
    );
    fail();
    return;
  }
  gl.useProgram(program);

  /* One triangle that covers the whole screen. */
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = {};
  [
    "uRes",
    "uTime",
    "uPointer",
    "uTrail",
    "uPower",
    "uLevels",
    "uScroll",
    "uIntensity",
    "uRelief",
  ].forEach((name) => {
    uniform[name] = gl.getUniformLocation(program, name);
  });
  gl.uniform1f(uniform.uLevels, CONFIG.lineCount);
  gl.uniform1f(uniform.uRelief, CONFIG.relief);

  const reduceMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Animation state ---------- */
  const state = {
    x: 0.7,
    y: 0.5,
    tx: 0.7,
    ty: 0.5, // pointer peak, trailing glow (both smoothed)
    targetX: 0.7,
    targetY: 0.5, // where the pointer really is
    power: 0,
    targetPower: 0, // 0 = no pointer peak
    scroll: 0,
    targetScroll: 0, // map travel caused by scrolling
    intensity: CONFIG.topIntensity,
    targetIntensity: CONFIG.topIntensity,
    running: false,
    frameId: 0,
    last: 0,
    startedAt: performance.now(),
  };

  /* Carry the animation clock over from the previous page, so pages feel like one scene. */
  try {
    const carried = Number(sessionStorage.getItem(CONFIG.storageKey));
    if (carried > 0) state.startedAt -= carried * 1000;
  } catch (error) {
    /* storage blocked: start from zero */
  }
  window.addEventListener("pagehide", () => {
    try {
      sessionStorage.setItem(
        CONFIG.storageKey,
        String((performance.now() - state.startedAt) / 1000),
      );
    } catch (error) {
      /* ignore */
    }
  });

  /* Work out where the scroll wants the map and how calm it should be. */
  function readScroll() {
    const screens = window.scrollY / Math.max(window.innerHeight, 1);
    const calm = Math.min(Math.max(screens / CONFIG.fadeDistance, 0), 1);
    const smooth = calm * calm * (3 - 2 * calm);
    state.targetScroll = screens * CONFIG.scrollParallax;
    state.targetIntensity =
      CONFIG.topIntensity +
      (CONFIG.pageIntensity - CONFIG.topIntensity) * smooth;
    if (!state.running && reduceMotion()) {
      // still frame: no easing, just keep text readable
      state.intensity = state.targetIntensity;
      draw(CONFIG.stillFrameTime);
    }
  }

  /* Match the canvas bitmap to its on-screen size. */
  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  /* Draw a single frame at time `seconds`. */
  function draw(seconds) {
    gl.uniform2f(uniform.uRes, canvas.width, canvas.height);
    gl.uniform1f(uniform.uTime, seconds * CONFIG.driftSpeed); // driftSpeed scales how fast peaks wander
    gl.uniform2f(uniform.uPointer, state.x, state.y);
    gl.uniform2f(uniform.uTrail, state.tx, state.ty);
    gl.uniform1f(uniform.uPower, state.power);
    gl.uniform1f(uniform.uScroll, state.scroll);
    gl.uniform1f(uniform.uIntensity, state.intensity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* Animation loop. Easing uses the real time between frames, so it feels the same at 60 or 144 Hz. */
  function frame(now) {
    const dt = Math.min((now - state.last) / 1000, 0.1);
    state.last = now;
    const follow = (rate) => 1 - Math.exp(-rate * dt);

    state.x += (state.targetX - state.x) * follow(CONFIG.pointerEase);
    state.y += (state.targetY - state.y) * follow(CONFIG.pointerEase);
    state.tx += (state.targetX - state.tx) * follow(CONFIG.trailEase);
    state.ty += (state.targetY - state.ty) * follow(CONFIG.trailEase);
    state.power += (state.targetPower - state.power) * follow(4);
    state.scroll +=
      (state.targetScroll - state.scroll) * follow(CONFIG.scrollEase);
    state.intensity +=
      (state.targetIntensity - state.intensity) * follow(CONFIG.scrollEase);

    draw((now - state.startedAt) / 1000);
    state.frameId = requestAnimationFrame(frame);
  }

  function start() {
    if (state.running || reduceMotion()) return;
    state.running = true;
    state.last = performance.now();
    state.frameId = requestAnimationFrame(frame);
  }
  function stop() {
    state.running = false;
    cancelAnimationFrame(state.frameId);
  }

  /* ---------- First paint ---------- */
  document.body.prepend(canvas);
  readScroll();
  state.scroll = state.targetScroll; // start in place, no easing on load
  state.intensity = state.targetIntensity;
  resize();
  draw(
    reduceMotion()
      ? CONFIG.stillFrameTime
      : (performance.now() - state.startedAt) / 1000,
  );
  document.documentElement.classList.add("bg-live"); // hides the static fallback image
  try {
    sessionStorage.setItem("nx-bg-ok", "1");
  } catch (error) {
    /* ignore */
  } // lets the next page hide it before the first paint
  start();

  /* ---------- Events ---------- */

  /* Keep the bitmap sharp when the layout changes (and redraw when nothing is animating). */
  new ResizeObserver(() => {
    resize();
    if (!state.running)
      draw(
        reduceMotion()
          ? CONFIG.stillFrameTime
          : (performance.now() - state.startedAt) / 1000,
      );
  }).observe(canvas);

  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("resize", readScroll, { passive: true });

  /* Pointer: listen on the whole window so the peak follows the cursor over text, cards and forms. */
  function movePointer(event) {
    if (reduceMotion()) return;
    state.targetX = event.clientX / Math.max(canvas.clientWidth, 1);
    state.targetY = 1 - event.clientY / Math.max(canvas.clientHeight, 1); // WebGL's y axis points up
    state.targetPower = 1;
  }
  const releasePointer = (event) => {
    if (event.pointerType === "touch") state.targetPower = 0;
  }; // lift finger = lower peak
  window.addEventListener("pointermove", movePointer, { passive: true });
  window.addEventListener("pointerdown", movePointer, { passive: true });
  window.addEventListener("pointerup", releasePointer, { passive: true });
  window.addEventListener("pointercancel", releasePointer, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => {
    state.targetPower = 0;
  }); // mouse left the window

  /* Save battery: stop drawing when the tab is hidden. */
  document.addEventListener("visibilitychange", () => {
    document.hidden ? stop() : start();
  });

  /* If the GPU resets, fall back to the static image instead of showing a blank screen. */
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stop();
    fail();
  });
})();
