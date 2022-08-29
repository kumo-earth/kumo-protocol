import React from "react";
import { Flex } from "theme-ui";

export const DashboadHeader: React.FC = ({ children }) => {
  return <Flex sx={{ height: 115 }}>{children}</Flex>;
};
