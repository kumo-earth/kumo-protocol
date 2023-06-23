import React, { useEffect, useState } from "react";
import { useWeb3React } from "@web3-react/core";
import { Web3Provider } from "@ethersproject/providers";
import { Box, Button, Card, Text } from "theme-ui";
import Tippy from "@tippyjs/react";

import { detectMob } from "../utils/detectMob";
import { injectedConnector } from "../connectors/injectedConnector";

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
  const [isMobView, setIsMobView] = useState(false)

  useEffect(() => {
    setIsMobView(detectMob())
  }, [])

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
        width: 280
      }}
      disabled={!account}
      variant={!account ? 'primaryInActive' : 'primary'}
    >
      {
        isMobView ?
          <Tippy interactive={true} content={<Card variant="tooltip" sx={{ maxWidth: "270px", wordBreak: 'break-word' }}>
            <Text sx={{ fontWeight: 'bold' }}>Go MetaMask App and click Import tokens</Text>
            <br />{`${tokenSymbol} Token contract address: `}<Text sx={{ fontWeight: 'bold' }}>{assetTokenAddress}</Text>
            <br />{`${tokenSymbol} Token symbol: `}<Text sx={{ fontWeight: 'bold' }}>{tokenSymbol}</Text>
            <br />{`${tokenSymbol} Token decimal: `}<Text sx={{ fontWeight: 'bold' }}>18</Text><br /><br />
          </Card>}>
            <Box>Add {assetName}</Box>
          </Tippy> : <Box>Add {assetName}</Box>
      }
    </Button >

  );
};

export default AddAssetButton;
