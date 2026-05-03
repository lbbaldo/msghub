import { getEvolutionEnv } from "@/shared/config/env";

type EvolutionSendTextParams = {
  phone: string;
  message: string;
};

type EvolutionSendResponse = {
  key?: {
    id?: string;
  };
  message?: unknown;
};

const joinUrl = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

export const sendEvolutionTextMessage = async ({
  phone,
  message,
}: EvolutionSendTextParams): Promise<string | null> => {
  const env = getEvolutionEnv();
  const url = joinUrl(
    env.evolutionApiUrl,
    `/message/sendText/${env.evolutionInstanceName}`,
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.evolutionApiKey,
    },
    body: JSON.stringify({
      number: phone,
      text: message,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Evolution sendText failed with status ${response.status}: ${responseText}`,
    );
  }

  if (responseText.trim() === "") {
    return null;
  }

  const data = JSON.parse(responseText) as EvolutionSendResponse;

  return data.key?.id ?? null;
};
