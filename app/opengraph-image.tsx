import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at top left, #bfe9f0 0%, transparent 55%), radial-gradient(circle at top right, #ffe0c2 0%, transparent 55%), linear-gradient(135deg, #fdf8f0 0%, #edf2f6 100%)",
          color: "#0b1725",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            padding: 60,
            borderRadius: 40,
            background: "rgba(255, 255, 255, 0.8)",
            boxShadow: "0 40px 120px -60px rgba(7, 18, 31, 0.55)",
            width: 960,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>
            ApplyFlow
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1 }}>
            Get more job interviews, with less busywork.
          </div>
          <div style={{ fontSize: 26, color: "#3b5068" }}>
            Build a living profile, discover better matches, and ship tailored applications with momentum.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
