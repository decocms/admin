import { Button } from "@deco/ui/components/button.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@deco/ui/components/alert.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Switch } from "@deco/ui/components/switch.tsx";
import { Progress } from "@deco/ui/components/progress.tsx";

export function ThemePreview() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-full overflow-hidden">
      {/* Buttons Card */}
      <Card className="p-4 gap-2 min-w-0">
        <CardHeader className="p-0">
          <CardTitle className="text-sm font-medium">Buttons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full">Primary</Button>
          <Button className="w-full" variant="secondary">
            Secondary
          </Button>
          <Button className="w-full" variant="destructive">
            Destructive
          </Button>
          <Button className="w-full" variant="outline">
            Outline
          </Button>
        </CardContent>
      </Card>

      {/* Elements Card */}
      <Card className="p-4 gap-2 min-w-0">
        <CardHeader className="p-0">
          <CardTitle className="text-sm font-medium">Elements</CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
          <div className="space-y-3">
            <Progress value={60} className="h-2" />
            <Progress value={30} className="h-2" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              Enable notifications
            </span>
            <Switch />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              Enable dark mode
            </span>
            <Switch />
          </div>
          <Input placeholder="Input field..." />
        </CardContent>
      </Card>

      {/* Alerts Card */}
      <Card className="p-4 gap-2 min-w-0">
        <CardHeader className="p-0">
          <CardTitle className="text-sm font-medium">Alerts</CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-4">
          <Alert>
            <Icon name="info" className="h-4 w-4" />
            <AlertTitle>Info</AlertTitle>
            <AlertDescription>
              This is an informational message
            </AlertDescription>
          </Alert>
          <Alert variant="success">
            <Icon name="check_circle" className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>Your changes have been saved</AlertDescription>
          </Alert>
          <Alert variant="warning">
            <Icon name="warning" className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>Please review before proceeding</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <Icon name="error" className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Something went wrong with your request
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
