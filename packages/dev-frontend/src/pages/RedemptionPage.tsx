import React from "react";
import {  Flex } from "theme-ui";
import { Redemption } from "../components/Redemption/Redemption";


export const RedemptionPage: React.FC = () => {
  return (
    <Flex sx={{ width: "100%", mt: 5, px: 5, justifyContent: "center" }}>
      <Redemption />
    </Flex>
  );
};
