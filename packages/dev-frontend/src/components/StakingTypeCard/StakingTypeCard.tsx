import React, { useState, useRef } from "react";
import { useHistory } from "react-router-dom";
import { Flex, Button, Progress, Box, Card, Heading, Text, Link } from "theme-ui";
import { useLiquitySelector } from "@liquity/lib-react";
import { Icon } from "../Icon";

type CollateralCardProps = {
  collateralType?: string;
};

export const StakingTypeCard: React.FC<CollateralCardProps> = ({
  collateralType,
}) => {
  const history = useHistory();
  return (
    <Card
      sx={{
        background: "transparent !important",
        color: "rgba(0, 0, 0, 0.87)",
        transition: "box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        boxShadow: "0 3px 10px rgba(0, 0, 0, 0.5)",
        borderRadius: "20px",
        maxWidth: 450,
        maxHeight: "425px"
      }}
    //   onClick={() => history.push(`/dashboard/${collateralType}`)}
    >
      <Heading
        sx={{
          height: "100px !important",
          padding: "2rem 2rem 2rem 2rem",
          borderBottom: "1px solid rgba(0, 0, 0, 0.281)",
          marginBottom: "-1px",
          overflow: "hidden",
          color: "#eaeaea",
          background: "linear-gradient(103.69deg, #2b2b2b 18.43%, #525252 100%)",
          borderRadius: "20px 20px 0 0"
        }}
      >
        {(collateralType === "eth" && "ETH") || (collateralType === "mco" && "MCO2")}
      </Heading>

      <Box sx={{ p: [2, 3] }}>
      <Flex sx={{ justifyContent: "space-between", alignItems: 'center' }}>
        <Heading
          as="h6"
          sx={{
            fontSize: 14,
            color: "#f9f8f9",
            padding: "1.5rem 1.5rem 10px 1.5rem"
          }}
        >
          APR
        </Heading>
        <Heading
          as="h6"
          sx={{
            fontFamily: "Roboto, Helvetica, Arial, sans-serif",
            fontWeight: "bold",
            letterSpacing: "0.5px",
            fontSize: 14,
            color: "#f9f8f9",
            padding: "1.5rem 1.5rem 10px 1.5rem"
          }}
        >
          Total KUMO In Pool
        </Heading>
        </Flex>
        <Flex sx={{ justifyContent: "space-between" }}>
          <Heading
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "32px",
              color: "#f9f8f9",
              padding: "0 1.5rem 10px 1.5rem"
            }}
          >
            8.13%
          </Heading>
          <Heading
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "32px",
              color: "#f9f8f9",
              padding: "0 1.5rem 10px 1.5rem"
            }}
          >
            968,328.15
          </Heading>
          
        </Flex>
        <Heading
            as={'h6'}
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "14px",
              color: "#f9f8f9",
              padding: "0 1.5rem 10px 1.5rem",
              marginLeft: 'auto',
              width: 'fit-content'
            }}
          >
           ~ $995,810
          </Heading>
        <Flex sx={{ justifyContent: "space-between" }}>
          <Heading
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "14px",
              color: "#f9f8f9",
              padding: "0 1.5rem 10px 1.5rem"
            }}
          >
            MINTED VST
          </Heading>
          <Heading
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "14px",
              color: "#f9f8f9",
              padding: "0 1.5rem 10px 1.5rem"
            }}
          >
            Heading
          </Heading>
        </Flex>
        <Flex sx={{ padding: "1.5rem" }}>
          <Text
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "14px",
              color: "#f9f8f9",
              paddingRight: "1rem",
              flex: 1
            }}
          >
            The system is in normal mode. Recovery mode will be activated if ETH price goes down by
            51% to $1706.56.
          </Text>
          <Text
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "14px",
              color: "#f9f8f9"
            }}
          >
            42,42,496
          </Text>
        </Flex>
      </Box>
    </Card>
  );
};