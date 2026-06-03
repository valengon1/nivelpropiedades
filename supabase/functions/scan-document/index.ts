const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { imageBase64, width, height } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY") ?? "";

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64,
                  },
                },
                {
                  text: `This photo shows an Argentine DNI (identity card) placed on a surface. Image size: ${width}×${height} pixels.

Find the exact pixel coordinates of the 4 corners of the DNI card rectangle.

Return ONLY this JSON (no markdown, no explanation):
{"found":true,"tl":{"x":0,"y":0},"tr":{"x":0,"y":0},"bl":{"x":0,"y":0},"br":{"x":0,"y":0}}

tl=top-left, tr=top-right, bl=bottom-left, br=bottom-right.
Coordinates must be within 0-${width} for x and 0-${height} for y.

If no DNI card is visible, return only: {"found":false}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 200 },
        }),
      }
    );

    const geminiData = await geminiRes.json();
    const text: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    const match = text.match(/\{[\s\S]*\}/);
    const result = match ? JSON.parse(match[0]) : { found: false };

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("scan-document error:", err);
    return new Response(JSON.stringify({ found: false }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
