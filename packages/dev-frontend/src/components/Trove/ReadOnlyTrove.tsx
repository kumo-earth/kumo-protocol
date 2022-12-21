import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import { Card, Heading, Box, Flex, Button, Select } from "theme-ui";
import { Decimal, KumoStoreState, UserTrove } from "@kumodao/lib-base";
import { DisabledEditableRow } from "./Editor";
import { useTroveView } from "./context/TroveViewContext";
import { Icon } from "../Icon";
import { COIN } from "../../strings";
import { CollateralRatio } from "./CollateralRatio";
import { useDashboard } from "../../hooks/DashboardContext";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";
import { useKumoSelector } from "@kumodao/lib-react";

const select = ({ vaults }: KumoStoreState) => ({
  vaults
});

export const ReadOnlyTrove: React.FC = () => {
  const { dispatchEvent } = useTroveView();
  const handleAdjustTrove = useCallback(() => {
    dispatchEvent("ADJUST_TROVE_PRESSED");
  }, [dispatchEvent]);
  const handleCloseTrove = useCallback(() => {
    dispatchEvent("CLOSE_TROVE_PRESSED");
  }, [dispatchEvent]);

  const { account } = useWeb3React<Web3Provider>();

  const { collateralType } = useParams<{ collateralType: string }>();

  const { ctx, cty } = useDashboard();
  const { vaults } = useKumoSelector(select);
  const vault = vaults.find(vault => vault.asset === collateralType);
  const trove: UserTrove = vault?.trove?.ownerAddress === account && vault?.trove;
  const price = vault?.asset === "ctx" ? ctx : vault?.asset === "cty" ? cty : Decimal.from(0);
  let collateralRatio: Decimal = trove.collateralRatio(price);

  // console.log("READONLY TROVE", trove.collateral.prettify(4));
  return (
    <Card variant="base">
      <Heading as="h2">{vault?.asset.toUpperCase()} Trove</Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <DisabledEditableRow
            label="Collateral"
            inputId="trove-collateral"
            amount={trove?.collateral.prettify(4) || "0"}
            unit={collateralType?.toUpperCase()}
          />

          <DisabledEditableRow
            label="Debt"
            inputId="trove-debt"
            amount={trove?.debt.prettify() || "0"}
            unit={COIN}
          />

          <CollateralRatio value={collateralRatio} />
        </Box>

        <Flex variant="layout.actions">
          <Button
            variant="outline"
            onClick={handleCloseTrove}
            sx={{
              border: "none"
            }}
          >
            Close Trove
          </Button>
          <Button
            onClick={handleAdjustTrove}
            sx={{
              border: "none"
            }}
          >
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>
        </Flex>
      </Box>
    </Card>
  );
};
