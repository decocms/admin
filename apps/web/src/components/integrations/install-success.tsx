import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

function ConnectionInstallSuccess() {
  const handleCloseWindow = () => {
    globalThis.window.close();
  };

  return (
    <div className="min-h-screen h-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-4 rounded-xl">
        <CardHeader className="text-center">
          <Icon name="check_circle" size={36} className="text-special" />
          <CardTitle className="text-xl font-medium">
            Integration Connected Successfully!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Your integration has been successfully connected. You can now close
            this window and return to the main application.
          </p>
          <Button
            onClick={handleCloseWindow}
            className="w-full"
          >
            Close Window
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default ConnectionInstallSuccess;
