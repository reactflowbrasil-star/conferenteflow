import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64 } = (await req.json()) as { imageBase64: string };
    if (!imageBase64) return json({ error: "imageBase64 é obrigatório" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const systemPrompt = `Você é um OCR especializado em NF-e (Nota Fiscal Eletrônica) brasileira de supermercado.
Analise a foto/DANFE e extraia:
- numero_nf (número da nota)
- serie (série)
- chave_acesso (44 dígitos, se visível)
- fornecedor (razão social do emitente)
- cnpj (do emitente, formato 00.000.000/0000-00)
- data_emissao (YYYY-MM-DD)
- valor_total (número, em reais)
- itens: lista com codigo (EAN/código), descricao, unidade (UN/CX/KG/...), quantidade, preco_unitario, valor_total
Seja rigoroso: se não conseguir ler com confiança, deixe o campo vazio (string) ou null.
Não invente dados. Quantidades e preços devem refletir exatamente o que está impresso.`;

    const body = {
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia os dados estruturados desta NF-e." },
            { type: "image_url", image_url: { url: imageBase64 } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "registrar_nf",
            description: "Registrar dados estruturados da NF-e.",
            parameters: {
              type: "object",
              properties: {
                numero_nf: { type: "string" },
                serie: { type: "string" },
                chave_acesso: { type: "string" },
                fornecedor: { type: "string" },
                cnpj: { type: "string" },
                data_emissao: { type: "string" },
                valor_total: { type: "number" },
                confianca: { type: "string", enum: ["alta", "media", "baixa"] },
                observacao: { type: "string" },
                itens: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      codigo: { type: "string", description: "EAN ou código interno" },
                      descricao: { type: "string" },
                      unidade: { type: "string" },
                      quantidade: { type: "number" },
                      preco_unitario: { type: "number" },
                      valor_total: { type: "number" },
                    },
                    required: ["descricao", "quantidade"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["numero_nf", "fornecedor", "itens", "confianca"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "registrar_nf" } },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (resp.status === 429)
      return json({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
    if (resp.status === 402)
      return json({ error: "Créditos de IA esgotados. Adicione créditos no Lovable Cloud." }, 402);

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return json({ error: "Falha na leitura da NF" }, 500);
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
    if (!args) return json({ error: "Resposta da IA sem dados estruturados" }, 500);

    return json(args);
  } catch (e) {
    console.error("ler-nota error", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
