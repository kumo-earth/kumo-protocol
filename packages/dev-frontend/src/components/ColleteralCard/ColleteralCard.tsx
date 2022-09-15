import { Decimal, UserTrove } from "@kumodao/lib-base";
import React from "react";
import { useHistory } from "react-router-dom";
import { Flex, Progress, Box, Card, Heading } from "theme-ui";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

import { useTroveView } from "../Trove/context/TroveViewContext";

type CollateralCardProps = {
  collateralType?: string;
  totalCollateralRatioPct?: string;
  usersTroves: UserTrove[];
};

export const CollateralCard: React.FC<CollateralCardProps> = ({
  collateralType,
  totalCollateralRatioPct,
  usersTroves
}) => {
  const { account } = useWeb3React<Web3Provider>();
  const { dispatchEvent, view } = useTroveView();
  const history = useHistory();

  let collateral = Decimal.ZERO;
  let debt = Decimal.ZERO;

  usersTroves.forEach(userTrove => {
    collateral = collateral.add(userTrove.debt);
    debt = debt.add(userTrove.collateral);
  });

  const handleClick = () => {
    if (view === "ADJUSTING") {
      dispatchEvent("CANCEL_ADJUST_TROVE_PRESSED");
    }
    history.push(`/dashboard/${collateralType}`);
  };
  return (
    <Card variant="base" sx={{ mb: 5 }} onClick={() => handleClick()}>
      {/* {!account && (
        <Flex
          sx={{
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "100%",
            mt: 30
          }}
          onClick={e => e.stopPropagation()}
        >
          <Box sx={{ fontWeight: 600 }}>Please Connect the Wallet to Proceed</Box>
        </Flex>
      )} */}
      <Heading as="h2">
        {(collateralType === "bct" && "Carbon Token X") || (collateralType === "mco2" && "Biodiversity Token Y")} <span style={{ marginLeft: "22px" }}>Vault</span>
      </Heading>

      <Box sx={{ px: 4 }}>
        <Heading as="h4" sx={{mt: 4}}>SYSTEM COLLATERALL RATIO</Heading>
        <Heading
          as="h2"
          sx={{mt: 1}}
        >
          {totalCollateralRatioPct}
        </Heading>
        <Flex sx={{ justifyContent: "space-between", mt: 4 }}>
          <Heading as="h4">COLLATERAL</Heading>
          <Heading as="h4">
            {collateral.prettify(2)}{" "}
            {(collateralType === "bct" && "Carbon Token X") || (collateralType === "mco2" && "Biodiversity Token Y")}
          </Heading>
        </Flex>
        <Box sx={{ my: 2 }}>
          <Progress
            max={10000}
            value={collateral.toString()}
            sx={{ height: "12px", backgroundColor: "#F0CFDC" }}
          ></Progress>
        </Box>
        <Flex sx={{ justifyContent: "space-between", mb: 4 }}>
          <Heading as="h4">MINTED KUSD</Heading>
          <Heading as="h4">{debt.prettify(2)} KUSD</Heading>
        </Flex>
      </Box>
    </Card>
  );
};
