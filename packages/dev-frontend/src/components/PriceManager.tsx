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
        <Label variant="unitSecondary" sx={{ fontSize: ["10px", "14px"],  borderTopLeftRadius : '12px', borderBottomLeftRadius : '12px' }}>$</Label>
        <Input
          type={canSetPrice ? "number" : "text"}
          step="any"
          value={editedPrice}
          onChange={e => setEditedPrice(e.target.value)}
          disabled={!canSetPrice}
          sx={{ ":focus": { outline: "none" }, fontSize: ["12px", "16px"], bg: 'transparent', borderTopRightRadius : '12px', borderBottomRightRadius : '12px' }}
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
                sx={{
                  height: [30, 34],
                  width: 34
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
