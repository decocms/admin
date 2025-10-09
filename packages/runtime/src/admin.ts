import { createChannel } from "bidc";

export const requestMissingScopes = ({ scopes }: { scopes: string[] }) => {
  try {
    const channel = createChannel();
    channel.send({
      type: "request_missing_scopes",
      payload: {
        scopes,
      },
    });
    channel.cleanup();
  } catch (error) {
    console.error("Failed to request missing scopes", error);
  }
};
