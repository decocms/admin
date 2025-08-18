import { useEffect } from 'react';

export default function SalesDeck() {
  useEffect(() => {
    globalThis.location.href =
      'https://drive.google.com/file/d/1ybNf5SrOG8tRhwWYyV7YuKXA_kH1NLyz/view';
  }, []);

  return null;
}
