import { useMutation } from "@tanstack/react-query";
import { DECO_CMS_API_URL } from "@deco/sdk";

export function useSendMagicLink() {
  return useMutation({
    mutationFn: (prop: { email: string; cli: boolean }) =>
      fetch(new URL("/login/magiclink", DECO_CMS_API_URL), {
        method: "POST",
        body: JSON.stringify(prop),
      })
        .then((res) => res.ok)
        .catch(() => false),
  });
}
