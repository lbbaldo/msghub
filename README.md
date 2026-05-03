# hubaiq

Central web de atendimento WhatsApp para suporte aos restaurantes do aiqfome.

## MVP

- Webhook da Evolution API em `/api/webhooks/evolution`.
- Validação do header `x-api-key`.
- Criação automática de tickets por telefone.
- Histórico de mensagens recebidas, enviadas pelo painel e enviadas manualmente pelo WhatsApp (`fromMe = true`).
- Dashboard estilo WhatsApp Web com lista de tickets, chat, detalhes, assumir e finalizar.
- Envio de mensagens pela Evolution API.
- Notificação do atendente por WhatsApp quando chegar novo ticket.
- Comandos básicos pelo WhatsApp do atendente: assumir, responder e finalizar.

## Configuração local

1. Copie `.env.example` para `.env`.
2. Preencha as variáveis.
3. Suba os serviços locais:

```bash
docker compose up -d postgres evolution-api
```

4. Rode a migration:

```bash
psql "$DATABASE_URL" -f db/migrations/20260430151000_create_support_tables.sql
```

5. Inicie o app:

```bash
npm run dev
```

Login local criado pela configuração do `.env`:

```text
E-mail: SUPPORT_DEFAULT_ADMIN_EMAIL
Senha: SUPPORT_DEFAULT_ADMIN_PASSWORD
```

Evolution local:

```text
API: http://localhost:8081
Manager: http://localhost:8081/manager
API key: valor de EVOLUTION_API_KEY
Instância sugerida: suporte-teste
```

Configure a instância da Evolution API para enviar eventos para:

```text
POST http://host.docker.internal:3001/api/webhooks/evolution
x-api-key: valor-de-EVOLUTION_WEBHOOK_API_KEY
```

Eventos mínimos:

```text
MESSAGES_UPSERT
SEND_MESSAGE
```

## Atendente via WhatsApp

Configure o seu WhatsApp pessoal em `SUPPORT_ATTENDANT_WHATSAPP_NUMBER`, usando apenas o formato internacional com DDI e DDD:

```text
SUPPORT_ATTENDANT_WHATSAPP_NUMBER="55DDDNUMERO"
```

Quando um restaurante mandar mensagem para o número hub, o sistema abre ou atualiza o ticket e envia um aviso para esse número. Pelo WhatsApp do atendente, envie comandos para o número hub:

```text
ASSUMIR codigo
RESPONDER codigo mensagem
FINALIZAR codigo
```

O `codigo` aparece na notificação, por exemplo `ASSUMIR a1b2c3d4`.

## Fluxo de atendimento

- Atendentes entram no dashboard com login do sistema.
- Todas as respostas ao cliente saem pelo número hub conectado na Evolution API.
- Ao finalizar, o ticket fica em `aguardando_feedback` e o bot pede nota de 1 a 5.
- A nota não entra como mensagem normal no chat do atendente; ela fica salva no ticket para relatórios.
- Depois da nota, o bot agradece e o ticket passa para `finalizado`.
