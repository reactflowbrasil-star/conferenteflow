export const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export const formatDateTime = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const formatCurrency = (n?: number | null) =>
  typeof n === "number"
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

export const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_conferencia: "Em conferência",
  finalizado: "Finalizado",
  com_divergencia: "Com divergência",
  ok: "OK",
  divergencia: "Divergência",
  sobra: "Sobra",
  falta: "Falta",
  avaria: "Avaria",
};
