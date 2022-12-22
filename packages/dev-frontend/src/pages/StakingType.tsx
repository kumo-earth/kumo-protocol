import { useEffect } from "react";

import { useHistory } from "react-router-dom";
import { Grid, Box } from "theme-ui";
import { Stability } from "../components/Stability/Stability";
import { StakingTypeCard } from "../components/StakingTypeCard/StakingTypeCard";
import { useDialogState, Dialog } from "reakit/Dialog";
import { KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { useStabilityView } from "../components/Stability/context/StabilityViewContext";

const select = ({ vaults }: KumoStoreState) => ({
  vaults
});

export const StakingType: React.FC = () => {
  const { showModal, view, dispatchEvent } = useStabilityView();
  const dialog = useDialogState();
  const { vaults } = useKumoSelector(select);
  const history = useHistory();

  useEffect(() => {
    if (!dialog.visible) {
      dispatchEvent("CLOSE_MODAL_PRESSED");
      history.push("/staking/stability");
    }
  }, [dialog.visible]);

  useEffect(() => {
    const keyDownHandler = (event: { key: string; preventDefault: () => void }) => {

      if (event.key === "Escape") {
        event.preventDefault();
        dialog.setVisible(false);
        if (view === "ACTIVE" || view === "DEPOSITING") {
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

  const style = {
    top: "45%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 470,
    // bgcolor: "background.paper",
    bgcolor: "white",
    border: "none",
    boxShadow: 24,
    p: 0
  };
  return (
    <Grid
      // sx={{
      //   width: "100%",
      //   display: "grid",
      //   gridGap: 2,
      //   gridTemplateColumns: `repeat(auto-fill, minmax(400px, 1fr))`,
      //   height: "100%",
      //   p: 6
      // }}
      sx={{ p: 6, gridGap: 4, gridTemplateColumns: ["auto-fill", "1fr 1fr"] }}
    >
      {vaults.map(vault => {
        return (
          <StakingTypeCard
            key={vault.asset}
            vault={vault}
            handleViewStakeDeposit={() => {
              dispatchEvent("OPEN_MODAL_PRESSED");
              dialog.setVisible(true);
              history.push(`/staking/stability/${vault.asset}`);
            }}
          />
        );
      })}
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
