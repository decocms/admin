import Stripe from "stripe";
import { WebhookEventIgnoredError } from "../../../errors.ts";
import { serializeError, type AppContext } from "../../context.ts";
import type { Transaction } from "../client.ts";
import { createCurrencyClient, MicroDollar } from "../index.ts";
import { getPlan } from "../plans.ts";
import { Markup, type PlanWithTeamMetadata } from "../../../plan.ts";
import { customers, organizations, projects } from "../../schema.ts";
import { eq } from "drizzle-orm";
import { Locator } from "packages/sdk/src/locator.ts";

export const verifyAndParseStripeEvent = (
  payload: string,
  signature: string,
  c: AppContext,
): Promise<Stripe.Event> => {
  if (!c.envVars.STRIPE_SECRET_KEY || !c.envVars.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not set");
  }

  const stripe = new Stripe(c.envVars.STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil",
    httpClient: Stripe.createFetchHttpClient(),
  });

  return stripe.webhooks.constructEventAsync(
    payload,
    signature,
    c.envVars.STRIPE_WEBHOOK_SECRET,
  );
};

export class EventIgnoredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventIgnoredError";
  }
}

type EventHandler<T extends Stripe.Event> = (
  context: AppContext,
  event: T,
) => Promise<Transaction>;

const CURRENCIES_BESIDES_DOLLAR = ["BRL", "EUR"];

async function getCurrencies(c: AppContext) {
  if (!c.envVars.CURRENCY_API_KEY) {
    throw new Error("CURRENCY_API_KEY is not set");
  }

  const currencyClient = createCurrencyClient(c.envVars.CURRENCY_API_KEY);
  const response = await currencyClient["GET /latest"]({
    currencies: [CURRENCIES_BESIDES_DOLLAR.join(",")],
  });
  const data = await response.json();
  return data.data;
}

async function getAmountInDollars({
  context,
  amountReceivedUSDCentsWithMarkup,
  currency,
  plan,
}: {
  context: AppContext;
  amountReceivedUSDCentsWithMarkup: number;
  currency: string;
  plan: PlanWithTeamMetadata;
}) {
  const currencies = {
    ...(await getCurrencies(context)),
    USD: { value: 1 },
  };

  if (!Object.keys(currencies).includes(currency.toUpperCase())) {
    throw new Error("Currency not supported");
  }

  const conversionRate =
    currencies[currency.toUpperCase() as keyof typeof currencies].value;

  const amountReceivedUSDCents = Markup.remove({
    usdCents: amountReceivedUSDCentsWithMarkup,
    markupPercentage: plan.markup,
  });
  const amount = amountReceivedUSDCents / 100;
  const microDollarsString = String(
    Math.round((amount / conversionRate) * 1_000_000),
  );

  return MicroDollar.fromMicrodollarString(microDollarsString);
}

async function getWorkspaceByCustomerId({
  context,
  customerId: argsCustomerId,
}: {
  context: AppContext;
  customerId: string;
}): Promise<string> {
  const customerId = context.envVars.TESTING_CUSTOMER_ID || argsCustomerId;

  try {
    const [data] = await context.drizzle
      .select({
        workspace: customers.workspace,
        orgId: customers.org_id,
      })
      .from(customers)
      .where(eq(customers.customer_id, customerId))
      .limit(1);

    if (!data) {
      throw new Error("Customer not found");
    }

    if (data.workspace) {
      return data.workspace;
    }

    if (!data.orgId) {
      throw new Error("Organization ID not found");
    }

    const [result] = await context.drizzle
      .select({
        orgSlug: organizations.slug,
        projectSlug: projects.slug,
      })
      .from(organizations)
      .leftJoin(projects, eq(organizations.id, projects.org_id))
      .where(eq(organizations.id, data.orgId))
      .limit(1);

    if (!result || !result.orgSlug || !result.projectSlug) {
      throw new Error("Organization or project not found");
    }

    const locator = Locator.from({
      org: result.orgSlug,
      project: result.projectSlug,
    });

    return Locator.adaptToRootSlug(locator);
  } catch (error) {
    console.error("[Stripe Webhook] Error", serializeError(error));
    throw new WebhookEventIgnoredError(
      "Failed to get workspace by customer ID, skipping",
    );
  }
}

const paymentIntentSucceeded: EventHandler<
  Stripe.PaymentIntentSucceededEvent
> = async (context, event) => {
  const customerId = event.data.object.customer;

  if (!customerId || typeof customerId !== "string") {
    throw new WebhookEventIgnoredError(
      "Customer ID not found or is not a string, skipping",
    );
  }

  const workspace = await getWorkspaceByCustomerId({
    context,
    customerId,
  });

  const workspacePattern = new URLPattern({ pathname: "/:root/:slug" });
  const workspaceMatch = workspacePattern.exec({ pathname: workspace });

  if (
    !workspaceMatch ||
    !workspaceMatch.pathname.groups.slug ||
    !workspaceMatch.pathname.groups.root
  ) {
    throw new Error(`Invalid workspace format: ${workspace}`);
  }

  const contextWithWorkspace = {
    ...context,
    workspace: {
      value: workspace,
      slug: workspaceMatch.pathname.groups.slug,
      root: workspaceMatch.pathname.groups.root,
      branch: "main",
    },
  };

  const plan = await getPlan(contextWithWorkspace);
  const amount = await getAmountInDollars({
    context,
    amountReceivedUSDCentsWithMarkup: event.data.object.amount_received,
    currency: event.data.object.currency,
    plan,
  });

  return {
    type: "WorkspaceCashIn",
    amount: amount.toMicrodollarString(),
    workspace,
    timestamp: new Date(),
  };
};

export const createTransactionFromStripeEvent = async (
  c: AppContext,
  event: Stripe.Event,
): Promise<{ transaction: Transaction; idempotentId: string }> => {
  // deno-lint-ignore no-explicit-any
  const handlers: Record<string, EventHandler<any>> = {
    "payment_intent.succeeded": paymentIntentSucceeded,
  };

  const handler = handlers[event.type as keyof typeof handlers];

  if (!handler) {
    throw new WebhookEventIgnoredError(
      `No handler found for event type: ${event.type}`,
    );
  }

  const transaction = await handler(c, event);

  return {
    transaction,
    idempotentId: event.id,
  };
};
