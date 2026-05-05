import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(145deg, #0a1420 0%, #13263b 58%, #d7ff64 100%)",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "rgba(8, 17, 27, 0.74)",
            border: "2px solid rgba(215, 255, 100, 0.88)",
            borderRadius: 36,
            display: "flex",
            height: 116,
            justifyContent: "center",
            width: 116,
          }}
        >
          <div
            style={{
              alignItems: "center",
              border: "7px solid #d7ff64",
              borderRadius: "50%",
              display: "flex",
              height: 66,
              justifyContent: "center",
              width: 66,
            }}
          >
            <div
              style={{
                background: "#d7ff64",
                borderRadius: "50%",
                height: 19,
                width: 19,
              }}
            />
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
