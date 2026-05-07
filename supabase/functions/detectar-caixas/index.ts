import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ItemCtx = {
  ean: string;
  descricao: string;
  unidade: string;
  qtd_esperada: number;
  qtd_conferida: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, itens } = (await req.json()) as {
      imageBase64: string;
      itens: ItemCtx[];
    };

    if (!imageBase64) {
      return json({ error: "imageBase64 é obrigatório" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const catalogo = (itens ?? [])
      .slice(0, 60)
      .map(
        (i) =>
          `- ${i.descricao} (EAN ${i.ean}, esperado ${i.qtd_esperada} ${i.unidade}, já conferido ${i.qtd_conferida})`,
      )
      .join("\n");

    const systemPrompt = `Você é um especialista em recebimento logístico de supermercados.
Analise a foto enviada (palete, caixas empilhadas, embalagens master) e estime:
- quantas caixas/unidades estão visíveis
- prováveis produtos (correlacionando com o catálogo da NF-e abaixo)
- TIPO de embalagem visível: "caixa_master" (caixa fechada com várias unidades dentro), "unidade" (peça avulsa) ou "desconhecida"
- quando for caixa_master, estime "unidades_por_caixa" se possível ler na embalagem (ex.: "12x500ml" => 12). Caso não consiga, use 1.
- divergências aparentes (caixa amassada, validade, embalagem rompida)
Seja conservador: prefira faixas e marque baixa confiança quando a imagem for ambígua.

Catálogo da NF-e (use os EANs/descrições para sugerir matches):
${catalogo || "(sem itens informados)"}`;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analise esta imagem de recebimento e retorne a contagem estruturada.",
            },
            { type: "image_url", image_url: { url: imageBase64 } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "registrar_deteccao",
            description: "Registrar contagem visual de caixas e sugestões.",
            parameters: {
              type: "object",
              properties: {
                total_caixas_estimadas: { type: "integer" },
                confianca: { type: "string", enum: ["alta", "media", "baixa"] },
                resumo: { type: "string" },
                sugestoes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      ean: { type: "string", description: "EAN do catálogo, vazio se desconhecido" },
                      descricao: { type: "string" },
                      qtd_detectada: { type: "integer" },
                      confianca: { type: "string", enum: ["alta", "media", "baixa"] },
                    },
                    required: ["descricao", "qtd_detectada", "confianca"],
                    additionalProperties: false,
                  },
                },
                alertas: {
                  type: "array",
                  items: { type: "string" },
                  description: "Avisos: avaria, validade visível, embalagem rompida, etc.",
                },
              },
              required: ["total_caixas_estimadas", "confianca", "resumo", "sugestoes", "alertas"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "registrar_deteccao" } },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (resp.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
    if (resp.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos no Lovable Cloud." }, 402);

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return json({ error: "Falha na IA visual" }, 500);
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;

    if (!args) return json({ error: "Resposta da IA sem detecção" }, 500);

    return json(args);
  } catch (e) {
    console.error("detectar-caixas error", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
