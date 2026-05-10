import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0f1f1f 0%, #1f3a3a 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#5fb3a3",
          fontSize: 280,
          fontWeight: 600,
          fontFamily: "serif",
        }}
      >
        h
      </div>
    ),
    { ...size },
  );
}
