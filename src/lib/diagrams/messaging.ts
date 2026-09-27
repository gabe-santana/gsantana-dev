import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/azure-service-bus-csharp-walkthrough.md
export const serviceBusOrderStatus = defineDiagram((t) => ({
  title: "SERVICE BUS",
  heading: t("ORDER STATUS PIPELINE", "PIPELINE DE STATUS DO PEDIDO"),
  accessible: t(
    "Order owners (Checkout, Payments, Warehouse, Carrier) publish status changes through OrderStatusPublisher with SessionId set to the order ID and MessageId set to order ID plus sequence. They land in the Service Bus queue order-status, with sessions on, max delivery 5, a one-minute lock and ten-minute duplicate detection; a scheduled PaymentTimeoutCheck arrives 30 minutes later. OrderStatusWorker, a session processor in PeekLock mode, completes, abandons or dead-letters each message and writes the last sequence per order to the order status store. Dead-lettered messages go to order-status/$DeadLetterQueue, which DeadLetterReprocessor drains on a manual run.",
    "Os donos do pedido (Checkout, Payments, Warehouse, Carrier) publicam mudanças de status pelo OrderStatusPublisher com SessionId igual ao ID do pedido e MessageId igual ao ID do pedido mais a sequência. Elas chegam à fila order-status do Service Bus, com sessões ativas, entrega máxima 5, lock de um minuto e detecção de duplicatas de dez minutos; um PaymentTimeoutCheck agendado chega 30 minutos depois. O OrderStatusWorker, um processador de sessões em modo PeekLock, conclui, abandona ou manda para a dead-letter cada mensagem e grava a última sequência por pedido no armazenamento de status. Mensagens na dead-letter vão para order-status/$DeadLetterQueue, que o DeadLetterReprocessor esvazia numa execução manual."
  ),
  desktop: {
    cols: [3, 2],
    rows: 4,
    nodes: [
      n("owners", 0, 0, "muted", t("Order owners", "Donos do pedido"), "Checkout, Payments, Warehouse, Carrier"),
      n("queue", 0, 1, "blue", t("Service Bus queue", "Fila do Service Bus"), [
        t("order-status: sessions, max delivery 5", "order-status: sessões, entrega máxima 5"),
        t("lock 1 min, duplicate detection 10 min", "lock 1 min, detecção de duplicatas 10 min"),
      ]),
      n("scheduled", 1, 1, "amber", t("Scheduled message", "Mensagem agendada"), "PaymentTimeoutCheck, +30 min"),
      n("worker", 0, 2, "accent", "OrderStatusWorker", [
        t("session processor, PeekLock", "processador de sessões, PeekLock"),
        "Complete, Abandon, DeadLetter",
      ]),
      n("store", 1, 2, "muted", t("Order status store", "Armazenamento de status"), t("LastSequence per order", "LastSequence por pedido")),
      n("dlq", 0, 3, "danger", "Dead-letter queue", "order-status/$DeadLetterQueue"),
      n("reproc", 1, 3, "violet", "DeadLetterReprocessor", t("manual run, dry run first", "execução manual, dry run antes")),
    ],
    edges: [
      e("owners", "queue", { tone: "blue", label: "SessionId = orderId · MessageId = orderId:sequence" }),
      e("scheduled", "queue", { tone: "amber", dashed: true }),
      e("queue", "worker", { tone: "accent", label: t("PeekLock, one session per order", "PeekLock, uma sessão por pedido") }),
      e("worker", "store", { tone: "accent" }),
      e("worker", "dlq", { tone: "danger", dashed: true, label: t("poison message", "mensagem envenenada") }),
      e("dlq", "reproc", { tone: "violet" }),
    ],
  },
  mobile: {
    cols: 2,
    rows: 5,
    nodes: [
      n("owners", 0, 0, "muted", t("Order owners", "Donos do pedido"), ["Checkout, Payments,", "Warehouse, Carrier"]),
      n("scheduled", 1, 0, "amber", t("Scheduled", "Agendada"), ["PaymentTimeoutCheck", "+30 min"]),
      n("queue", 0, 1, "blue", t("Service Bus queue", "Fila do Service Bus"), [
        t("order-status: sessions, max delivery 5", "order-status: sessões, entrega máxima 5"),
        t("lock 1 min, duplicates 10 min", "lock 1 min, duplicatas 10 min"),
      ], { span: 2 }),
      n("worker", 0, 2, "accent", "OrderStatusWorker", [
        t("sessions, PeekLock", "sessões, PeekLock"),
        "Complete, Abandon, DeadLetter",
      ], { span: 2 }),
      n("dlq", 0, 3, "danger", "Dead-letter queue", "$DeadLetterQueue"),
      n("store", 1, 3, "muted", t("Status store", "Status do pedido"), t("LastSequence", "LastSequence")),
      n("reproc", 0, 4, "violet", "DLQ reprocessor", t("manual run", "execução manual")),
    ],
    edges: [
      e("owners", "queue", { tone: "blue", toShift: -30 }),
      e("scheduled", "queue", { tone: "amber", dashed: true, toShift: 30 }),
      e("queue", "worker", { tone: "accent", label: "PeekLock" }),
      e("worker", "dlq", { tone: "danger", dashed: true, fromShift: -40 }),
      e("worker", "store", { tone: "accent", fromShift: 40 }),
      e("dlq", "reproc", { tone: "violet" }),
    ],
  },
}));

// content/posts/*/azure-service-bus-vs-event-grid-vs-event-hubs.md
export const messagingServices = defineDiagram((t) => {
  const zoneWorkflow = t("WORKFLOW: COMMANDS AND EVENTS", "FLUXO: COMANDOS E EVENTOS");
  const zoneStream = t("TELEMETRY STREAM", "STREAM DE TELEMETRIA");
  return {
    title: t("MESSAGING", "MENSAGERIA"),
    heading: t("ONE WORKLOAD, THREE SERVICES", "UM WORKLOAD, TRÊS SERVIÇOS"),
    accessible: t(
      "A customer calls the Orders API, which writes the order and an outbox row in one database transaction. An outbox relay publishes to Service Bus: the payments queue carries commands to the Payments service with PeekLock, and the orders topic fans out to Fraud review through a high-value SQL-filter subscription. After PaymentCaptured, the Inventory service publishes to the Event Grid topic inventory.stock.low, which pushes to a Purchasing webhook and a Notification Azure Function. Separately, web and mobile clicks stream into Event Hubs clickstream, 8 partitions keyed by sessionId, read by two consumer groups: analytics into Stream Analytics and recommendations into an ML feature pipeline.",
      "Um cliente chama a Orders API, que grava o pedido e uma linha de outbox na mesma transação. Um relay do outbox publica no Service Bus: a fila payments leva comandos ao serviço Payments com PeekLock, e o tópico orders distribui para a revisão de fraude por uma assinatura com filtro SQL de alto valor. Depois do PaymentCaptured, o serviço Inventory publica no tópico do Event Grid inventory.stock.low, que empurra para um webhook de Compras e uma Azure Function de notificação. À parte, cliques da web e do mobile entram no Event Hubs clickstream, com 8 partições por sessionId, lidos por dois consumer groups: analytics no Stream Analytics e recommendations num pipeline de features de ML."
    ),
    desktop: {
      cols: 4,
      rows: 7,
      rowH: 92,
      zones: [
        { col: 0, row: 0, span: 4, rowSpan: 5, tone: "muted", dashed: true, label: zoneWorkflow },
        { col: 0, row: 5, span: 4, rowSpan: 2, tone: "accent", dashed: true, label: zoneStream },
      ],
      nodes: [
        n("customer", 0, 0, "muted", t("Customer", "Cliente")),
        n("api", 1.5, 0, "blue", "Orders API", [t("order + outbox row", "pedido + linha de outbox"), t("one DB transaction", "uma transação no banco")]),
        n("sb", 1, 1, "blue", "Service Bus", [
          t("queue payments: commands", "fila payments: comandos"),
          t("topic orders: pub/sub", "tópico orders: pub/sub"),
        ], { span: 2 }),
        n("payments", 1, 2, "blue", "Payments", t("queue, PeekLock", "fila, PeekLock")),
        n("fraud", 2, 2, "blue", t("Fraud review", "Revisão de fraude"), t("high-value filter", "filtro de alto valor")),
        n("inventory", 1, 3, "muted", "Inventory"),
        n("grid", 2.5, 3, "amber", "Event Grid", "inventory.stock.low"),
        n("purchasing", 2, 4, "amber", t("Purchasing", "Compras"), "webhook"),
        n("notify", 3, 4, "amber", t("Notification", "Notificação"), "Azure Function"),
        n("clicks", 0, 5, "muted", t("Web + mobile clicks", "Cliques web + mobile")),
        n("hubs", 1.5, 5, "accent", "Event Hubs", [t("clickstream, 8 partitions", "clickstream, 8 partições"), "key = sessionId"]),
        n("stream", 1, 6, "accent", "Stream Analytics", t("group: analytics", "grupo: analytics")),
        n("ml", 2, 6, "accent", t("ML features", "Features de ML"), t("group: recommendations", "grupo: recommendations")),
      ],
      edges: [
        e("customer", "api", { tone: "blue" }),
        e("api", "sb", { tone: "blue", label: t("outbox relay", "relay do outbox") }),
        e("sb", "payments", { tone: "blue", fromShift: -60 }),
        e("sb", "fraud", { tone: "blue", fromShift: 60 }),
        e("payments", "inventory", { tone: "blue", label: "PaymentCaptured" }),
        e("inventory", "grid", { tone: "amber" }),
        e("grid", "purchasing", { tone: "amber", fromShift: -30, label: "push" }),
        e("grid", "notify", { tone: "amber", fromShift: 30, label: "push" }),
        e("clicks", "hubs", { tone: "accent" }),
        e("hubs", "stream", { tone: "accent", fromShift: -40 }),
        e("hubs", "ml", { tone: "accent", fromShift: 40 }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 7,
      rowH: 80,
      zones: [
        { col: 0, row: 0, span: 2, rowSpan: 5, tone: "muted", dashed: true, label: zoneWorkflow },
        { col: 0, row: 5, span: 2, rowSpan: 2, tone: "accent", dashed: true, label: zoneStream },
      ],
      nodes: [
        n("customer", 0, 0, "muted", t("Customer", "Cliente")),
        n("api", 1, 0, "blue", "Orders API", t("order + outbox", "pedido + outbox")),
        n("sb", 0, 1, "blue", "Service Bus", t("queue payments · topic orders", "fila payments · tópico orders"), { span: 2 }),
        n("payments", 0, 2, "blue", "Payments", "PeekLock"),
        n("fraud", 1, 2, "blue", t("Fraud review", "Revisão de fraude"), t("high-value filter", "filtro de alto valor")),
        n("inventory", 0, 3, "muted", "Inventory"),
        n("grid", 1, 3, "amber", "Event Grid", "inventory.stock.low"),
        n("purchasing", 0, 4, "amber", t("Purchasing", "Compras"), "webhook"),
        n("notify", 1, 4, "amber", t("Notification", "Notificação"), "Function"),
        n("clicks", 0, 5, "muted", t("Clicks", "Cliques"), "web + mobile"),
        n("hubs", 1, 5, "accent", "Event Hubs", t("8 partitions", "8 partições")),
        n("stream", 0, 6, "accent", "Stream Analytics", "analytics"),
        n("ml", 1, 6, "accent", t("ML features", "Features de ML"), "recommendations"),
      ],
      edges: [
        e("customer", "api", { tone: "blue" }),
        e("api", "sb", { tone: "blue" }),
        e("sb", "payments", { tone: "blue", fromShift: -40 }),
        e("sb", "fraud", { tone: "blue", fromShift: 40 }),
        e("payments", "inventory", { tone: "blue" }),
        e("inventory", "grid", { tone: "amber" }),
        e("grid", "purchasing", { tone: "amber" }),
        e("grid", "notify", { tone: "amber" }),
        e("clicks", "hubs", { tone: "accent" }),
        e("hubs", "stream", { tone: "accent" }),
        e("hubs", "ml", { tone: "accent" }),
      ],
    },
  };
});
