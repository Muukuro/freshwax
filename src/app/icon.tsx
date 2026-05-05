import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(145deg, #0a1420 0%, #13263b 58%, #d7ff64 100%)",
          color: "#d7ff64",
          display: "flex",
          fontFamily: "Arial, sans-serif",
          height: "100%",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "rgba(8, 17, 27, 0.74)",
            border: "5px solid rgba(215, 255, 100, 0.88)",
            borderRadius: 104,
            boxShadow: "0 42px 120px rgba(0, 0, 0, 0.34)",
            display: "flex",
            height: 332,
            justifyContent: "center",
            width: 332,
          }}
        >
          <div
            style={{
              alignItems: "center",
              border: "18px solid #d7ff64",
              borderRadius: "50%",
              display: "flex",
              height: 190,
              justifyContent: "center",
              width: 190,
            }}
          >
            <div
              style={{
                background: "#d7ff64",
                borderRadius: "50%",
                height: 54,
                width: 54,
              }}
            />
          </div>
        </div>
        <div
          style={{
            background: "#7ab0ff",
            borderRadius: "50%",
            height: 28,
            position: "absolute",
            right: 156,
            top: 154,
            width: 28,
          }}
        />
      </div>
    ),
    {
      ...size,
    },
  );
}
