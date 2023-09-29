import React from 'react';
import { Box, Button, Card, Heading, Text } from 'theme-ui';
import { DashboadContent } from '../components/DashboardContent';
import { ASSET_TOKENS } from '@kumodao/lib-base';
import { AddAssetAction } from '../components/AddAssetToken/AddAssetAction';
import { useMyTransactionState } from '../components/Transaction';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useWeb3React } from '@web3-react/core';
import { useKumoSelector } from '@kumodao/lib-react';
import { BlockPolledKumoStoreState } from '@kumodao/lib-ethers';
import { injectedConnector } from '../connectors/injectedConnector';
import { InfoIcon } from '../components/InfoIcon';
import { Link } from '../components/Link';


const TRANSACTION_ID = "add-test-token";
const Faucet = () => {
    const { account } = useWeb3React();
    const { vaults, kusdToken, kumoToken, kusdBalance, kumoBalance } = useKumoSelector(({ vaults, kusdToken, kumoToken, kusdBalance, kumoBalance, blockTag }: BlockPolledKumoStoreState) => ({
        kusdToken,
        kumoToken,
        kusdBalance,
        kumoBalance,
        vaults,
        blockTag
    }));
    const transactionState = useMyTransactionState(TRANSACTION_ID);

    const isTransactionPending =
        transactionState.type === "waitingForApproval" ||
        transactionState.type === "waitingForConfirmation";

    const isTransactionConfirmed = transactionState.type === "confirmed"

    const addAsset = async (address: string, symbol: string) => {
        const provider = await injectedConnector.getProvider();

        try {
            const wasAdded = await provider?.request({
                method: "wallet_watchAsset",
                params: {
                    type: "ERC20", // Initially only supports ERC20, but eventually more!
                    options: {
                        address,
                        symbol,
                        decimals: 18
                    }
                }
            });

            if (wasAdded) {
                console.log(`Asset Token ${symbol} added`);
            } else {
                console.log(`Asset Token ${symbol} failed`);
            }
        } catch (error) {
            console.log(error);
        }
    };
    return (
        <DashboadContent>
            <Box sx={{ display: "flex", flexDirection: "column" }}>
                <Card sx={{ width: "100%", minWidth: "300px", height: "100%", bg: "#f0cfdc", borderRadius: 20 }}>
                    <Heading sx={{ display: "flex", height: ['max-content !important', "60px"], justifyContent: "space-between", flexDirection: ['column', "row"], mt: 3 }}>
                        KUMO Faucet
                    </Heading>
                    <Box sx={{ px: 0, py: [2, 3] }}>
                        <Box
                            as="table"
                            sx={{
                                mt: 2,
                                width: "100%",

                                textAlign: "center",
                                lineHeight: 1.15
                            }}
                        >
                            <colgroup>
                                <col style={{ width: "30%" }} />
                                <col style={{ width: "35%" }} />
                                <col style={{ width: "15%" }} />
                                <col style={{ width: "25%" }} />
                            </colgroup>

                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>
                                        Available Balance
                                    </th>
                                    <th>
                                        Claimed Tokens
                                    </th>
                                    <th>
                                        Get Tokens
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {
                                    Object.keys(ASSET_TOKENS).map(token => {
                                        const { assetName, assetAddress } = ASSET_TOKENS[token];
                                        const vault = vaults.find(vault => vault.asset === token);
                                        return <tr key={assetName}>
                                            <td>
                                                <Text sx={{ fontSize: 1 }}>
                                                    {assetName}
                                                </Text>
                                            </td>
                                            <td>
                                                {
                                                    vault?.testTokensTransfered ?
                                                        <Text sx={{ fontWeight: 500, fontSize: 1 }}>For more tokens, contact <Text sx={{ fontWeight: "bold" }}>contact@kumo.earth</Text></Text>
                                                        : <Text sx={{ fontSize: 1 }}>50000</Text>
                                                }

                                            </td>
                                            <td>
                                                {
                                                    vault?.testTokensTransfered ? <Text sx={{ fontSize: 1 }}>50000</Text> : <Text sx={{ fontSize: 1 }}>0</Text>

                                                }
                                            </td>
                                            <td style={{
                                                display: "flex",
                                                justifyContent: "center"
                                            }}>
                                                {
                                                    (account && !vault?.testTokensTransfered) ?
                                                        <AddAssetAction transactionId={TRANSACTION_ID} type="requestTestTokens" isTransactionConfirmed={isTransactionConfirmed} tokenAddress={assetAddress} tokenSymbol={token.toUpperCase()}>
                                                            {token.toUpperCase()}
                                                        </AddAssetAction> : (account && vault?.testTokensTransfered) ?

                                                            <Box sx={{ display: "flex", alignItems: 'center', justifyContent: "center", width: "90%", fontSize: 1 }}><Button onClick={() => addAsset(assetAddress, token.toUpperCase())} sx={{ py: "4px", width: ["100%", "65%"] }}>
                                                                Import</Button>
                                                                <InfoIcon
                                                                    tooltip={
                                                                        <Card variant="tooltip" sx={{ width: "220px" }}>
                                                                            {`Can't see your ${token.toUpperCase()} in MetaMask, Click to Import!`}
                                                                        </Card>

                                                                    }
                                                                /></Box>
                                                            :
                                                            <Button variant="primaryInActive" disabled sx={{ py: "4px", width: ["100%", "65%"], fontSize: 1 }}>Connect</Button>
                                                }
                                            </td>
                                        </tr>
                                    })
                                }
                                <tr key={"kusd"}>
                                    <td>
                                        <Text>
                                            {"KUSD Token"}
                                        </Text>
                                    </td>
                                    <td>
                                        {kusdBalance.toString()}
                                    </td>
                                    <td>
                                        -
                                    </td>
                                    <td style={{
                                        display: "flex",
                                        justifyContent: "center"
                                    }}>
                                        {
                                            account ?
                                                <Box sx={{ display: "flex", alignItems: 'center', justifyContent: "center", width: "90%" }}><Button onClick={() => addAsset(kusdToken, "KUSD")} sx={{ py: "4px", width: ["100%", "60%"], fontSize: 1 }}>
                                                    Import</Button>
                                                    <InfoIcon
                                                        tooltip={
                                                            <Card variant="tooltip" sx={{ width: "220px", fontSize: 1 }}>
                                                                {`Can't see your ${"KUSD"} in MetaMask, Click to Import!`}
                                                            </Card>

                                                        }
                                                    /></Box>
                                                :
                                                <Button variant="primaryInActive" disabled sx={{ py: "4px", width: ["100%", "65%"], fontSize: 1 }}>Connect</Button>
                                        }
                                    </td>
                                </tr>
                                <tr key={"kumo"}>
                                    <td>
                                        <Text>
                                            {"KUMO Token"}
                                        </Text>
                                    </td>
                                    <td>
                                        {kumoBalance.toString()}
                                    </td>
                                    <td>
                                        -
                                    </td>
                                    <td style={{
                                        display: "flex",
                                        justifyContent: "center",
                                    }}>
                                        {
                                            account ?
                                                <Box sx={{ display: "flex", alignItems: 'center', justifyContent: "center", width: "90%", fontSize: 1 }}><Button onClick={() => addAsset(kumoToken, "KUMO")} sx={{ py: "4px", width: ["100%", "60%"] }}>
                                                    Import</Button>
                                                    <InfoIcon
                                                        tooltip={
                                                            <Card variant="tooltip" sx={{ width: "220px", fontSize: 1 }}>
                                                                {`Can't see your ${"KUMO"} in MetaMask, Click to Import!`}
                                                            </Card>

                                                        }
                                                    /></Box>
                                                :
                                                <Button variant="primaryInActive" disabled sx={{ py: "4px", width: ["100%", "65%"], fontSize: 1 }}>Connect</Button>
                                        }
                                    </td>
                                </tr>
                            </tbody>
                        </Box>
                    </Box>

                </Card>
                <Card sx={{ width: "100%", minWidth: "300px", height: "100%", bg: "#f0cfdc", borderRadius: 20, mt: 3 }}>
                    <Box sx={{ width: "100%" }}>
                        <Heading sx={{ display: "flex", height: ['max-content !important', "60px"], flexDirection: ['column', "row"], mt: 3, pl: 5 }}>
                            MATICS Faucet
                        </Heading>
                        <Box sx={{ px: 0, py: [2, 3] }}>
                            <Box
                                as="table"
                                sx={{
                                    mt: 2,
                                    width: "100%",
                                    pl: 7,
                                    textAlign: "center",
                                    lineHeight: 1.15
                                }}
                            >
                                <colgroup>
                                    <col style={{ width: "20%" }} />
                                    <col style={{ width: "55%" }} />
                                    <col style={{ width: "25%" }} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>Number</th>
                                        <th>
                                            Links
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr key={"1"}>
                                        <td>
                                            <Text sx={{ fontSize: 1}}>
                                                {"1"}
                                            </Text>
                                        </td>
                                        <td>
                                            <Link to={{ pathname: "https://mumbaifaucet.com/" }} target="_blank" sx={{ p: 0, pt: 2, pb: 12, textTransform: "lowercase", fontSize: 1 }}>https://mumbaifaucet.com/</Link>
                                        </td>
                                    </tr>
                                    <tr key={"2"}>
                                        <td>
                                            <Text sx={{ fontSize: 1 }}>
                                                {"2"}
                                            </Text>
                                        </td>
                                        <td>
                                            <Link to={{ pathname: "https://faucet.polygon.technology/" }} target="_blank" sx={{ p: 0, pb: 0, textTransform: "lowercase", fontSize: 1 }}>https://faucet.polygon.technology/</Link>
                                        </td>
                                    </tr>
                                </tbody>
                            </Box>
                        </Box>
                    </Box>
                </Card>
            </Box>
            {isTransactionPending && <LoadingOverlay />}
        </DashboadContent>
    )
}

export default Faucet