import { MCPClient } from "../fetcher.ts";

export const upsertWhatsAppUser = (
  phone: string,
  triggerUrl: string,
  triggerId: string,
) => MCPClient.WHATSAPP_UPSERT_USER({ phone, triggerUrl, triggerId });

export const createWhatsAppInvite = (
  userId: string,
  triggerId: string,
  wppMessageId: string,
  phone: string,
) =>
  MCPClient.WHATSAPP_CREATE_INVITE({ userId, triggerId, wppMessageId, phone });

export const getWhatsAppUser = (phone: string) =>
  MCPClient.WHATSAPP_GET_USER({ phone });
