import decoLight from "../../assets/deco-light.svg?url";
import decoDark from "../../assets/deco-dark.svg?url";

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export function Logo({ className = "", width = 68, height = 28 }: LogoProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Light theme logo */}
      <img
        src={decoLight}
        alt="Deco"
        width={width}
        height={height}
        className="block dark:hidden"
      />
      {/* Dark theme logo */}
      <img
        src={decoDark}
        alt="Deco"
        width={width}
        height={height}
        className="hidden dark:block"
      />
    </div>
  );
}
