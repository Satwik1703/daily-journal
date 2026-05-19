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
            width: 400,
            height: 400,
            borderRadius: 9999,
            border: "26px solid #4fa896",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 280,
            height: 280,
            borderRadius: 9999,
            border: "22px solid #7fc7b9",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 170,
            height: 170,
            borderRadius: 9999,
            border: "16px solid #e0a96d",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 70,
            height: 70,
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
