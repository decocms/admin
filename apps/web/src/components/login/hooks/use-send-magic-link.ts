import { useMutation } from "@tanstack/react-query";
import { DECO_CMS_API_URL } from "@deco/sdk";
import { toast } from "sonner";

export function useSendMagicLink() {
  return useMutation({
    mutationFn: (prop: { email: string; cli: boolean; next?: string }) =>
      fetch(new URL("/login/magiclink", DECO_CMS_API_URL), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prop),
      }).then((res) => {
        if (!res.ok) {
          throw new Error("Failed to send magic link");
        }
        return res.json();
      }),
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to send magic link",
      );
    },
  });
}
