import { WELL_KNOWN_PLANS } from "@deco/sdk";

interface PlanIconProps {
  className?: string;
  color?: string;
}

const ScaleIcon = ({ className, color, ...props }: PlanIconProps) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ color }}
    {...props}
  >
    <use href="/img/plan-icons/plan-icons-sprite.svg#scale-icon" />
  </svg>
);

const StarterIcon = ({ className, color, ...props }: PlanIconProps) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ color }}
    {...props}
  >
    <use href="/img/plan-icons/plan-icons-sprite.svg#starter-icon" />
  </svg>
);

const GrowthIcon = ({ className, color, ...props }: PlanIconProps) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ color }}
    {...props}
  >
    <use href="/img/plan-icons/plan-icons-sprite.svg#growth-icon" />
  </svg>
);

const FreeIcon = ({ className, color, ...props }: PlanIconProps) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ color }}
    {...props}
  >
    <use href="/img/plan-icons/plan-icons-sprite.svg#free-icon" />
  </svg>
);

export const PlanIcons = {
  [WELL_KNOWN_PLANS.SCALE]: ScaleIcon,
  [WELL_KNOWN_PLANS.STARTER]: StarterIcon,
  [WELL_KNOWN_PLANS.GROWTH]: GrowthIcon,
  [WELL_KNOWN_PLANS.FREE]: FreeIcon,
};
