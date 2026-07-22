import { assetUrl } from "../config/runtime";

type Props = {
  className?: string;
};

export function CandyDeco({ className }: Props) {
  return (
    <img
      src={assetUrl("candy.png")}
      className={className}
      alt=""
      aria-hidden="true"
      draggable="false"
    />
  );
}
