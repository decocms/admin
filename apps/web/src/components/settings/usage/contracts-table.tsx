import { useEffect, useMemo, useState } from "react";
import {
  Integration,
  useIntegrations,
  useToolCall,
  type ContractsCommitsItem,
} from "@deco/sdk";
import type { ContractState } from "@deco/sdk/mcp";
import { MicroDollar } from "@deco/sdk/mcp/wallet";
import { Table, type TableColumn } from "../../common/table/index.tsx";
import { color } from "./util.ts";
import { useNavigateWorkspace } from "../../../hooks/use-navigate-workspace.ts";

export function ContractsTable({
  contractsUsage,
  contractId,
  clauseId,
}: {
  contractsUsage: ContractsCommitsItem[];
  contractId?: string;
  clauseId?: string;
}) {
  const navigate = useNavigateWorkspace();
  const [sortKey, setSortKey] = useState<string>("total");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { data: integrations } = useIntegrations();
  const [clausePricesByContract, setClausePricesByContract] = useState<
    Record<string, Record<string, string | number>>
  >({});

  function handleContractClausesLoaded(
    contractId: string,
    clauses: { id: string; price: string | number }[],
  ) {
    setClausePricesByContract((prev) => ({
      ...prev,
      [contractId]: clauses.reduce<Record<string, string | number>>(
        (acc, c) => {
          acc[c.id] = c.price;
          return acc;
        },
        {},
      ),
    }));
  }

  const enrichedContracts = useMemo(() => {
    if (!contractsUsage || contractsUsage.length === 0) {
      return [];
    }

    return contractsUsage
      .filter((contract) => {
        // Filter by contract if specified
        if (contractId && contract.contractId !== contractId) {
          return false;
        }
        // If a clause filter is selected, only include contracts that have that clause
        if (clauseId) {
          return (contract.clauses || []).some(
            (clause) => clause.clauseId === clauseId,
          );
        }
        return true;
      })
      .map((contract) => {
        let parsedCost: number;
        if (clauseId) {
          // For a specific clause, calculate: clause_price * clause_amount
          const clause = (contract.clauses || []).find(
            (c) => c.clauseId === clauseId,
          );
          if (clause) {
            const clausePrice =
              clausePricesByContract[contract.contractId]?.[clauseId];
            if (clausePrice !== undefined) {
              // Contract clause prices are in "dollars per million tokens" format
              // Convert to "dollars per token" then multiply by amount
              const pricePerMillionTokens =
                typeof clausePrice === "string"
                  ? parseFloat(clausePrice)
                  : clausePrice;
              const pricePerToken = pricePerMillionTokens / 1_000_000; // Convert to dollars per token
              parsedCost = pricePerToken * clause.amount;
            } else {
              // Fallback: calculate proportionally from total contract amount
              const totalTokensInContract = (contract.clauses || []).reduce(
                (sum, c) => sum + c.amount,
                0,
              );
              if (totalTokensInContract > 0) {
                parsedCost =
                  (clause.amount / totalTokensInContract) * contract.amount;
              } else {
                parsedCost = 0;
              }
            }
          } else {
            parsedCost = 0;
          }
        } else {
          // For all clauses, calculate the total from individual clause prices if available
          const contractPrices = clausePricesByContract[contract.contractId];
          if (contractPrices && Object.keys(contractPrices).length > 0) {
            // Calculate total from clause prices
            parsedCost = (contract.clauses || []).reduce((total, clause) => {
              const clausePrice = contractPrices[clause.clauseId];
              if (clausePrice !== undefined) {
                const pricePerMillionTokens =
                  typeof clausePrice === "string"
                    ? parseFloat(clausePrice)
                    : clausePrice;
                const pricePerToken = pricePerMillionTokens / 1_000_000;
                return total + pricePerToken * clause.amount;
              }
              return total;
            }, 0);
          } else {
            // Fallback to contract amount (this is already in dollars)
            parsedCost = contract.amount;
          }
        }
        return {
          color: color(contract.id),
          totalCost: parsedCost,
          clauses: contract.clauses,
          contractId: contract.contractId,
          updatedAt: contract.timestamp || new Date().toISOString(),
        };
      });
  }, [contractsUsage, contractId, clauseId, clausePricesByContract]);

  const columns: TableColumn<(typeof enrichedContracts)[0]>[] = [
    {
      id: "color",
      header: "",
      render: (contract) => (
        <div
          className="w-3 h-3 rounded"
          style={{ backgroundColor: contract.color }}
        />
      ),
    },
    {
      id: "title",
      header: "Contract",
      render: (contract) => {
        const integration = integrations?.find(
          (integration) => integration.id === contract.contractId,
        );
        return (
          <div className="flex flex-col">
            {integration && (
              <ContractIntegrationInfo
                integration={integration}
                contractId={contract.contractId}
                onLoaded={(clauses) =>
                  handleContractClausesLoaded(contract.contractId, clauses)
                }
              />
            )}
            <ContractInfo
              contract={contract}
              clausePrices={clausePricesByContract[contract.contractId]}
              selectedClauseId={clauseId}
            />
          </div>
        );
      },
      sortable: true,
    },
    {
      id: "total",
      header: "Total Cost",
      render: (contract) => (
        <span className="font-medium">
          {contract.totalCost < 0.01
            ? `$${contract.totalCost.toFixed(8)}`.replace(/\.?0+$/, "")
            : `$${contract.totalCost.toFixed(2)}`}
        </span>
      ),
      sortable: true,
    },
  ];

  const getSortValue = (
    contract: (typeof enrichedContracts)[0],
    key: string,
  ): string | number => {
    switch (key) {
      case "title":
        return contract.contractId.toLowerCase();
      case "updatedAt":
        return new Date(contract.updatedAt).getTime();
      case "total":
        return contract.totalCost;
      default:
        return "";
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev: "asc" | "desc") =>
        prev === "asc" ? "desc" : "asc",
      );
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedContracts = useMemo(() => {
    return [...enrichedContracts].sort((a, b) => {
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
  }, [enrichedContracts, sortKey, sortDirection]);

  return (
    <Table
      columns={columns}
      data={sortedContracts}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={(contract) => {
        alert(
          integrations?.find(
            (integration) => integration.id === contract.contractId,
          )?.name,
        );
        // navigate(`/audit/${contract.contractId}`);
      }}
    />
  );
}

function ContractInfo({
  contract,
  clausePrices,
  selectedClauseId,
}: {
  contract: {
    contractId: string;
    clauses: { clauseId: string; amount: number }[];
  };
  clausePrices?: Record<string, string | number>;
  selectedClauseId?: string;
}) {
  const clausesToRender = useMemo(() => {
    if (!selectedClauseId) return contract.clauses;
    return contract.clauses.filter((c) => c.clauseId === selectedClauseId);
  }, [contract.clauses, selectedClauseId]);

  function formatPrice(price?: string | number): string | null {
    if (price === undefined) return null;
    try {
      // Contract clause prices are in "dollars per million tokens" format
      // Convert to "dollars per token" for display
      const pricePerMillionTokens =
        typeof price === "string" ? parseFloat(price) : price;
      const pricePerToken = pricePerMillionTokens / 1_000_000; // Convert to dollars per token
      return MicroDollar.fromDollars(pricePerToken).display({
        showAllDecimals: true,
      });
    } catch {
      return typeof price === "number" ? `$${price.toFixed(6)}` : String(price);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex gap-1 flex-wrap">
        {clausesToRender.map((clause, index) => {
          const price = clausePrices
            ? clausePrices[clause.clauseId]
            : undefined;
          const priceDisplay = formatPrice(price);
          return (
            <div
              className="bg-primary-foreground rounded-md px-2 py-1 text-xs text-primary-dark flex items-center gap-1"
              key={index}
            >
              {priceDisplay && (
                <span className="text-muted-foreground">{priceDisplay}</span>
              )}
              <span className="font-medium">× {clause.amount}</span>
              <span className="text-xs">{clause.clauseId}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContractIntegrationInfo({
  integration,
  contractId,
  onLoaded,
}: {
  integration: Integration;
  contractId: string;
  onLoaded?: (clauses: { id: string; price: string | number }[]) => void;
}) {
  const callTool = useToolCall(integration?.connection);
  useEffect(() => {
    if (!integration?.connection) return;
    // Trigger once per connection + contractId
    void callTool
      .mutateAsync({
        name: "CONTRACT_GET",
        arguments: { contractId },
      })
      .then((result) => {
        // eslint-disable-next-line no-console
        console.log("CONTRACT_GET result", result);
        const typed = result as { contract?: ContractState };
        const clauses: { id: string; price: string | number }[] =
          typed?.contract?.clauses || [];
        if (onLoaded) onLoaded(clauses);
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error("CONTRACT_GET error", error);
      });
    // We intentionally depend only on the stable inputs to avoid re-triggering
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration?.connection, contractId]);
  return (
    <div className="flex flex-col">
      <span className="font-medium text-sm">{integration.name}</span>
    </div>
  );
}
