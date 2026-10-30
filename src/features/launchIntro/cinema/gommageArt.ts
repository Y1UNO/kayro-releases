/**
 * The « Gommage » scene's two drawings, made once with Canvas 2D (white on transparent: the
 * shader colours them): the number painted on the monolith (the title font, italic), and one
 * gilded Art Nouveau corner (whiplash curves, a spiral, leaves, a small flower), mirrored by the
 * shader into the four corners. Original shapes.
 */
export function numberArt(text: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const x = c.getContext("2d");
  if (!x) return c;
  const family =
    getComputedStyle(document.documentElement).getPropertyValue("--font-title").trim() || "serif";
  x.fillStyle = "#fff";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.font = `italic 500 230px ${family}`;
  x.fillText(text, 256, 136);
  return c;
}

export function ornamentArt(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d");
  if (!x) return c;
  x.strokeStyle = "#fff";
  x.fillStyle = "#fff";
  x.lineCap = "round";
  x.lineJoin = "round";
  const path = (d: string, width: number) => {
    x.lineWidth = width;
    x.stroke(new Path2D(d));
  };
  // The long whiplash curve along the corner, and its twin, thinner.
  path("M30 500 C26 330 70 190 170 120 S380 40 500 34", 3.2);
  path("M52 470 C52 330 92 220 180 156 S360 76 470 66", 1.4);
  // A spiral in the corner.
  path("M96 96 C70 96 60 70 78 56 C98 40 128 58 124 86 C120 118 80 128 58 108", 2.4);
  // A curl and its leaves.
  path("M44 300 C96 260 130 210 116 164 C108 138 132 120 152 134", 2);
  path("M210 48 C240 90 290 104 330 92", 1.8);
  for (const [cx, cy, a] of [
    [150, 210, -0.8],
    [250, 120, -0.4],
    [86, 360, -1.2],
    [360, 70, -0.2],
  ] as const) {
    x.save();
    x.translate(cx, cy);
    x.rotate(a);
    x.lineWidth = 1.6;
    x.beginPath();
    x.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2);
    x.stroke();
    x.beginPath();
    x.moveTo(-16, 0);
    x.lineTo(16, 0);
    x.stroke();
    x.restore();
  }
  // A small five-petal flower and a few beads.
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    x.beginPath();
    x.ellipse(196 + Math.cos(a) * 9, 196 + Math.sin(a) * 9, 7, 4, a, 0, Math.PI * 2);
    x.fill();
  }
  for (const [bx, by, r] of [
    [140, 64, 3],
    [64, 140, 3],
    [300, 150, 2.4],
    [150, 300, 2.4],
  ] as const) {
    x.beginPath();
    x.arc(bx, by, r, 0, Math.PI * 2);
    x.fill();
  }
  return c;
}
