import { useEffect } from "react";
import { useHistory, useParams } from "react-router-dom";
import { Decimal, KumoStoreState, Percent, Vault } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { Grid, Flex, Text, Box } from "theme-ui";

import { Trove } from "../components/Trove/Trove";
import { Stability } from "../components/Stability/Stability";
import { AssetStats } from "../components/AssetStats";
import { useDialogState, Dialog } from "reakit/Dialog";
import { StakingCardV1 } from "../components/StakingCardV1/StakingCardV1";
import { useStabilityView } from "../components/Stability/context/StabilityViewContext";

const select = ({ vaults }: KumoStoreState) => ({
  vaults
});

const style = {
  top: "45%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 470,
  // bgcolor: "background.paper",
  // bgcolor: "white",
  border: "none",
  boxShadow: 24,
  p: 0
};

export const Collateral: React.FC = () => {
  const dialog = useDialogState();
  const history = useHistory();
  const { showModal,view, dispatchEvent } = useStabilityView();
  const { vaults } = useKumoSelector(select);
  const { collateralType } = useParams<{ collateralType: string }>();
  const vault = vaults.find(vault => vault.asset === collateralType) || new Vault();
  const totalCollateralRatioPct = !vault?.total?.isEmpty ? new Percent(vault.total.collateralRatio(vault?.price)).toString(0) : `${Decimal.from(0).prettify(0)} %`;

  useEffect(() => {
    if (!dialog.visible) {
      dispatchEvent("CLOSE_MODAL_PRESSED");
    }
  }, [dialog.visible]);

  useEffect(() => {
    const vault = vaults.find(vault => vault.asset === collateralType)
     if(!vault){
      history.push('/')
     }
  }, [collateralType])

  useEffect(() => {
    const keyDownHandler = (event: { key: string; preventDefault: () => void }) => {
      if (event.key === "Escape") {
       
        event.preventDefault();
        dialog.setVisible(false);
        if(view === "ACTIVE" || view === "DEPOSITING"){
          dispatchEvent("CANCEL_PRESSED");    
        }        
        dispatchEvent("CLOSE_MODAL_PRESSED");      
      }
    };

    document.addEventListener("keydown", keyDownHandler);

    // 👇️ clean up event listener
    return () => {
      document.removeEventListener("keydown", keyDownHandler);
    };
  }, []);

  return (
    <Grid
      columns={[2, "1fr 1fr"]}
      sx={{
        width: "100%",
        gridGap: 2,
        p: 5
      }}
    >
      <Flex sx={{ height: "max-content", width: "95%", mt: 8 }}>
        <Trove />
      </Flex>
      <Flex sx={{ flexDirection: "column", width: "95%" }}>
        <Text as="p" variant="large" sx={{ mb: "20px" }}>
          System Overview
        </Text>
        <AssetStats
          total={vault.total}
          totalCollateralRatioPct={totalCollateralRatioPct}
          kusdMintedCap={vault?.kusdMintedCap}
          minNetDebt={vault?.minNetDebt}
          collateralType={collateralType}
        />
        <Text as="p" variant="large" sx={{ my: 3, mt: 5 }}>
          Stability Pool
        </Text>
        <StakingCardV1
          key={vault?.asset}
          totalKUSD={vault?.kusdInStabilityPool}
          userKUSD={vault?.stabilityDeposit?.currentKUSD}
          handleViewStakeDeposit={() => {
            dispatchEvent("OPEN_MODAL_PRESSED");
            dialog.setVisible(true);
          }}
        />
      </Flex>
      {showModal && (
        <Dialog {...dialog}>
          <Box sx={{ ...style, position: "absolute", borderRadius: "50px", background: "linear-gradient(128.29deg, #FFFFFF 0%, rgba(255, 255, 255, 1) 127.78%)" }}>
            <Stability />
          </Box>
        </Dialog>
      )}
    </Grid>
  );
};
