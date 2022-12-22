import React from "react";
import { Progress, Alert, Heading, Text } from "theme-ui";
import { useViewSafetyBanner } from "../hooks/viewSafetyBanner";

export const DomainSafetyBanner: React.FC = () => {
  const { isDomainSafetyCheck, changeInProgress } = useViewSafetyBanner();
  return !isDomainSafetyCheck ? (
    <Alert
      sx={{
        position: "absolute",
        width: "35%",
        top: 5,
        left: 0,
        right: 0,
        m: "auto",
        p: 3,
        backgroundColor: "#f0cfdc",
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        alignItems: "flex-start"
      }}
    >
      <Heading as="h3" sx={{ mb: 2, color: "black" }}>
        Information
      </Heading>
      <Heading as="h4" sx={{ mb: 2, color: "black" }}>
        <Text sx={{ fontWeight: "bold" }}>Safety Check:</Text> Always verify you're on{" "}
        <Text sx={{ fontWeight: "bold" }}>app.kumo.earth</Text>!
      </Heading>
      <Progress max={300} value={changeInProgress} sx={{ color: "#da357a", mb: 1 }} />
    </Alert>
  ) : null;
};
