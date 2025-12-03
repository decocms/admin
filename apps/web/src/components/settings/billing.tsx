import {
  type BillingHistoryItem,
  useBillingHistory,
  useIntegrations,
  usePlan,
  useWorkspaceWalletBalance,
} from "@deco/sdk";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Progress } from "@deco/ui/components/progress.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Suspense, useMemo, useState } from "react";
import { ErrorBoundary } from "../../error-boundary.tsx";
import {
  Table,
  type TableColumn,
} from "@deco/ui/components/collection-table.tsx";
import { DepositDialog } from "../wallet/deposit-dialog.tsx";
import { VoucherDialog } from "../wallet/voucher-dialog.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";
import { Link } from "react-router";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";

function WalletBalanceCard() {
  const { balance, refetch, isRefetching } = useWorkspaceWalletBalance();

  return (
    <div className="rounded-xl bg-secondary border overflow-hidden h-full flex flex-col min-w-0">
      <Card className="p-6 border-none flex-1 min-w-0">
        <CardContent className="p-0 h-full flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon
                name="account_balance_wallet"
                size={16}
                className="text-muted-foreground"
              />
              <span className="text-sm font-medium text-muted-foreground">
                Remaining Balance
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refetch}
              disabled={isRefetching}
              className="p-2 h-8 w-8"
            >
              <Icon name="refresh" size={16} />
            </Button>
          </div>

          <div className="text-4xl sm:text-5xl font-semibold text-foreground mb-6 break-words">
            {balance}
          </div>

          <div className="flex flex-wrap gap-2 mt-auto">
            <div className="flex-1 min-w-[120px]">
              <DepositDialog />
            </div>
            <div className="flex-1 min-w-[120px]">
              <VoucherDialog />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanInfoCard() {
  const plan = usePlan();

  const usedSeats = plan.user_seats - plan.remainingSeats;
  const seatLimit = plan.user_seats;

  return (
    <Card className="p-6 rounded-xl border h-full min-w-0">
      <CardContent className="p-0 h-full flex flex-col min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Icon
              name="workspace_premium"
              size={20}
              className="text-muted-foreground"
            />
            <span className="text-sm font-medium text-muted-foreground">
              Current Plan
            </span>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-medium text-foreground break-words">
            {plan.title}
          </h2>
        </div>

        <div className="space-y-4 text-sm flex-1">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seats used</span>
              <span className="font-medium">
                {usedSeats}/{seatLimit}
              </span>
            </div>
            <Progress value={(usedSeats / seatLimit) * 100} className="h-3" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monthly cost</span>
            <span className="font-medium">
              ${plan.monthly_credit_in_dollars}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deposit fee</span>
            <span className="font-medium">{plan.markup}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ContractProfitCard() {
  const history = useBillingHistory({ range: "year" });

  const totalContractProfit = useMemo(() => {
    return history.items
      .filter((item) => item.type === "CommitPreAuthorized")
      .reduce((total, item) => {
        // Sanitize amount string by removing all non-numeric characters except dot and minus
        const amountStr = item.amount.replace(/[^0-9.-]/g, "");
        const amount = Number(amountStr);
        return total + amount;
      }, 0);
  }, [history.items]);

  const contractTransactionsCount = useMemo(() => {
    return history.items.filter((item) => item.type === "CommitPreAuthorized")
      .length;
  }, [history.items]);

  return (
    <div className="rounded-xl bg-secondary border overflow-hidden h-full flex flex-col min-w-0">
      <Card className="p-6 border-none flex-1 min-w-0">
        <CardContent className="p-0 h-full flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon
                name="trending_up"
                size={16}
                className="text-muted-foreground"
              />
              <span className="text-sm font-medium text-muted-foreground">
                Contract Revenue
              </span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon name="info" size={14} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total earnings from contract commits this year</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="text-4xl sm:text-5xl font-semibold text-foreground mb-6 break-words">
            ${totalContractProfit.toFixed(2)}
          </div>

          <div className="flex flex-col gap-3 text-sm mt-auto">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Transactions</span>
              <span className="font-medium">{contractTransactionsCount}</span>
            </div>
            {contractTransactionsCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Average per transaction
                </span>
                <span className="font-medium">
                  $
                  {(totalContractProfit / contractTransactionsCount).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const isFreeReward = (item: BillingHistoryItem) => {
  return (
    item.type === "WorkspaceGenCreditReward" &&
    item.id.includes("free-two-dollars-")
  );
};

function TransactionsTable() {
  const [sortKey, setSortKey] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const history = useBillingHistory({ range: "year" });
  const { data: integrations } = useIntegrations();
  const workspaceLink = useWorkspaceLink();
  const getTypeIcon = (item: BillingHistoryItem) => {
    const type = item.type;

    if (isFreeReward(item)) {
      return <Icon name="redeem" size={16} className="text-muted-foreground" />;
    }

    const icons = {
      WorkspaceRedeemVoucher: "redeem",
      WorkspaceGenCreditReward: "workspace_premium",
      WorkspaceCashIn: "add_circle",
      CommitPreAuthorized: "contract",
    };

    const colors = {
      WorkspaceRedeemVoucher: "text-muted-foreground",
      WorkspaceGenCreditReward: "text-muted-foreground",
      WorkspaceCashIn: "text-muted-foreground",
      CommitPreAuthorized: "text-muted-foreground",
    };

    return (
      <Icon
        name={icons[type as keyof typeof icons]}
        size={16}
        className={colors[type as keyof typeof colors]}
      />
    );
  };

  const getTypeDescription = (item: BillingHistoryItem) => {
    const type = item.type;

    if (isFreeReward(item)) {
      return {
        title: "Free credit",
        description: "Free credit received for signing up",
      };
    }

    const titles = {
      WorkspaceRedeemVoucher: "Voucher redeemed",
      WorkspaceGenCreditReward: "Monthly credit",
      WorkspaceCashIn: "Wallet top-up",
      CommitPreAuthorized: "Contract revenue",
    };

    const descriptions = {
      WorkspaceRedeemVoucher: "Redeemed a voucher",
      WorkspaceGenCreditReward: "Plan subscription payment",
      WorkspaceCashIn: "Added funds to your wallet",
      CommitPreAuthorized: "Received credits from a contract",
    };

    return {
      title: titles[type as keyof typeof titles],
      description: descriptions[type as keyof typeof descriptions],
    };
  };

  const columns: TableColumn<BillingHistoryItem>[] = [
    {
      id: "date",
      header: "Date",
      render: (transaction) =>
        new Date(transaction.timestamp).toLocaleDateString(),
      sortable: true,
    },
    {
      id: "description",
      header: "Description",
      render: (transaction) => {
        return (
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              {getTypeIcon(transaction)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-medium">
                {getTypeDescription(transaction).title}
              </span>
              <span className="text-xs text-muted-foreground">
                {getTypeDescription(transaction).description}
              </span>
            </div>
          </div>
        );
      },
      sortable: false,
    },
    {
      id: "callerApp",
      header: "Caller App",
      render: (transaction) => {
        if (!transaction.callerApp) {
          return null;
        }
        const callerAppIntegration = integrations?.find(
          (integration) => integration.appName === transaction.callerApp,
        );
        if (!callerAppIntegration) {
          return (
            <span className="text-xs text-muted-foreground">
              {transaction.callerApp}
            </span>
          );
        }
        return (
          <div className="flex items-center gap-1">
            <IntegrationIcon
              icon={callerAppIntegration.icon}
              name={callerAppIntegration.name}
              size="sm"
            />
            <Link
              target="_blank"
              to={workspaceLink(`/apps/unknown:::${callerAppIntegration.id}`)}
              className="text-xs text-muted-foreground"
            >
              {callerAppIntegration.name}
            </Link>
          </div>
        );
      },
      sortable: false,
    },
    {
      id: "amount",
      header: "Amount",
      render: (transaction) => (
        <span className={`font-medium text-foreground`}>
          {transaction.amount}
        </span>
      ),
      sortable: false,
    },
  ];

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedTransactions = useMemo(() => {
    const getSortValue = (
      transaction: (typeof history.items)[number],
      key: string,
    ): string | number => {
      switch (key) {
        case "date":
          return new Date(transaction.timestamp).getTime();
        case "type":
          return transaction.type;
        default:
          return "";
      }
    };

    return [...history.items].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);

      if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [history.items, sortKey, sortDirection]);

  return (
    <div className="space-y-4 min-w-0 w-full">
      <div className="flex flex-col sm:flex-row sm:items- sm:justify-between gap-2">
        <h3 className="text-lg font-semibold">Billing history</h3>
        <p className="text-sm text-muted-foreground">
          Your subscription payments, wallet top-ups and contract revenue
        </p>
      </div>
      <div className="overflow-x-auto -mx-6 px-6">
        <Table
          columns={columns}
          data={sortedTransactions}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      </div>
    </div>
  );
}

function BillingErrorFallback() {
  return (
    <Alert variant="destructive" className="my-8">
      <Icon name="error" size={16} />
      <AlertDescription>
        Something went wrong while loading the billing data. Please try again
        later.
      </AlertDescription>
    </Alert>
  );
}

export default function BillingSettings() {
  return (
    <div className="h-full text-foreground px-6 py-6 w-full min-w-0">
      <ErrorBoundary fallback={<BillingErrorFallback />}>
        <div className="flex flex-col gap-6 w-full max-w-full min-w-0">
          {/* Top Row - Wallet Balance, Plan Info, and Contract Profit */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch min-w-0">
            <div className="min-h-0 min-w-0">
              <Suspense fallback={<Skeleton className="h-[300px]" />}>
                <WalletBalanceCard />
              </Suspense>
            </div>
            <div className="min-h-0 min-w-0">
              <Suspense fallback={<Skeleton className="h-[300px]" />}>
                <PlanInfoCard />
              </Suspense>
            </div>
            <div className="min-h-0 min-w-0 lg:col-span-2 xl:col-span-1">
              <Suspense fallback={<Skeleton className="h-[300px]" />}>
                <ContractProfitCard />
              </Suspense>
            </div>
          </div>

          {/* Billing History */}
          <div className="min-w-0">
            <Suspense fallback={<Skeleton className="h-[400px]" />}>
              <TransactionsTable />
            </Suspense>
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
}
