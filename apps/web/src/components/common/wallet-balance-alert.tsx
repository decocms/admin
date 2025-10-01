import { useWorkspaceWalletBalance } from "@deco/sdk";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense } from "react";

interface WalletBalanceAlertProps {
  balance?: string;
  isLoading?: boolean;
  title?: string;
  balanceLabel?: string;
}

export function WalletBalanceAlertLayout({
  balance,
  isLoading = false,
  title = "This app may use your wallet",
  balanceLabel = "Your current balance",
}: WalletBalanceAlertProps) {
  const displayBalance = isLoading ? "Loading..." : balance || "$0.00";

  return (
    <Alert // deno-lint-ignore ensure-tailwind-design-system-tokens/ensure-tailwind-design-system-tokens
     className="bg-amber-100 border-amber-200 rounded-2xl p-1">
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Icon
            name="info"
            size={20}
            // deno-lint-ignore ensure-tailwind-design-system-tokens/ensure-tailwind-design-system-tokens
            className="text-amber-600"
          />
          <AlertDescription // deno-lint-ignore ensure-tailwind-design-system-tokens/ensure-tailwind-design-system-tokens
           className="text-amber-600 text-sm uppercase tracking-wide">
            {title}
          </AlertDescription>
        </div>

        <div className="bg-white rounded-xl p-3 mx-1 mb-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon
                name="account_balance_wallet"
                size={20}
                className="text-black"
              />
              <span className="text-sm font-medium text-foreground">
                {balanceLabel}
              </span>
            </div>
            <div className="text-lg font-normal text-muted-foreground">
              {displayBalance}
            </div>
          </div>
        </div>
      </div>
    </Alert>
  );
}

// Wrapper component that fetches wallet data
function WalletBalanceWithData() {
  const { balance, isRefetching } = useWorkspaceWalletBalance();

  return (
    <WalletBalanceAlertLayout
      balance={balance}
      isLoading={isRefetching}
    />
  );
}

// Main component with Suspense boundary
export function WalletBalanceAlert() {
  return (
    <Suspense fallback={<WalletBalanceAlertLayout isLoading />}>
      <WalletBalanceWithData />
    </Suspense>
  );
}
