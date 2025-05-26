import { bypass } from "../assertions.ts";
import { createTool, getEnv } from "../context.ts";
import { z } from "zod";

export const sendWhatsAppTemplateMessage = createTool({
  name: "WHATSAPP_SEND_TEMPLATE_MESSAGE",
  description: "Send a template message to a whatsapp number",
  inputSchema: z.object({
    to: z.string(),
    template_name: z.string(),
    language_code: z.string(),
    sender_phone: z.string(),
    sender_name: z.string(),
    agent_name: z.string(),
  }),
  canAccess: bypass,
  handler: async (
    { to, template_name, language_code, sender_phone, sender_name, agent_name },
    c,
  ) => {
    const env = getEnv(c);
    const response = await fetch(
      `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "template",
          template: {
            name: template_name,
            language: {
              code: language_code,
            },
            components: [
              {
                type: "body",
                parameters: [
                  {
                    type: "text",
                    text: sender_name,
                  },
                  {
                    type: "text",
                    text: sender_phone,
                  },
                  {
                    type: "text",
                    text: agent_name,
                  },
                ],
              },
            ],
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to send whatsapp message");
    }
    const data = await response.json() as { messages: { id: string }[] };
    console.log({ data });
    return {
      wppMessageId: data.messages[0].id,
      to: to,
    };
  },
});

export const createWhatsAppInvite = createTool({
  name: "WHATSAPP_CREATE_INVITE",
  description: "Create a whatsapp invite",
  inputSchema: z.object({
    userId: z.string(),
    triggerId: z.string(),
    wppMessageId: z.string(),
    phone: z.string(),
  }),
  canAccess: bypass,
  handler: async ({ userId, triggerId, wppMessageId, phone }, c) => {
    console.log({ userId, triggerId, wppMessageId, phone });
    const db = c.db;

    const { data: alreadyInvited, error: alreadyInvitedError } = await db.from(
      "deco_chat_temp_wpp_invites",
    )
      .select("wpp_message_id").eq("phone", phone).eq("user_id", userId).eq(
        "trigger_id",
        triggerId,
      ).maybeSingle();

    if (alreadyInvitedError) {
      throw new Error(alreadyInvitedError.message);
    }

    if (alreadyInvited) {
      throw new Error("User already invited to this trigger");
    }

    const { error } = await db.from("deco_chat_temp_wpp_invites").insert({
      phone: phone,
      trigger_id: triggerId,
      wpp_message_id: wppMessageId,
      user_id: userId,
      // TODO: @franca this needs to come from the Meta API
      accept_message: "Aceitar",
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  },
});

export const upsertWhatsAppUser = createTool({
  name: "WHATSAPP_UPSERT_USER",
  description:
    "Inserts or updates a whatsapp user for the whatsapp integration based on userId",
  inputSchema: z.object({
    phone: z.string(),
    triggerUrl: z.string(),
    triggerId: z.string(),
  }),
  canAccess: bypass,
  handler: async ({ phone, triggerUrl, triggerId }, c) => {
    console.log({ phone, triggerUrl, triggerId });
    const { error } = await c.db
      .from("deco_chat_temp_wpp_users")
      .upsert({
        phone: phone,
        trigger_url: triggerUrl,
        trigger_id: triggerId,
      });

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
    };
  },
});

export const getWhatsAppUser = createTool({
  name: "WHATSAPP_GET_USER",
  description:
    "Get a whatsapp user for the whatsapp integration based on userId",
  inputSchema: z.object({
    phone: z.string(),
  }),
  canAccess: bypass,
  handler: async ({ phone }, c) => {
    const { data, error } = await c.db
      .from("deco_chat_temp_wpp_users")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },
});
