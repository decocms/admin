import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  createWalletCheckoutSession,
  getWalletAccount,
  getWalletStatements,
} from "@deco/sdk";
import { useUser } from "../../hooks/data/useUser.ts";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Avatar } from "../common/Avatar.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";

const MINIMUM_AMOUNT = 500; // $5.00 in cents

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

function AccountValue() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => getWalletAccount(),
  });

  if (isLoading) return <Skeleton className="w-24 h-8" />;
  if (error) return <p>Error loading wallet</p>;

  return <p className="text-4xl font-bold">{data?.balance}</p>;
}

function Activity() {
  const [cursor, setCursor] = useState("");
  const { data: statements, isLoading, error, isFetching } = useQuery({
    queryKey: ["wallet-statements", cursor],
    queryFn: () => getWalletStatements(cursor),
    placeholderData: keepPreviousData,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) return <p className="text-gray-500">Error loading statements</p>;
  if (!statements?.items.length) return <p className="text-gray-500">No activity yet</p>;

  return (
    <div className="min-w-96 max-w-2xl">
      <h3 className="text-gray-600 mb-4">Activity</h3>
      <div className="space-y-3">
        {statements.items.map((statement) => (
          <Dialog key={statement.id}>
            <DialogTrigger asChild>
              <div
                className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    statement.type === 'credit' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'
                  }`}>
                    {statement.icon ? (
                      <Icon name={statement.icon} size={16} />
                    ) : (
                      <Icon name={statement.type === 'credit' ? "paid" : "data_usage"} size={16} />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{statement.title}</p>
                    {statement.description && (
                      <p className="text-sm text-gray-500">{statement.description}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(statement.timestamp).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                <p className={`font-medium ${statement.type === 'credit' ? 'text-green-600' : 'text-gray-900'}`}>
                  {statement.amount}
                </p>
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Transaction Details</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      statement.type === 'credit' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'
                    }`}>
                      {statement.icon ? (
                        <Icon name={statement.icon} size={20} />
                      ) : (
                        <Icon name={statement.type === 'credit' ? "paid" : "data_usage"} size={20} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{statement.title}</p>
                      <p className={`text-lg font-medium ${statement.type === 'credit' ? 'text-green-600' : 'text-gray-900'}`}>
                        {statement.amount}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">
                      {new Date(statement.timestamp).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {statement.description && (
                      <p className="text-sm text-gray-600">{statement.description}</p>
                    )}
                  </div>

                  {statement.metadata && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-900">Details</p>
                      <div className="space-y-1">
                        {Object.entries(statement.metadata).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-gray-500">{key}</span>
                            <span className="text-gray-900">{value as string}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ))}
        {isFetching ? <div>Loading more...</div> : null}
        {statements?.nextCursor && (
          <Button className="w-full" variant="outline" onClick={() => setCursor(statements.nextCursor)}>
            Load more
          </Button>
        )}
      </div>
    </div>
  );
}

function Wallet() {
  const createCheckoutSession = useMutation({
    mutationFn: (amountInCents: number) =>
      createWalletCheckoutSession(amountInCents),
  });
  const user = useUser();
  const [creditAmount, setCreditAmount] = useState("");
  const [amountError, setAmountError] = useState("");

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
            <Button variant="outline">
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

                      const result = await createCheckoutSession.mutateAsync(
                        parseInt(creditAmount),
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
