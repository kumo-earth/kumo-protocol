import React from "react";
import { Flex } from "theme-ui";

export const DashboadHeader: React.FC = ({ children }) => {
  return <Flex sx={{ height: 'max-content',  px: 5, pb: 4 }}>{children}</Flex>;
};
