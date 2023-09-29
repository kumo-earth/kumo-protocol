import React, { ReactNode } from "react";
import { Flex } from "theme-ui";

export const Badge: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <Flex variant="layout.badge">{children}</Flex>;
};
