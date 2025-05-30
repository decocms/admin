import { MCPClient } from "../fetcher.ts";

export const upsertWhatsAppUser = (
  workspace: string,
  phone: string,
  triggerUrl: string,
  triggerId: string,
  triggers: string[],
) =>
  MCPClient.forWorkspace(workspace).WHATSAPP_UPSERT_USER({
    phone,
    triggerUrl,
    triggerId,
    triggers,
  });

export const createWhatsAppInvite = (
  workspace: string,
  userId: string,
  triggerId: string,
  wppMessageId: string,
  phone: string,
) =>
  MCPClient.forWorkspace(workspace).WHATSAPP_CREATE_INVITE({
    userId,
    triggerId,
    wppMessageId,
    phone,
  });

export const getWhatsAppUser = (workspace: string, phone: string) =>
  MCPClient.forWorkspace(workspace).WHATSAPP_GET_USER({ phone });
