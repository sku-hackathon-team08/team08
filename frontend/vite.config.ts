import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, new URL("..", import.meta.url).pathname, "");
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "local-vworld-demo",
        transformIndexHtml(html, context) {
          if (context.path !== "/demo-map.html") return html;
          // Browser SDK credentials are inserted only into the local demo HTML, never the app bundle.
          const key =
            command === "serve" ? env.VWORLD_API_KEY?.trim() : undefined;
          const script = key
            ? `<script src="https://map.vworld.kr/js/webglMapInit.js.do?version=3.0&amp;apiKey=${encodeURIComponent(key)}"></script>`
            : "";
          return html.replace("<!-- VWORLD_SDK -->", script);
        },
      },
    ],
    server: { host: "127.0.0.1", port: 5173, strictPort: true },
  };
});
