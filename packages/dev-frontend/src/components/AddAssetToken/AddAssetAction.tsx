import { Button } from "theme-ui";

import { useKumo } from "../../hooks/KumoContext";
import { injectedConnector } from "../../connectors/injectedConnector";
import { useEffect } from "react";
import { useTransactionFunction } from "../Transaction";


type AddAssetActionProps = {
    transactionId: string;
    isTransactionConfirmed : boolean;
    type: string;
    tokenAddress: string;
    tokenSymbol : string;
};


export const AddAssetAction: React.FC<AddAssetActionProps> = ({
    children,
    transactionId,
    isTransactionConfirmed,
    type,
    tokenAddress,
    tokenSymbol,
}) => {
    const { kumo } = useKumo();

    // useEffect(() => {
    //   if(isTransactionConfirmed) {
    //     addAsset(tokenAddress, tokenSymbol)
    //   }
    // }, [isTransactionConfirmed])
    

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
            // sendTransaction()
            console.log(`Asset Token ${tokenSymbol} added`);
          } else {
            console.log(`Asset Token ${tokenSymbol} failed`);
          }
        } catch (error) {
          console.log(error);
        }
      };

    const [sendTransaction] = useTransactionFunction(
        transactionId,
        kumo.send.requestTestToken.bind(kumo.send, tokenAddress)
    );

    return (
        <Button
            sx={{  py: "4px",  width: ["100%", "65%"], mx: "auto", fontSize: 1 }}
            onClick={sendTransaction}
        >
            {children}
        </Button>
    );
};
