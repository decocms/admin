import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@deco/ui/components/popover.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useReportIssue } from "@deco/sdk";
import { useState } from "react";
import { useLocation, useParams } from "react-router";
import { toast } from "sonner";

export function ReportIssueButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"Bug" | "Idea">("Bug");
  const [content, setContent] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const { org, project } = useParams();
  const location = useLocation();
  const reportIssue = useReportIssue();

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error("Please provide a description");
      return;
    }

    try {
      await reportIssue.mutateAsync({
        orgSlug: org || undefined,
        projectSlug: project || undefined,
        type,
        content: content.trim(),
        url: globalThis.location.href,
        path: location.pathname,
      });

      toast.success("Report submitted successfully!");
      setIsSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setContent("");
        setType("Bug");
        setIsSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Failed to submit report:", error);
      toast.error("Failed to submit report. Please try again.");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" title="Report Issue">
          <Icon name="lightbulb_2" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-1 rounded-xl" align="end" side="bottom">
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center">
              <Icon name="check" size={24} className="text-primary-dark" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-medium">Thank you!</h3>
              <p className="text-xs text-muted-foreground">
                We appreciate your feedback
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-between pl-1">
              <div className="flex items-center gap-2">
                <Icon
                  name="lightbulb_2"
                  className="w-4 h-4 text-muted-foreground"
                />
                <span className="text-sm font-medium">Feedback</span>
              </div>
              <Button
                size="icon"
                variant="special"
                onClick={handleSubmit}
                disabled={reportIssue.isPending || !content.trim()}
                className="w-8 h-8"
              >
                {reportIssue.isPending ? (
                  <Spinner size="xs" />
                ) : (
                  <Icon name="arrow_forward" className="w-4 h-4" />
                )}
              </Button>
            </div>

            <Select
              value={type}
              onValueChange={(v) => setType(v as "Bug" | "Idea")}
            >
              <SelectTrigger className="shadow-none w-full h-8">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bug">
                  <div className="flex items-center gap-2">
                    <Icon
                      name="bug_report"
                      className="w-4 h-4 text-yellow-light"
                    />
                    Bug report
                  </div>
                </SelectItem>
                <SelectItem value="Idea">
                  <div className="flex items-center gap-2">
                    <Icon
                      name="lightbulb_2"
                      className="w-4 h-4 text-purple-light"
                    />
                    Feature idea
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Textarea
              placeholder={
                type === "Bug" ? "Describe the bug..." : "Ideas to improve..."
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="resize-none shadow-none min-h-32 placeholder:text-muted-foreground"
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
