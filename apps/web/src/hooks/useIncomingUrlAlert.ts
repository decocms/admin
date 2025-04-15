import { useSearchParams } from "react-router";
import { useEffect, useState } from "react";

export type WalletNotificationType = "success" | "error";

export interface WalletUrlAlert {
  type: WalletNotificationType;
  message: string;
}

export function useIncomingUrlAlert(): {
  alert: WalletUrlAlert | null;
  remove: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const [alert, setAlert] = useState<WalletUrlAlert | null>(null);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "true") {
      setAlert({
        type: "success",
        message: "Your deposit was successful!",
      });
    } else if (error === "canceled") {
      setAlert({
        type: "error",
        message: "Your deposit was canceled.",
      });
    }
  }, [searchParams]);

  const remove = () => {
    setAlert(null);
    setSearchParams({});
  };

  return { alert, remove };
}
