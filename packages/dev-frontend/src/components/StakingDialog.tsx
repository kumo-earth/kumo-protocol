import React, { ReactNode } from "react";
import { Heading, Flex, Card, Button, Box } from "theme-ui";
import { Stability } from "../components/Stability/Stability";

import { Icon } from "./Icon";

type DialogIntent = "success" | "warning" | "danger" | "info";

type DialogProps = {
  children: ReactNode,
  intent?: DialogIntent;
  title: string;
  icon?: React.ReactNode;
  cancelLabel?: string;
  onClose: () => void;
};

const iconFromIntent = (intent: DialogIntent | undefined) => {
  switch (intent) {
    case "success":
      return <Icon name="check-circle" color="success" aria-label="Success" />;
    case "warning":
      return <Icon name="exclamation-triangle" color="warning" aria-label="Warning" />;
    case "danger":
      return <Icon name="exclamation-triangle" color="danger" aria-label="Danger" />;
    case "info":
      return <Icon name="info-circle" color="info" aria-label="Info" />;
  }
  return null;
};

export const StakingDialog: React.FC<DialogProps> = ({
  intent,
  title,
  icon,
  cancelLabel,
  onClose,
  children
}) => (
  <Card sx={{ p: 0, borderRadius: "4px" }}>
    {intent ? <Box sx={{ height: "4px", bg: intent, borderRadius: "3px 3px 0 0" }} /> : null}
    <Flex
      sx={{
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: 1,
        borderColor: "muted",
        p: [3, 4],
        pb: 3
      }}
    >
      {icon || iconFromIntent(intent)}
      <Heading as="h1" sx={{ textAlign: "center", color: "black", fontSize: [2, 3], px: [3, 0] }}>
        {title}
      </Heading>
      <Button variant="secondary" onClick={onClose}>
        <Icon name="times" size="lg" aria-label={cancelLabel?.toUpperCase() || "CANCEL"} />
      </Button>
    </Flex>
    <Stability />
  </Card>
);
