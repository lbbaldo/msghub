export type SupportSettings = {
  customerWebhookEnabled: boolean;
  automaticBotMessagesEnabled: boolean;
  queueCriticalMinutes: number;
  staleTicketMinutes: number;
  urgentUnansweredMinutes: number;
  feedbackExpirationMinutes: number;
  lowFeedbackScore: number;
  openingMessage: string;
  finishMessage: string;
  restaurantRegistrationMessage: string;
  feedbackCommentPromptMessage: string;
  feedbackThanksMessage: string;
};

export const supportSettingsKey = "support";

export const defaultSupportSettings: SupportSettings = {
  customerWebhookEnabled: false,
  automaticBotMessagesEnabled: false,
  queueCriticalMinutes: 30,
  staleTicketMinutes: 20,
  urgentUnansweredMinutes: 60,
  feedbackExpirationMinutes: 1440,
  lowFeedbackScore: 2,
  openingMessage:
    "Olá! Recebemos sua mensagem e abrimos um atendimento para você. Nossa equipe vai te responder em breve.",
  finishMessage:
    "Seu atendimento foi finalizado. Para avaliar nosso suporte, responda com uma nota de 1 a 5.",
  restaurantRegistrationMessage:
    "Para cadastrar seu restaurante, envie por favor: nome do estabelecimento, CNPJ, endereço completo, responsável pelo cadastro e melhor telefone para contato.",
  feedbackCommentPromptMessage:
    "Obrigado pela nota. Se quiser, deixe um comentário sobre o atendimento.",
  feedbackThanksMessage:
    "Obrigado pela avaliação. Seu feedback ajuda a melhorar nosso atendimento.",
};
