import { ReactNode } from "react";
import { Button } from "theme-ui";

import { useKumo } from "../../hooks/KumoContext";
import { useTransactionFunction } from "../Transaction";


type AddAssetActionProps = {
    children: ReactNode
    transactionId: string;
    isTransactionConfirmed : boolean;
    type: string;
    tokenAddress: string;
    tokenSymbol : string;
};


export const AddAssetAction: React.FC<AddAssetActionProps> = ({
    children,
    transactionId,
    tokenAddress,
}) => {
    const { kumo } = useKumo();

    const [sendTransaction] = useTransactionFunction(
        transactionId,
        kumo.send.requestTestToken.bind(kumo.send, tokenAddress)
    );

    return (
        <Button
            sx={{  py: "4px",  width: ["100%", "65%"], mx: "auto", fontSize: 1 }}
            onClick={sendTransaction}
        >
            {children}
        </Button>
    );
};
