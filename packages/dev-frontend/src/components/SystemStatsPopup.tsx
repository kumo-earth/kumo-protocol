import React, { useState, useRef } from "react";
import { Container, Flex, Button } from "theme-ui";

import { KumoStoreState, Vault } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";

import { Icon } from "./Icon";
import { SystemStats } from "./SystemStats";
import { useParams } from "react-router-dom";

import appBackground from "../asset/images/appBackground.svg";

const select = ({ vaults }: KumoStoreState) => ({ vaults });

export const SystemStatsPopup: React.FC = () => {
  const { vaults } = useKumoSelector(select);

  const { collateralType } = useParams<{ collateralType: string }>();
  const vault = vaults.find(vault => vault.asset === collateralType) ?? new Vault();
  const { price, total } = vault;

  const [systemStatsOpen, setSystemStatsOpen] = useState(false);
  const systemStatsOverlayRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <Button
        onClick={() => setSystemStatsOpen(!systemStatsOpen)}
        variant="icon"
        sx={{
          position: "relative",
          display: ["block", "none"]
        }}
      >
        <Icon name="info-circle" size="2x" />

        {total.collateralRatioIsBelowCritical(price) && (
          <Flex
            sx={{
              position: "absolute",
              right: 0,
              top: 0,
              width: "100%",
              height: "100%",

              alignItems: "flex-start",
              justifyContent: "flex-end",
              pt: "2px",

              color: "danger"
            }}
          >
            <Icon name="exclamation-circle" size="xs" />
          </Flex>
        )}
      </Button>

      {systemStatsOpen && (
        <Container
          variant="systemStatsOverlay"
          ref={systemStatsOverlayRef}
          sx={{ backgroundImage: `url(${appBackground})` }}
        >
          <SystemStats variant="infoPopup" showBalances  onClose={() => setSystemStatsOpen(false)}/>
        </Container>
      )}
    </>
  );
};
