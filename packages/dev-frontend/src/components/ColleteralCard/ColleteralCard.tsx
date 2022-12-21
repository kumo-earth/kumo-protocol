import { Decimal, UserTrove } from "@kumodao/lib-base";
import React from "react";
import { useHistory } from "react-router-dom";
import { Flex, Progress, Box, Card, Text, Heading } from "theme-ui";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

import { useTroveView } from "../Trove/context/TroveViewContext";
import { toUpper } from "lodash";

type CollateralCardProps = {
  collateralType?: string;
  totalCollateralRatioPct?: string;
  trove: UserTrove;
};

export const CollateralCard: React.FC<CollateralCardProps> = ({
  collateralType,
  totalCollateralRatioPct,
  trove
}) => {
  const { account } = useWeb3React<Web3Provider>();
  const { dispatchEvent, view } = useTroveView();
  const history = useHistory();

  const handleClick = () => {
    if (view === "ADJUSTING") {
      dispatchEvent("CANCEL_ADJUST_TROVE_PRESSED");
    }
    history.push(`/dashboard/${collateralType}`);
  };
  return (
    <Card variant="collateralCard" sx={{ mb: 5 }} onClick={() => handleClick()}>
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
      <Heading as="h2">{toUpper(collateralType)} Vault</Heading>

      <Box sx={{ px: 4, mt: 5 }}>
        <Text as="p" variant="normalBold">
          SYSTEM COLLATERALL RATIO
        </Text>

        <Text as="p" variant="xlarge" sx={{ mt: 1 }}>
          {/* {totalCollateralRatioPct 0.00%} */}
          0.00%
        </Text>
        <Flex sx={{ justifyContent: "space-between", mt: 6 }}>
          <Text as="p" variant="normalBold">
            COLLATERAL
          </Text>
          <Text as="p" variant="normalBold">
            {trove?.collateral.prettify(2)} {toUpper(collateralType)}
          </Text>
        </Flex>
        <Box sx={{ my: 2 }}>
          <Progress
            max={10000}
            value={trove?.collateral.toString()}
            sx={{ height: "12px", backgroundColor: "#F0CFDC" }}
          ></Progress>
        </Box>
        <Flex sx={{ justifyContent: "space-between", mb: 4 }}>
          <Text as="p" variant="normalBold">
            MINTED KUSD
          </Text>
          <Text as="p" variant="normalBold">
            {" "}
            KUSD
          </Text>
        </Flex>
      </Box>
    </Card>
  );
};
