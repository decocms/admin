import { useEffect } from "react";

export default function SalesDeck() {
  useEffect(() => {
    globalThis.location.href =
      "https://drive.google.com/file/d/1fAxFPJAStVpXd8Tp1hf7DRlkl2kIC8oX/view";
  }, []);

  return null;
}
