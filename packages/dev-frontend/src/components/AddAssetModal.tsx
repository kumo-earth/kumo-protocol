import React from "react";
import { useKumoSelector } from "@kumodao/lib-react";
import { Card, Box, Heading } from "theme-ui";
import { ASSET_TOKENS } from "@kumodao/lib-base";
import { toUpper } from "lodash";
import { Icon } from "./Icon";
import AddAssetButton from "./AddAssetButton";

type AddAssetModalProps = {
  onClose: (event: React.MouseEvent<HTMLElement>) => void;
};

export const AddAssetModal: React.FC<AddAssetModalProps> = ({ onClose }) => {
  const kusdToken = useKumoSelector(state => state.kusdToken);

  return (
    <Card variant="modalCard">
      <Heading as="h2" sx={{ mr: 2 }}>
        Please Add the Tokens to Wallet{" "}
        <span style={{ marginLeft: "auto", cursor: "pointer" }} onClick={e => onClose(e)}>
          <Icon name="window-close" size={"1x"} color="#da357a" />
        </span>
      </Heading>
      <Box sx={{ py: 3 }}>
        {Object.keys(ASSET_TOKENS).map(token => {
          const { assetName, assetAddress } = ASSET_TOKENS[token];

          return (
            <Box sx={{ p: [4, 1], mb: 1, display: "flex", justifyContent: "center" }}>
              <AddAssetButton
                key={token}
                assetName={assetName}
                assetTokenAddress={assetAddress}
                tokenSymbol={toUpper(token)}
              />
            </Box>
          );
        })}
        <Box sx={{ p: [4, 1], mb: 1, display: "flex", justifyContent: "center" }}>
          <AddAssetButton
            assetName={"Token KUSD"}
            assetTokenAddress={kusdToken}
            tokenSymbol="KUSD"
          />
        </Box>
      </Box>
    </Card>
  );
};
