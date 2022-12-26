import React, { useState } from "react";
import { Text, Flex, Label, Input, SxProp, Box, Button, ThemeUICSSProperties } from "theme-ui";
import { Decimal } from "@kumodao/lib-base";
import { Icon } from "../Icon";

type RowProps = SxProp & {
  label: string;
  labelId?: string;
  labelFor?: string;
  infoIcon?: React.ReactNode;
};

export const Row: React.FC<RowProps> = ({ sx, label, labelId, labelFor, children, infoIcon }) => {
  return (
    <Flex sx={{ alignItems: "stretch", ...sx }}>
      <Label
        id={labelId}
        htmlFor={labelFor}
        sx={{
          p: 0,
          pl: 3,
          pt: "12px",
          position: "absolute",

          fontSize: 1,
          fontWeight: "bold",
          border: 1,
          borderColor: "transparent"
        }}
      >
        <Flex sx={{ alignItems: "center" }}>
          {label}
          {infoIcon && infoIcon}
        </Flex>
      </Label>
      {children}
    </Flex>
  );
};

type TokenUsdProps = SxProp & {
  tokenPrice: Decimal;
  editedVal: Decimal;
  right?: string;
};

export const TokenUsd: React.FC<TokenUsdProps> = ({
  sx,
  tokenPrice = Decimal.ZERO,
  editedVal = Decimal.ZERO,
  right = "50px",
  children
}) => {
  return (
    <Box
      sx={{
        p: 0,
        pl: 0,
        position: "absolute",
        pt: "12px",
        right: right,
        top: "25px",
        fontSize: 2,
        fontWeight: "bold",
        border: 1,
        borderColor: "transparent"
      }}
    >
      ${editedVal.mul(tokenPrice).prettify(2)}
    </Box>
  );
};

type PendingAmountProps = {
  value: string;
};

const PendingAmount: React.FC<PendingAmountProps & SxProp> = ({ sx, value }) => (
  <Text {...{ sx }}>
    (
    {value === "++" ? (
      <Icon name="angle-double-up" />
    ) : value === "--" ? (
      <Icon name="angle-double-down" />
    ) : value?.startsWith("+") ? (
      <>
        <Icon name="angle-up" /> {value.substr(1)}
      </>
    ) : value?.startsWith("-") ? (
      <>
        <Icon name="angle-down" /> {value.substr(1)}
      </>
    ) : (
      value
    )}
    )
  </Text>
);

type StaticAmountsProps = {
  inputId: string;
  labelledBy?: string;
  amount: string;
  unit?: string;
  color?: string;
  pendingAmount?: string;
  pendingColor?: string;
  tokenPrice?: Decimal;
  onClick?: () => void;
};

export const StaticAmounts: React.FC<StaticAmountsProps & SxProp> = ({
  sx,
  inputId,
  labelledBy,
  amount,
  unit,
  color,
  pendingAmount,
  pendingColor,
  tokenPrice,
  onClick,
  children
}) => {
  return (
    <Flex
      id={inputId}
      aria-labelledby={labelledBy}
      {...{ onClick }}
      sx={{
        justifyContent: "space-between",
        alignItems: "center",

        ...(onClick ? { cursor: "text" } : {}),

        ...staticStyle,
        ...sx
      }}
    >
      <Flex sx={{ alignItems: "center" }}>
        <Text sx={{ color, fontWeight: "medium" }}>{amount}</Text>
        {tokenPrice && (
          <TokenUsd tokenPrice={tokenPrice} editedVal={Decimal.from(amount)} right="20px" />
        )}
        {unit && (
          <>
            &nbsp;
            <Text sx={{ fontWeight: "light", opacity: 0.8 }}>{unit}</Text>
          </>
        )}

        {pendingAmount && (
          <>
            &nbsp;
            <PendingAmount
              sx={{ color: pendingColor, opacity: 0.8, fontSize: "0.666em" }}
              value={pendingAmount}
            />
          </>
        )}
      </Flex>

      {children}
    </Flex>
  );
};

const staticStyle: ThemeUICSSProperties = {
  flexGrow: 1,

  mb: 0,
  pl: 3,
  pr: "11px",
  pb: 0,
  pt: "28px",

  fontSize: 3,

  border: 1,
  borderColor: "transparent"
};

const editableStyle: ThemeUICSSProperties = {
  flexGrow: 1,

  mb: [2, 3],
  pl: 3,
  pr: "11px",
  pb: 2,
  pt: "28px",

  fontSize: 4,

  boxShadow: [1, 2],
  border: 1,
  borderColor: "muted"
};

type StaticRowProps = RowProps & StaticAmountsProps;

export const StaticRow: React.FC<StaticRowProps> = ({
  label,
  labelId,
  labelFor,
  infoIcon,
  ...props
}) => (
  <Row {...{ label, labelId, labelFor, infoIcon }} sx={{ mt: [-2, -3], pb: [2, 3] }}>
    <StaticAmounts {...props} />
  </Row>
);

type DisabledEditableRowProps = Omit<StaticAmountsProps, "labelledBy" | "onClick"> & {
  label: string;
  tokenPrice?: Decimal;
};

export const DisabledEditableRow: React.FC<DisabledEditableRowProps> = ({
  inputId,
  label,
  unit,
  amount,
  color,
  pendingAmount,
  pendingColor,
  tokenPrice
}) => (
  <Row labelId={`${inputId}-label`} {...{ label, unit }}>
    <StaticAmounts
      sx={{ ...editableStyle, boxShadow: 0, position: "relative" }}
      labelledBy={`${inputId}-label`}
      {...{ inputId, amount, unit, color, pendingAmount, pendingColor, tokenPrice }}
    />
  </Row>
);

type EditableRowProps = DisabledEditableRowProps & {
  editingState: [string | undefined, (editing: string | undefined) => void];
  editedAmount: string;
  setEditedAmount: (editedAmount: string) => void;
  maxAmount?: string;
  maxedOut?: boolean;
  tokenPrice?: Decimal;
};

export const EditableRow: React.FC<EditableRowProps> = ({
  label,
  inputId,
  unit,
  amount,
  color,
  pendingAmount,
  pendingColor,
  editingState,
  editedAmount,
  setEditedAmount,
  maxAmount,
  maxedOut,
  tokenPrice
}) => {
  const [editing, setEditing] = editingState;
  const [invalid, setInvalid] = useState(false);

  return editing === inputId ? (
    <Row {...{ label, labelFor: inputId, unit }} sx={{ position: "relative" }}>
      <Input
        autoFocus
        id={inputId}
        type="number"
        step="any"
        defaultValue={editedAmount}
        {...{ invalid }}
        onChange={e => {
          try {
            setEditedAmount(e.target.value);
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
        onBlur={() => {
          setEditing(undefined);
          setInvalid(false);
        }}
        variant="editor"
        sx={{
          ...editableStyle,
          fontWeight: "medium",
          bg: invalid && "invalid",
          outline: "none"
        }}
      />
      {tokenPrice && <TokenUsd tokenPrice={tokenPrice} editedVal={Decimal.from(editedAmount)} />}
    </Row>
  ) : (
    <Row labelId={`${inputId}-label`} {...{ label, unit }} sx={{ position: "relative" }}>
      <StaticAmounts
        sx={{
          ...editableStyle,
          bg: invalid && "invalid"
        }}
        labelledBy={`${inputId}-label`}
        onClick={() => setEditing(inputId)}
        {...{ inputId, amount, unit, color, pendingAmount, pendingColor, invalid }}
      >
        {tokenPrice && (
          <TokenUsd tokenPrice={tokenPrice} editedVal={Decimal.from(editedAmount)} right="80px" />
        )}
        {maxAmount && (
          <Button
            sx={{
              fontSize: 1,
              py: 1,
              px: 3,
              borderRadius: '72px'
            }}
            onClick={event => {
              setEditedAmount(maxAmount);
              event.stopPropagation();
            }}
            disabled={maxedOut}
          >
            max
          </Button>
        )}
      </StaticAmounts>
    </Row>
  );
};
