import { Button } from "@deco/ui/components/button.tsx";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";

export default function BillingSettings() {
  return (
    <div className="container h-full max-w-7xl">
      <SettingsMobileHeader currentPage="billing" />

      <div className="py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="text-muted-foreground">
            Manage your subscription and billing information
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Free Plan</h3>
                  <p className="text-muted-foreground">Basic features</p>
                </div>
                <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                  Current
                </div>
              </div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Icon name="check_circle" className="text-primary" />
                  <span>10 agents per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="check_circle" className="text-primary" />
                  <span>1,000 messages per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="check_circle" className="text-primary" />
                  <span>Community support</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="outline">Upgrade Plan</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center h-40 border border-dashed rounded-md">
                <Icon
                  name="credit_card"
                  size={36}
                  className="mb-2 text-muted-foreground"
                />
                <p className="text-muted-foreground">No payment method added</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Add Payment Method</Button>
            </CardFooter>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Icon
                name="receipt_long"
                size={36}
                className="mb-2 text-muted-foreground"
              />
              <p className="text-muted-foreground">
                No billing history available
              </p>
              <p className="text-sm text-muted-foreground">
                Your invoice history will appear here once you upgrade to a paid
                plan
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
