import React, { useState, useEffect } from "react";
import { Card, Box, Heading, Flex, Button, Label, Input } from "theme-ui";

import { Decimal, KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { AddressZero } from "@ethersproject/constants";

import { useKumo } from "../hooks/KumoContext";

import { Icon } from "./Icon";
import { Transaction } from "./Transaction";

const selectPrice = ({ price }: KumoStoreState) => price;

export const PriceManager: React.FC = () => {
  const {
    kumo: {
      send: kumo,
      connection: { _priceFeedIsTestnet: canSetPrice }
    }
  } = useKumo();

  const price = useKumoSelector(selectPrice);
  const [editedPrice, setEditedPrice] = useState(price.toString(2));

  useEffect(() => {
    setEditedPrice(price.toString(2));
  }, [price]);

  return (
    <Card variant="base">
      <Heading>Price feed</Heading>

      <Box sx={{ p: [2, 3] }}>
        <Flex sx={{ alignItems: "stretch" }}>
          <Label>ETH</Label>

          <Label variant="unit">$</Label>

          <Input
            type={canSetPrice ? "number" : "text"}
            step="any"
            value={editedPrice}
            onChange={e => setEditedPrice(e.target.value)}
            disabled={!canSetPrice}
          />

          {canSetPrice && (
            <Flex sx={{ ml: 2, alignItems: "center" }}>
              <Transaction
                id="set-price"
                tooltip="Set"
                tooltipPlacement="bottom"
                send={overrides => {
                  if (!editedPrice) {
                    throw new Error("Invalid price");
                  }
                  return kumo.setPrice(AddressZero, Decimal.from(editedPrice), overrides);
                }}
              >
                <Button
                  variant="icon"
                  sx={{
                    backgroundColor: "rgb(152, 80, 90)",
                    boxShadow:
                      "rgb(0 0 0 / 20%) 0px 2px 4px -1px, rgb(0 0 0 / 14%) 0px 4px 5px 0px, rgb(0 0 0 / 12%) 0px 1px 10px 0px",
                    border: "none",
                    color: "white"
                  }}
                >
                  <Icon name="chart-line" size="lg" />
                </Button>
              </Transaction>
            </Flex>
          )}
        </Flex>
      </Box>
    </Card>
  );
};
