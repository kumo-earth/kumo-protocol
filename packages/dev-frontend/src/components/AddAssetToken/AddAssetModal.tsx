import React from "react";
import { useKumoSelector } from "@kumodao/lib-react";
import { Card, Box, Heading } from "theme-ui";
import { ASSET_TOKENS } from "@kumodao/lib-base";
import { Icon } from "../Icon";
import AddAssetButton from "../AddAssetButton";
import { useAddAssetModal } from "./context/AssetViewContext";


export const AddAssetModal: React.FC = () => {
  const { dispatchEvent } = useAddAssetModal();
  const kusdToken = useKumoSelector(state => state.kusdToken);
  const kumoToken = useKumoSelector(state => state.kumoToken)

  // useEffect(() => {
  //   if (!dialog.visible && view == "OPEN" && showAddAssetModal)  {
  //     dialog.setVisible(true)
  //     // dispatchEvent("CLOSE_ADD_ASSET_MODAL_PRESSED");
  //   }
  //   console.log("view", view, dialog.visible, showAddAssetModal)
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [dialog.visible]);

  return (
    <Card variant="modalCard">
      <Heading as="h2" sx={{ mr: 2, }}>
        Please Add the Tokens to Wallet{" "}
        <span style={{ marginLeft: "auto", cursor: "pointer" }} onClick={() => dispatchEvent("CLOSE_ADD_ASSET_MODAL_PRESSED")}>
          <Icon name="window-close" size={"1x"} color="#da357a" />
        </span>
      </Heading>
      <Box sx={{ py: 3 }}>
        {Object.keys(ASSET_TOKENS).map(token => {
          const { assetName, assetAddress } = ASSET_TOKENS[token];

          return (
            <Box sx={{ p: [2, 1], mb: 1, display: "flex", justifyContent: "center" }}>
              <AddAssetButton
                key={token}
                assetName={assetName}
                assetTokenAddress={assetAddress}
                tokenSymbol={token.toUpperCase()}
              />
            </Box>
          );
        })}
        <Box sx={{ p: [2, 1], mb: 1, display: "flex", justifyContent: "center" }}>
          <AddAssetButton
            assetName={"KUSD Token"}
            assetTokenAddress={kusdToken}
            tokenSymbol="KUSD"
          />
        </Box>
        <Box sx={{ p: [2, 1], mb: 1, display: "flex", justifyContent: "center" }}>
          <AddAssetButton
            assetName={"KUMO Token"}
            assetTokenAddress={kumoToken}
            tokenSymbol="KUMO"
          />
        </Box>
      </Box>
    </Card>
  );
};
