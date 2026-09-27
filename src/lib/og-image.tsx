import { ImageResponse } from "next/og";

type SocialCard = {
  title: string;
  description: string;
  label: string;
  language: string;
};

export const ogImageSize = { width: 1200, height: 630 };
export const ogImageContentType = "image/png";

export function renderOgImage({ title, description, label, language }: SocialCard): ImageResponse {
  const fontSize = title.length > 90 ? 48 : title.length > 60 ? 58 : title.length > 35 ? 68 : 82;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
          padding: "64px 72px",
          backgroundColor: "#05070d",
          color: "#f3f5f8",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(ellipse at 85% 15%, rgba(94,234,212,0.19), transparent 50%), radial-gradient(ellipse at 5% 100%, rgba(167,139,250,0.15), transparent 55%)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: -110,
            top: 90,
            width: 520,
            height: 520,
            borderRadius: 110,
            border: "1px solid rgba(94,234,212,0.17)",
            transform: "rotate(-25deg)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: -10,
            top: 160,
            width: 320,
            height: 320,
            borderRadius: 70,
            border: "1px solid rgba(94,234,212,0.22)",
            transform: "rotate(-25deg)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 15, zIndex: 1 }}>
          <div style={{ display: "flex", width: 16, height: 16, borderRadius: 5, backgroundColor: "#5eead4", transform: "rotate(-25deg)" }} />
          <span style={{ fontSize: 27, fontWeight: 700, letterSpacing: -1 }}>gsantana.dev</span>
          <span style={{ color: "#8b93a7", fontSize: 23, marginLeft: "auto" }}>{language}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", zIndex: 1, maxWidth: 1020 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
            <div style={{ width: 28, height: 2, backgroundColor: "#5eead4" }} />
            <span style={{ color: "#5eead4", fontSize: 21, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>{label}</span>
          </div>
          <div style={{ display: "flex", fontSize, fontWeight: 800, lineHeight: 1.08, letterSpacing: -2.5, maxHeight: 280, overflow: "hidden" }}>{title}</div>
          <div style={{ display: "flex", fontSize: 26, lineHeight: 1.4, color: "#aab2c3", marginTop: 20, maxHeight: 72, overflow: "hidden", maxWidth: 880 }}>{description}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #293345", paddingTop: 25, zIndex: 1, color: "#aab2c3", fontSize: 21 }}>
          <span>Gabriel Santana</span>
          <span style={{ color: "#5eead4" }}>AI / SOFTWARE / TECHNOLOGY</span>
        </div>
      </div>
    ),
    ogImageSize
  );
}
