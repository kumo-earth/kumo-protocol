import React from "react";
import { useWeb3React } from "@web3-react/core";
import { Web3Provider } from "@ethersproject/providers";
import { injectedConnector } from "../connectors/injectedConnector";

import { Box, Button } from "theme-ui";

type AddAssetButtonTypes = {
  assetName: string;
  assetTokenAddress: string;
  tokenSymbol: string;
};

const AddAssetButton: React.FC<AddAssetButtonTypes> = ({
  assetName,
  assetTokenAddress,
  tokenSymbol
}) => {
  const { account } = useWeb3React<Web3Provider>();

  const addAsset = async (address: string, symbol: string) => {
    const provider = await injectedConnector.getProvider();

    try {
      const wasAdded = await provider?.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20", // Initially only supports ERC20, but eventually more!
          options: {
            address,
            symbol,
            decimals: 18
          }
        }
      });

      if (wasAdded) {
        console.log(`Asset Token ${tokenSymbol} added`);
      } else {
        console.log(`Asset Token ${tokenSymbol} failed`);
      }
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <Button
      onClick={() => addAsset(assetTokenAddress, tokenSymbol)}
      sx={{
        width: 280,
        borderRadius: 8,
      }}
      disabled={!account}
      variant={!account ? 'primaryInActive' : 'primary'}
    >
      <Box>Add {assetName}</Box>
    </Button>
  );
};

export default AddAssetButton;
