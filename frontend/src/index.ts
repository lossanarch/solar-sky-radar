import "./components/jog-slider";
import "./editor";
import "./solar-sky-radar-card";

declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
      preview?: boolean;
      documentationURL?: string;
    }>;
  }
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "solar-sky-radar-card")) {
  window.customCards.push({
    type: "solar-sky-radar-card",
    name: "Solar Sky Radar",
    description:
      "Geostationary visible true-colour & solar cloud overlay with rain radar, 850hPa/10m wind streamlines, lightning, NASA FIRMS fires, and 2-hour jogging playback.",
    preview: true,
    documentationURL: "https://github.com/solar-sky-radar/solar-sky-radar",
  });
}

export { SolarSkyRadarCard } from "./solar-sky-radar-card";
export { SolarSkyRadarCardEditor } from "./editor";
