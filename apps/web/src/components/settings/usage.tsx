import { Card, CardContent, CardHeader, CardTitle } from "@deco/ui/components/card.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { Progress } from "@deco/ui/components/progress.tsx";
import { useState } from "react";
import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";

type UsagePeriod = "current" | "last-month" | "year-to-date";

export default function UsageSettings() {
  const [period, setPeriod] = useState<UsagePeriod>("current");

  return (
    <div className="container h-full max-w-7xl">
      <SettingsMobileHeader currentPage="usage" />
      
      <div className="py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Usage</h1>
          <p className="text-muted-foreground">
            Monitor your workspace resource usage
          </p>
        </div>

        <Tabs value={period} onValueChange={(value) => setPeriod(value as UsagePeriod)}>
          <TabsList className="mb-6">
            <TabsTrigger value="current">Current Month</TabsTrigger>
            <TabsTrigger value="last-month">Last Month</TabsTrigger>
            <TabsTrigger value="year-to-date">Year to Date</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <UsageCard
                title="Messages"
                used={650}
                limit={1000}
                unit="messages"
              />
              <UsageCard
                title="Agents"
                used={4}
                limit={10}
                unit="agents"
              />
              <UsageCard
                title="Storage"
                used={120}
                limit={500}
                unit="MB"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Daily Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 flex items-center justify-center border border-dashed rounded-md">
                  <p className="text-muted-foreground">Usage chart will be displayed here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="last-month" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <UsageCard
                title="Messages"
                used={550}
                limit={1000}
                unit="messages"
              />
              <UsageCard
                title="Agents"
                used={3}
                limit={10}
                unit="agents"
              />
              <UsageCard
                title="Storage"
                used={90}
                limit={500}
                unit="MB"
              />
            </div>
          </TabsContent>

          <TabsContent value="year-to-date" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <UsageCard
                title="Messages"
                used={2450}
                limit={12000}
                unit="messages"
              />
              <UsageCard
                title="Agents"
                used={8}
                limit={10}
                unit="agents"
              />
              <UsageCard
                title="Storage"
                used={350}
                limit={500}
                unit="MB"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function UsageCard({
  title,
  used,
  limit,
  unit,
}: {
  title: string;
  used: number;
  limit: number;
  unit: string;
}) {
  const percentage = Math.min(100, Math.round((used / limit) * 100));
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Progress value={percentage} />
          <div className="flex justify-between text-sm">
            <div>
              <span className="font-medium">{used}</span>
              <span className="text-muted-foreground"> used</span>
            </div>
            <div className="text-muted-foreground">
              {used} / {limit} {unit}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 