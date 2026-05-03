const readRequiredEnv = (key: string): string => {
  const value = process.env[key];

  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const readOptionalEnv = (key: string): string | null => {
  const value = process.env[key];

  return value && value.trim() !== "" ? value : null;
};

export const getDatabaseEnv = () => ({
  databaseUrl: readRequiredEnv("DATABASE_URL"),
});

export const getEvolutionEnv = () => ({
  evolutionApiUrl: readRequiredEnv("EVOLUTION_API_URL"),
  evolutionApiKey: readRequiredEnv("EVOLUTION_API_KEY"),
  evolutionInstanceName: readRequiredEnv("EVOLUTION_INSTANCE_NAME"),
});

export const getWebhookEnv = () => ({
  webhookApiKey: readRequiredEnv("EVOLUTION_WEBHOOK_API_KEY"),
});

export const getSupportEnv = () => ({
  attendantWhatsappNumber: readOptionalEnv("SUPPORT_ATTENDANT_WHATSAPP_NUMBER"),
  attendantGroupJid: readOptionalEnv("SUPPORT_ATTENDANT_GROUP_JID"),
});

export const getAuthEnv = () => ({
  sessionSecret: readRequiredEnv("APP_SESSION_SECRET"),
  defaultAdminName: readRequiredEnv("SUPPORT_DEFAULT_ADMIN_NAME"),
  defaultAdminEmail: readRequiredEnv("SUPPORT_DEFAULT_ADMIN_EMAIL"),
  defaultAdminPassword: readRequiredEnv("SUPPORT_DEFAULT_ADMIN_PASSWORD"),
});
