import { Decimal } from "@kumodao/lib-base";

const fixedPrice: { [key: string]: Decimal } = { 'toucan-protocol-base-carbon-tonne':  Decimal.from(3.0169), 'moss-carbon-credit':  Decimal.from(8.0424) }

export const getTokenPrice = async (id: string) => {
    try {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`
        );
        if (!response.ok) {
          return { data: fixedPrice[id] }
        }
        let actualData = await response.json();
        return { data: actualData[id].usd ? Decimal.from(actualData[id].usd) : fixedPrice[id] }
       
      } catch(err) {
        return { data: fixedPrice[id] }
      }
    
}