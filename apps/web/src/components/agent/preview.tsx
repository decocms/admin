import { DetailedHTMLProps, IframeHTMLAttributes } from "react";
import { ALLOWANCES } from "../../constants.ts";
import { IMAGE_REGEXP } from "../chat/utils/preview.ts";

type Props = DetailedHTMLProps<
  IframeHTMLAttributes<HTMLIFrameElement>,
  HTMLIFrameElement
>;

function Preview(props: Props) {
  const isImageLike = props.src && IMAGE_REGEXP.test(props.src);

  if (isImageLike) {
    return (
      <img
        src={props.src}
        alt="Preview"
        className="w-full h-full object-contain"
      />
    );
  }

  return (
    <iframe
      allow={ALLOWANCES}
      allowFullScreen
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      className="w-full h-full"
      {...props}
    />
  );
}

export default Preview;
