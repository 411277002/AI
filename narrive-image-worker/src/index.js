export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return Response.json(
        { success: false, message: "Only POST is allowed" },
        { status: 405, headers: corsHeaders() }
      );
    }

    try {
      const { prompt } = await request.json();

      if (!prompt) {
        return Response.json(
          { success: false, message: "缺少 prompt" },
          { status: 400, headers: corsHeaders() }
        );
      }

      const image = await env.AI.run(
        "@cf/stabilityai/stable-diffusion-xl-base-1.0",
        {
          prompt,
          num_steps: 20,
        }
      );

      return new Response(image, {
        headers: {
          ...corsHeaders(),
          "Content-Type": "image/png",
        },
      });
    } catch (error) {
      console.error("Workers AI error:", error);

      return Response.json(
        {
          success: false,
          message: "圖片生成失敗",
          error: error?.message || String(error),
          name: error?.name,
          stack: error?.stack,
        },
        { status: 500, headers: corsHeaders() }
      );
    }
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}