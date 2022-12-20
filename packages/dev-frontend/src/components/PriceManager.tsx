import React, { useState, useEffect } from "react";
import { Box, Flex, Button, Label, Input } from "theme-ui";
import { Decimal } from "@kumodao/lib-base";
import { useKumo } from "../hooks/KumoContext";

import { Icon } from "./Icon";
import { Transaction } from "./Transaction";

export const PriceManager: React.FC<{ price: Decimal; assetAddress: string }> = ({
  price,
  assetAddress
}) => {
  const {
    kumo: {
      send: kumo,
      connection: { _priceFeedIsTestnet: canSetPrice }
    }
  } = useKumo();

  const [editedPrice, setEditedPrice] = useState(price.toString(2));

  useEffect(() => {
    setEditedPrice(price.toString(2));
  }, [price]);

  return (
    <Box sx={{ p: [2, 3] }}>
      <Flex sx={{ alignItems: "stretch" }}>
        <Label variant="unitSecondary" sx={{ borderTopLeftRadius : '12px', borderBottomLeftRadius : '12px', color: 'white' }}>$</Label>
        <Input
          type={canSetPrice ? "number" : "text"}
          step="any"
          value={editedPrice}
          onChange={e => setEditedPrice(e.target.value)}
          disabled={!canSetPrice}
          sx={{ ":focus": { outline: "none" }, bg: 'transparent', borderTopRightRadius : '12px', borderBottomRightRadius : '12px' }}
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
                return kumo.setPrice(assetAddress, Decimal.from(editedPrice), overrides);
              }}
            >
              <Button
                variant="icon"
                sx={{
                  backgroundColor: "secondaryHover",
                  boxShadow:
                    "rgb(0 0 0 / 20%) 0px 2px 4px -1px, rgb(0 0 0 / 14%) 0px 4px 5px 0px, rgb(0 0 0 / 12%) 0px 1px 10px 0px",
                  border: "none",
                  color: "white",
                  height: 36,
                  width: 36
                }}
              >
                <Icon name="chart-line" size="xs" />
              </Button>
            </Transaction>
          </Flex>
        )}
      </Flex>
    </Box>
  );
};
