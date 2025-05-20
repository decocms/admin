import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { redeemWalletVoucher, useSDK } from "@deco/sdk";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function VoucherDialog() {
  const [voucherId, setVoucherId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { workspace } = useSDK();
  const queryClient = useQueryClient();

  const { mutate: redeemVoucher, isPending } = useMutation({
    mutationFn: () => redeemWalletVoucher({ workspace, voucherId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setIsOpen(false);
      setVoucherId("");
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="w-full">
          <Icon name="redeem" size={16} className="mr-2" />
          Redeem voucher
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Redeem voucher</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="code" className="text-sm font-medium">
              Voucher Code
            </label>
            <Input
              id="voucherId"
              value={voucherId}
              onChange={(e) => setVoucherId(e.target.value)}
              placeholder="Enter your voucher code"
              className="w-full"
            />
          </div>
          <Button
            onClick={() => redeemVoucher()}
            disabled={!voucherId || isPending}
            className="w-full"
          >
            {isPending ? "Redeeming..." : "Redeem"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
