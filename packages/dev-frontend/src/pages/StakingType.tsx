import React, { useEffect } from "react";

import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  useEffect(() => {
    if (!dialog.visible || !showModal) {
      dispatchEvent("CLOSE_MODAL_PRESSED");
      navigate("/staking/stability");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog.visible, showModal]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: ["85%", 470],
    // bgcolor: "background.paper",
    bgcolor: "white",
    border: "none",
    boxShadow: 24,
    p: 0
  };
  return (
    <Grid
      sx={{
        gridGap: 3,
        gridTemplateColumns: `repeat(auto-fit, minmax(250px, 1fr))`,
        mt: 5,
        px: 5
      }}
    >
      {vaults.map(vault => {
        return (
          <StakingTypeCard
            key={vault.asset}
            vault={vault}
            handleViewStakeDeposit={() => {
              dispatchEvent("OPEN_MODAL_PRESSED");
              dialog.setVisible(true);
              navigate(`/staking/stability/${vault.asset}`);
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
