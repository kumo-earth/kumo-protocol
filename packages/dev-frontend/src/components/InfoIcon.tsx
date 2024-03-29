import React from "react";
import Tippy, { TippyProps } from "@tippyjs/react";
import { Icon } from "./Icon";
import { FontAwesomeIconProps } from "@fortawesome/react-fontawesome";

export type InfoIconProps = Pick<TippyProps, "placement"> &
  Pick<FontAwesomeIconProps, "size"> & {
    tooltip: React.ReactNode;
    color?: string;
  };

export const InfoIcon: React.FC<InfoIconProps> = ({ tooltip, color = "#da357a", size = "1x" }) => {
  return (
    <Tippy interactive={true} content={tooltip}>
      <span>
        &nbsp;
        <Icon name="question-circle" size={size} color={color} />
      </span>
    </Tippy>
  );
};
