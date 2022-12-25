import React, { useState, useEffect, useCallback } from "react";
// import CopyToClipboard from "react-copy-to-clipboard";
import { Card, Button, Text, Box, Heading, Flex, Select } from "theme-ui";

import {
  Percent,
  MINIMUM_COLLATERAL_RATIO,
  CRITICAL_COLLATERAL_RATIO,
  UserTrove,
  Decimal,
  Vault,
  Trove,
  CORE_TEAM_ACCOUNTS,
} from "@kumodao/lib-base";
import { BlockPolledKumoStoreState } from "@kumodao/lib-ethers";
import { useKumoSelector } from "@kumodao/lib-react";

import { shortenAddress } from "../utils/shortenAddress";
import { useKumo } from "../hooks/KumoContext";
import { COIN } from "../strings";

import { Icon } from "./Icon";
import { LoadingOverlay } from "./LoadingOverlay";
import { Transaction } from "./Transaction";
import { Tooltip } from "./Tooltip";
import { Abbreviation } from "./Abbreviation";
import CopyToClipboard from "react-copy-to-clipboard";
import { PriceManager } from "./PriceManager";
import { AddressZero } from "@ethersproject/constants";
import { useWeb3React } from "@web3-react/core";
import { Web3Provider } from "@ethersproject/providers";

const rowHeight = "40px";

const liquidatableInNormalMode = (trove: UserTrove, price: Decimal) =>
  [trove.collateralRatioIsBelowMinimum(price), "Collateral ratio not low enough"] as const;

const liquidatableInRecoveryMode = (
  trove: UserTrove,
  price: Decimal,
  totalCollateralRatio: Decimal,
  kusdInStabilityPool: Decimal
) => {
  const collateralRatio = trove.collateralRatio(price);

  if (collateralRatio.gte(MINIMUM_COLLATERAL_RATIO) && collateralRatio.lt(totalCollateralRatio)) {
    return [
      trove.debt.lte(kusdInStabilityPool),
      "There's not enough KUSD in the Stability pool to cover the debt"
    ] as const;
  } else {
    return liquidatableInNormalMode(trove, price);
  }
};

type RiskyTrovesProps = {
  pageSize: number;
};

interface UpdatedUserTrove {
  asset: string;
  assetAddress: string;
  price: Decimal;
  total: Trove;
  kusdInStabilityPool: Decimal;
  recoveryMode: boolean;
  totalCollateralRatio: Decimal;
  userTrove: UserTrove;
}

const select = ({ vaults, blockTag }: BlockPolledKumoStoreState) => ({
  vaults,
  blockTag
});

export const RiskyTroves: React.FC<RiskyTrovesProps> = ({ pageSize = 10 }) => {
  const { account } = useWeb3React<Web3Provider>();
  const [assetType, setAssetType] = useState("ctx");
  const { vaults, blockTag } = useKumoSelector(select);
  const { kumo } = useKumo();
  let numberOfTroves = 0;
  let price = Decimal.ZERO;
  let assetAddress = AddressZero;

  // if (assetType === "all") {
  //   vaults.forEach(vault => {
  //     numberOfTroves += vault?.numberOfTroves;
  //   });
  // } else 

  if (assetType === "ctx" || assetType === "cty") {
    const vault = vaults.find(vault => vault.asset === assetType);
    if (vault) {
      price = vault.price;
      assetAddress = vault.assetAddress;
      numberOfTroves = vault?.numberOfTroves || 0;
    }

  }

  const [loading, setLoading] = useState(true);
  const [troves, setTroves] = useState<UpdatedUserTrove[]>();

  const [reload, setReload] = useState({});
  const forceReload = useCallback(() => setReload({}), []);

  const [page, setPage] = useState(0);
  const numberOfPages = Math.ceil(numberOfTroves / pageSize) || 1;
  const clampedPage = Math.min(page, numberOfPages - 1);

  const nextPage = () => {
    if (clampedPage < numberOfPages - 1) {
      setPage(clampedPage + 1);
    }
  };

  const previousPage = () => {
    if (clampedPage > 0) {
      setPage(clampedPage - 1);
    }
  };

  useEffect(() => {
    if (page !== clampedPage) {
      setPage(clampedPage);
    }
  }, [page, clampedPage]);

  useEffect(() => {
    let mounted = true;

    setLoading(true);

    if (assetType === "ctx" || assetType === "cty") {
      const tempVault = vaults.find(vault => vault.asset === assetType);
      if (tempVault) {
        const { asset, assetAddress, price, total, kusdInStabilityPool, numberOfTroves } = tempVault;
        const recoveryMode = total.collateralRatioIsBelowCritical(price);
        const totalCollateralRatio = total.collateralRatio(price);
        kumo
          .getTroves(
            assetAddress,
            {
              first: pageSize,
              sortedBy: "ascendingCollateralRatio",
              startingAt: clampedPage * pageSize
            },
            { blockTag }
          )
          .then(trovesVal => {
            if (mounted) {
              const userTroves = trovesVal.flat();
              const updatedUserTroves = userTroves?.map(userTrove => {
                return {
                  asset,
                  assetAddress,
                  price,
                  total,
                  kusdInStabilityPool,
                  recoveryMode,
                  totalCollateralRatio,
                  userTrove: userTrove
                };
              });
              if (userTroves !== undefined && userTroves.length > 0) {
                setTroves(updatedUserTroves);
              } else {
                setTroves([]);
              }
              setLoading(false);
            }
          });
      }
    }

    // Promise.all(getAllTroves).then(troves => {
    //   if (mounted) {
    //     setTroves(troves);
    //     setLoading(false);
    //   }
    // });

    // kumo
    //   .getTroves(
    //     vault?.assetAddress,
    //     {
    //       first: pageSize,
    //       sortedBy: "ascendingCollateralRatio",
    //       startingAt: clampedPage * pageSize
    //     },
    //     { blockTag }
    //   )
    //   .then(troves => {
    //     if (mounted) {
    //       console.log("getAllTroves", troves)
    //       setTroves(troves);
    //       setLoading(false);
    //     }
    //   });

    return () => {
      mounted = false;
    };
    // Omit blockTag from deps on purpose
    // eslint-disable-next-line
  }, [kumo, clampedPage, pageSize, reload, assetType]);

  useEffect(() => {
    forceReload();
  }, [forceReload, numberOfTroves, price]);

  const [copied, setCopied] = useState<string>();

  useEffect(() => {
    if (copied !== undefined) {
      let cancelled = false;

      setTimeout(() => {
        if (!cancelled) {
          setCopied(undefined);
        }
      }, 2000);

      return () => {
        cancelled = true;
      };
    }
  }, [copied]);

  return (
    <Card sx={{ width: "100%", height: "100%", bg: "#f0cfdc", borderRadius: 20 }}>
      <Heading sx={{ display: "flex", justifyContent: "space-between" }}>
        <Flex sx={{ alignItems: "center" }}>
          {numberOfTroves !== 0 && (
            <>
              <Abbreviation
                short={`page ${clampedPage + 1} / ${numberOfPages}`}
                sx={{ mr: [0, 3], fontWeight: "body", fontSize: [1, 2], letterSpacing: [-1, 0] }}
              >
                {clampedPage * pageSize + 1}-{Math.min((clampedPage + 1) * pageSize, numberOfTroves)}{" "}
                of {numberOfTroves}
              </Abbreviation>

              <Button variant="titleIcon" onClick={previousPage} disabled={clampedPage <= 0}>
                <Icon name="chevron-left" size="sm" />
              </Button>

              <Button
                variant="titleIcon"
                onClick={nextPage}
                disabled={clampedPage >= numberOfPages - 1}
              >
                <Icon name="chevron-right" size="sm" />
              </Button>
              <Button
                variant="titleIcon"
                sx={{ opacity: loading ? 0 : 1, ml: [0, 3], mr: [0, 3] }}
                onClick={forceReload}
              >
                <Icon name="redo" size="xs" />
              </Button>
            </>
          )}
        </Flex>
        <Box>
          {
            ((account && troves) && (CORE_TEAM_ACCOUNTS.includes(account) && troves?.length > 0)) ? <PriceManager price={price} assetAddress={assetAddress} /> : null
          }

        </Box>
        <Box sx={{ display: "flex", mr: 7 }}>
          <Text sx={{ fontSize: 4 }}>Riskiest Vaults:</Text>
          <Select value={assetType} onChange={event => setAssetType(event.target.value)}>
            <option value={"ctx"}>CTX</option>
            <option value={"cty"}>CTY</option>
          </Select>
        </Box>
      </Heading>

      {!troves || troves.length === 0 ? (
        <Box sx={{ p: [2, 3] }}>
          <Box sx={{ p: 4, fontSize: 3, textAlign: "center" }}>
            {!troves ? "Loading..." : "There are no Vaults yet"}
          </Box>
        </Box>
      ) : (
        <Box sx={{ p: [2, 3] }}>
          <Box
            as="table"
            sx={{
              mt: 2,
              pl: [1, 4],
              width: "100%",

              textAlign: "center",
              lineHeight: 1.15
            }}
          >
            <colgroup>
              <col style={{ width: "50px" }} />
              <col />
              <col />
              <col />
              <col style={{ width: rowHeight }} />
            </colgroup>

            <thead>
              <tr>
                <th>Owner</th>
                <th>
                  <Abbreviation short="Coll.">Collateral</Abbreviation>
                  <Box sx={{ fontSize: [0, 1], fontWeight: "body", opacity: 0.5 }}>
                    {assetType !== "all" ? assetType.toUpperCase() : ""}
                  </Box>
                </th>
                <th>
                  Debt
                  <Box sx={{ fontSize: [0, 1], fontWeight: "body", opacity: 0.5 }}>{COIN}</Box>
                </th>
                <th>
                  Coll.
                  <br />
                  Ratio
                </th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {troves.map(
                trove =>
                  !trove.userTrove.isEmpty && ( // making sure the Trove hasn't been liquidated
                    // (TODO: remove check after we can fetch multiple Troves in one call)
                    <tr key={trove.userTrove.ownerAddress}>
                      <td
                        style={{
                          display: "flex",
                          alignItems: "center",
                          height: rowHeight
                        }}
                      >
                        <Tooltip message={trove.userTrove.ownerAddress} placement="top">
                          <Text
                            variant="address"
                            sx={{
                              width: ["73px", "unset"],
                              overflow: "hidden",
                              position: "relative"
                            }}
                          >
                            {shortenAddress(trove.userTrove.ownerAddress)}
                            <Box
                              sx={{
                                display: ["block", "none"],
                                position: "absolute",
                                top: 0,
                                right: 0,
                                width: "50px",
                                height: "100%",
                                background:
                                  "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)"
                              }}
                            />
                          </Text>
                        </Tooltip>

                        <CopyToClipboard
                          text={trove?.userTrove?.ownerAddress}
                          onCopy={() => setCopied(trove?.userTrove?.ownerAddress)}
                        >
                          <Button variant="icon" sx={{ width: "24px", height: "24px" }}>
                            <Icon
                              name={
                                copied === trove?.userTrove?.ownerAddress
                                  ? "clipboard-check"
                                  : "clipboard"
                              }
                              size="sm"
                            />
                          </Button>
                        </CopyToClipboard>
                      </td>
                      <td>
                        <Abbreviation short={trove.userTrove.collateral.shorten()}>
                          {trove.userTrove.collateral.prettify(0)}{" "}
                          <Text sx={{ fontSize: "10px", fontWeight: 900 }}>
                            {assetType === "all" ? trove?.asset?.toUpperCase() : ""}
                          </Text>
                        </Abbreviation>
                      </td>
                      <td>
                        <Abbreviation short={trove.userTrove.debt.shorten()}>
                          {trove.userTrove.debt.prettify(0)}
                        </Abbreviation>
                      </td>
                      <td>
                        {(collateralRatio => (
                          <Text
                            color={
                              collateralRatio.gt(CRITICAL_COLLATERAL_RATIO)
                                ? "success"
                                : collateralRatio.gt(1.2)
                                  ? "warning"
                                  : "danger"
                            }
                          >
                            {new Percent(collateralRatio).prettify()}
                          </Text>
                        ))(trove.userTrove.collateralRatio(trove?.price))}
                      </td>
                      <td>
                        <Transaction
                          id={`liquidate-${trove.userTrove.ownerAddress}`}
                          tooltip="Liquidate"
                          requires={[
                            trove?.recoveryMode
                              ? liquidatableInRecoveryMode(
                                trove.userTrove,
                                trove?.price,
                                trove?.totalCollateralRatio,
                                trove?.kusdInStabilityPool
                              )
                              : liquidatableInNormalMode(trove.userTrove, trove?.price)
                          ]}
                          send={kumo.send.liquidate.bind(
                            kumo.send,
                            trove?.assetAddress,
                            trove.userTrove.ownerAddress
                          )}
                        >
                          <Button variant="dangerIcon">
                            <Icon name="trash" />
                          </Button>
                        </Transaction>
                      </td>
                    </tr>
                  )
              )}
            </tbody>
          </Box>
        </Box>
      )}

      {loading && <LoadingOverlay />}
    </Card>
  );
};
