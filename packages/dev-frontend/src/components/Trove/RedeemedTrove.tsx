import React, { useCallback } from "react";
import { Card, Heading, Box, Button, Flex } from "theme-ui";
import { CollateralSurplusAction } from "../CollateralSurplusAction";
import { Decimal, KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { useTroveView } from "./context/TroveViewContext";
import { InfoMessage } from "../InfoMessage";
import { useParams } from "react-router-dom";

// const select = ({ collateralSurplusBalance }: KumoStoreState) => ({
//   hasSurplusCollateral: !collateralSurplusBalance.isZero
// });

export const RedeemedTrove: React.FC = () => {
  // const { hasSurplusCollateral } = useKumoSelector(select);
  const { collateralType } = useParams<{ collateralType: string }>();

  const { hasSurplusCollateral } = useKumoSelector((state: KumoStoreState) => {
    const { vaults } = state;

    const vault = vaults.find(vault => vault.asset === collateralType);
    const collateralSurplusBalance: Decimal =
      vault?.collateralSurplusBalance && vault.collateralSurplusBalance;
    return {
      hasSurplusCollateral: !collateralSurplusBalance.isZero
    };
  });
  const { dispatchEvent } = useTroveView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("OPEN_TROVE_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card
      variant="base"
      sx={{
        width: "100%"
      }}
    >
      <Heading>
        Trove
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="Your Trove has been redeemed.">
          {hasSurplusCollateral
            ? "Please reclaim your remaining collateral before opening a new Trove."
            : "You can borrow KUSD by opening a Trove."}
        </InfoMessage>

        <Flex variant="layout.actions">
          {hasSurplusCollateral && <CollateralSurplusAction />}
          {!hasSurplusCollateral && (
            <Button
              onClick={handleOpenTrove}
            >
              Open Trove
            </Button>
          )}
        </Flex>
      </Box>
    </Card>
  );
};
