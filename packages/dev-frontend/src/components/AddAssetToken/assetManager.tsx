import React, { useState, useEffect } from "react";
import { Box, Flex, Label, Input } from "theme-ui";

export const AssetManager: React.FC<{ toAddress: string }> = ({
  toAddress
}) => {
  const [editedPrice, setEditedPrice] = useState(toAddress);

  useEffect(() => {
    setEditedPrice(toAddress);
  }, [toAddress]);

  return (
    
      <Flex sx={{ width: "100%", height: "100%" }}>
        <Label variant="unitSecondary" sx={{ fontSize: ["10px", "14px"],  borderTopLeftRadius : '12px', borderBottomLeftRadius : '12px' }}></Label>
        <Input
          type="text"
          step="any"
          value={editedPrice}
          onChange={e => setEditedPrice(e.target.value)}
          sx={{ ":focus": { outline: "none" }, fontSize: ["12px", "16px"], bg: 'transparent', borderTopRightRadius : '12px', borderBottomRightRadius : '12px' }}
        />
      </Flex>
  );
};
