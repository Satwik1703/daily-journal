import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(circle at 30% 25%, #1f3a3a 0%, #122424 55%, #081414 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 140,
            height: 140,
            borderRadius: 9999,
            border: "9px solid #4fa896",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 98,
            height: 98,
            borderRadius: 9999,
            border: "8px solid #7fc7b9",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 60,
            height: 60,
            borderRadius: 9999,
            border: "6px solid #e0a96d",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 24,
            height: 24,
            borderRadius: 9999,
            background: "#f3c987",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
