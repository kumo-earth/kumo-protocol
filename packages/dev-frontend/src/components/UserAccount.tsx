import React, { useEffect } from "react";
import { Text, Flex, Box, Heading } from "theme-ui";

import { useWalletView } from "../components/WalletConnect/context/WalletViewContext";
import { shortenAddress } from "../utils/shortenAddress";
import { Web3Provider } from "@ethersproject/providers";


import { Icon } from "./Icon";
import { useWeb3React } from "@web3-react/core";

export const UserAccount: React.FC = () => {
  const { deactivate, active } = useWeb3React<Web3Provider>();
  // const { account } = useKumo();
  const { dispatchEvent } = useWalletView();
  const { account } = useWeb3React();

  useEffect(() => {
    console.log(active);
  }, [account]);

  return (
    <Box sx={{ display: ["none", "flex"] }}>
      <Flex sx={{ alignItems: "flex-start" }}>
        <Icon name="user-circle" size="lg" />
        <Flex sx={{ ml: 3, mr: 4, flexDirection: "column" }}>
          {account ? (
            <>
              {/* <Heading sx={{ fontSize: 1 }} onClick={() => dispatchEvent("CLOSE_MODAL_PRESSED")}>
                Connected as
              </Heading> */}
              {/* <Text as="span" sx={{ fontSize: 1 }}>
                {shortenAddress(account)}
              </Text> */}
              <Heading
                sx={{ fontSize: 1 }}
                onClick={() => {
                  deactivate();
                  sessionStorage.removeItem("account");
                }}
              >
                Disconnect
              </Heading>
            </>
          ) : (
            <Heading sx={{ fontSize: 1 }} onClick={() => dispatchEvent("OPEN_MODAL_PRESSED")}>
              Connect
            </Heading>
          )}
        </Flex>
      </Flex>
    </Box>
  );
};
