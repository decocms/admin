import {
  createWalletCheckoutSession,
  getWalletAccount,
  getWalletStatements,
} from "@deco/sdk";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@deco/ui/components/alert.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { trackEvent } from "../../hooks/analytics.ts";
import { useUser } from "../../hooks/data/useUser.ts";
import {
  useIncomingUrlAlert,
  WalletUrlAlert,
} from "../../hooks/useIncomingUrlAlert.ts";
import { Avatar } from "../common/Avatar.tsx";

const MINIMUM_AMOUNT = 200; // $2.00 in cents

function formatCurrency(value: string) {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");

  // Convert to number and format with 2 decimal places
  const amount = parseFloat(digits) / 100;

  // Format as currency
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function parseCurrency(value: string) {
  // Remove all non-digit characters
  return value.replace(/\D/g, "");
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function WalletAlert({
  alert,
  remove,
}: {
  alert: WalletUrlAlert;
  remove: () => void;
}) {
  if (alert.type === "success") {
    trackEvent("wallet_credit_success", {
      message: alert.message,
    });
  }

  return (
    <Alert
      variant={alert.type === "success" ? "default" : "destructive"}
      className="relative"
    >
      <AlertTitle>{capitalize(alert.type)}</AlertTitle>
      <AlertDescription>{alert.message}</AlertDescription>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2"
        onClick={remove}
      >
        <Icon name="close" size={16} />
      </Button>
    </Alert>
  );
}

function Wallet() {
  const queryStringAlert = useIncomingUrlAlert();
  const createCheckoutSession = useMutation({
    mutationFn: (amountInCents: number) =>
      createWalletCheckoutSession(amountInCents),
  });
  const user = useUser();
  const [creditAmount, setCreditAmount] = useState("");
  const [amountError, setAmountError] = useState("");

  useEffect(() => {
    if (queryStringAlert.alert?.type === "success") {
      trackEvent("wallet_credit_success", {
        message: queryStringAlert.alert.message,
      });
    }
  }, [queryStringAlert.alert]);

  const userAvatarURL = user?.metadata?.avatar_url ?? undefined;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const digits = parseCurrency(value);
    setCreditAmount(digits);
    setAmountError("");
  };

  const validateAmount = () => {
    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount < MINIMUM_AMOUNT) {
      setAmountError(
        `Minimum deposit amount is ${
          formatCurrency(MINIMUM_AMOUNT.toString())
        }`,
      );
      return false;
    }
    return true;
  };

  return (
    <div className="flex flex-col gap-4 items-center p-24">
      {queryStringAlert.alert
        ? (
          <WalletAlert
            alert={queryStringAlert.alert}
            remove={queryStringAlert.remove}
          />
        )
        : null}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="wallet" size={32} className="text-gray-700" />
          <div className="flex items-center gap-2">
            <Select defaultValue="personal">
              <SelectTrigger className="h-8!">
                <SelectValue placeholder="Select wallet type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">
                  <div className="flex items-center gap-2">
                    <Avatar
                      url={userAvatarURL}
                      fallback={user?.email}
                      className="rounded-full h-5 w-5"
                    />
                    <span>{user?.email}'s wallet</span>
                  </div>
                </SelectItem>
                <SelectItem value="team" disabled>
                  Team Wallet (Coming Soon)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-12 pb-8 items-center">
        <AccountValue />
        <span className="text-gray-700">Balance</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              onClick={() =>
                trackEvent("wallet_add_credits_click", {
                  userId: user?.id,
                })}
            >
              <Icon name="add" />
              Add credits
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add credits to your wallet</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="$0.00"
                  value={creditAmount ? formatCurrency(creditAmount) : ""}
                  onChange={handleAmountChange}
                />
                {amountError && (
                  <p className="text-sm text-red-500">{amountError}</p>
                )}
              </div>
              {createCheckoutSession.error
                ? (
                  <p className="text-red-500">
                    We could not create a checkout session for you now.
                    <br />
                    Please try again later.
                  </p>
                )
                : (
                  <Button
                    disabled={createCheckoutSession.isPending}
                    onClick={async () => {
                      if (!validateAmount()) return;

                      const amount = parseInt(creditAmount);
                      trackEvent("wallet_add_credits_submit", {
                        userId: user?.id,
                        amount: amount,
                        amountInDollars: formatCurrency(amount.toString()),
                      });
                      const result = await createCheckoutSession.mutateAsync(
                        amount,
                      );

                      if (result.checkoutUrl) {
                        globalThis.location.href = result.checkoutUrl;
                      }
                    }}
                  >
                    Add credits
                  </Button>
                )}
            </div>
          </DialogContent>
        </Dialog>
        <div className="pt-12">
          <Activity />
        </div>
      </div>
    </div>
  );
}

export default Wallet;
