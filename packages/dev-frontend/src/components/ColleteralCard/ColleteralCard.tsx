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
    <Card
      sx={{
        background: "transparent !important",
        color: "rgba(0, 0, 0, 0.87)",
        transition: "box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        boxShadow: "0 3px 10px rgba(0, 0, 0, 0.5)",
        borderRadius: "20px",
        maxWidth: 450,
        maxHeight: "380px",
        position: "relative"
      }}
      onClick={() => handleClick()}
    >
      {!account && (
        <Flex
          sx={{
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "100%",
            mt: 30,
          }}
          onClick={e => e.stopPropagation()}
        >
          <Box sx={{ fontWeight: 600 }}>Please Connect the Wallet to Proceed</Box>
        </Flex>
      )}
      <Heading
        sx={{
          height: "120px",
          padding: "2rem 2rem 2rem 2rem",
          borderBottom: "1px solid rgba(0, 0, 0, 0.281)",
          marginBottom: "-1px",
          overflow: "hidden",
          color: "#eaeaea",
          background: "linear-gradient(103.69deg, #2b2b2b 18.43%, #525252 100%)",
          borderRadius: "20px 20px 0 0"
        }}
      >
        {(collateralType === "bct" && "BCT") || (collateralType === "mco2" && "MCO2")} Vault
      </Heading>

      <Box sx={{ p: [2, 3] }}>
        <Heading
          as="h6"
          sx={{
            fontSize: 14,
            color: "#f9f8f9",
            padding: "1.5rem 1.5rem 10px 1.5rem"
          }}
        >
          SYSTEM COLLATERALL RATIO
        </Heading>
        <Heading
          as="h4"
          sx={{
            fontFamily: "Roboto, Helvetica, Arial, sans-serif",
            fontWeight: "bold",
            letterSpacing: "0.5px",
            fontSize: "32px",
            color: "#f9f8f9",
            padding: "0 1.5rem 30px 1.5rem"
          }}
        >
          {totalCollateralRatioPct}
        </Heading>
        <Flex sx={{ justifyContent: "space-between" }}>
          <Heading
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "14px",
              color: "#f9f8f9",
              padding: "0 1.5rem 10px 1.5rem"
            }}
          >
            COLLATERAL
          </Heading>
          <Heading
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "14px",
              color: "#f9f8f9",
              padding: "0 1.5rem 10px 1.5rem"
            }}
          >
            {collateral.prettify(2)}{" "}
            {(collateralType === "bct" && "BCT") || (collateralType === "mco2" && "MCO2")}
          </Heading>
        </Flex>
        <Box sx={{ padding: "0 1.5rem 10px 1.5rem" }}>
          <Progress
            max={10000}
            value={collateral.toString()}
            sx={{ height: "12px", color: "green" }}
          ></Progress>
        </Box>
        <Flex sx={{ justifyContent: "space-between" }}>
          <Heading
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "14px",
              color: "#f9f8f9",
              padding: "0 1.5rem 10px 1.5rem"
            }}
          >
            MINTED KUSD
          </Heading>
          <Heading
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "14px",
              color: "#f9f8f9",
              padding: "0 1.5rem 10px 1.5rem"
            }}
          >
            {debt.prettify(2)} KUSD
          </Heading>
        </Flex>
        {/* <Flex sx={{ padding: "1.5rem" }}> */}
        {/* <Text
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "14px",
              color: "#f9f8f9",
              paddingRight: "1rem",
              flex: 1
            }}
          >
            { `The system is in normal mode. Recovery mode will be activated if ${'BCT'} price goes down by 51% to $1706.56.`}
             
           
          </Text> */}
        {/* <Text
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "14px",
              color: "#f9f8f9"
            }}
          >
            42,42,496
          </Text> */}
        {/* </Flex> */}
      </Box>
    </Card>
  );
};
