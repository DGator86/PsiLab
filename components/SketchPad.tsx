"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Minimal pointer-drawing canvas. Calls onChange with a PNG data-URL after
 * each stroke (or null when cleared). Fixed internal resolution keeps the
 * exported sketch small enough for the 200KB server cap.
 */
export default function SketchPad({
  onChange,
  height = 260,
}: {
  onChange: (dataUrl: string | null) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0a0f1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#e8eef7";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    setHasInk(true);
    onChange(canvasRef.current?.toDataURL("image/png") ?? null);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#0a0f1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        style={{ height, touchAction: "none" }}
        className="w-full cursor-crosshair rounded-xl border border-card-border bg-black/30"
        aria-label="Sketch pad"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={clear}
          disabled={!hasInk}
          className="text-xs text-muted transition hover:text-foreground disabled:opacity-40"
        >
          Clear sketch
        </button>
      </div>
    </div>
  );
}
