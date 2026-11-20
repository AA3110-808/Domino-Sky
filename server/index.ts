import "dotenv/config";
import { createApp } from "./app.js";

const geminiChatCompletionsUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const port = Number(process.env.PORT ?? 3001);
const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const app = createApp({
  corsOrigins,
  ai: {
    apiKey: process.env.GEMINI_API_KEY,
    apiUrl: geminiChatCompletionsUrl,
    model: process.env.GEMINI_MODEL,
  },
});

app.listen(port, () => {
  console.log(`DOMINO SKY API listening on http://localhost:${port}`);
});
