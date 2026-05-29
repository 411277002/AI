export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return Response.json(
        {
          success: false,
          message: "Only POST is allowed",
        },
        {
          status: 405,
          headers: corsHeaders(),
        }
      );
    }

    try {
      const body = await request.json();
      const { prompt } = body;

      if (!prompt) {
        return Response.json(
          {
            success: false,
            message: "缺少 prompt",
          },
          {
            status: 400,
            headers: corsHeaders(),
          }
        );
      }

      const image = await env.AI.run(
        "@cf/lykon/dreamshaper-8-lcm",
        {
          prompt,
        }
      );

      return new Response(image, {
        headers: {
          ...corsHeaders(),
          "Content-Type": "image/png",
        },
      });
    } catch (error) {
      return Response.json(
        {
          success: false,
          message: "圖片生成失敗",
          error: error?.message || String(error),
        },
        {
          status: 500,
          headers: corsHeaders(),
        }
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