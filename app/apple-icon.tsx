import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#2f5d50" }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <path d="M14 22 L32 13 L50 22 L32 31 Z" fill="#e3eeea" />
          <path d="M14 32 L20 29 L32 35 L44 29 L50 32 L32 41 Z" fill="#a9d3c5" />
          <path d="M14 42 L20 39 L32 45 L44 39 L50 42 L32 51 Z" fill="#7cc4ad" />
        </svg>
      </div>
    ),
    size,
  );
}
