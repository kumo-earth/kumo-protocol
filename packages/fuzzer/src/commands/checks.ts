import { EthersKumo } from "@kumodao/lib-ethers";

import { deployer, subgraph } from "../globals";

import {
  checkSubgraph,
  checkTroveOrdering,
  dumpTroves,
  getListOfTrovesBeforeRedistribution
} from "../utils";

export const checkSorting = async () => {
  const deployerKumo = await EthersKumo.connect(deployer);
  const listOfTroves = await getListOfTrovesBeforeRedistribution(deployerKumo);
  const totalRedistributed = await deployerKumo.getTotalRedistributed();
  const price = await deployerKumo.getPrice();

  checkTroveOrdering(listOfTroves, totalRedistributed, price);

  console.log("All Troves are sorted.");
};

export const checkSubgraphCmd = async () => {
  const deployerKumo = await EthersKumo.connect(deployer);

  await checkSubgraph(subgraph, deployerKumo);

  console.log("Subgraph looks fine.");
};

export const dumpTrovesCmd = async () => {
  const deployerKumo = await EthersKumo.connect(deployer);
  const listOfTroves = await getListOfTrovesBeforeRedistribution(deployerKumo);
  const totalRedistributed = await deployerKumo.getTotalRedistributed();
  const price = await deployerKumo.getPrice();

  dumpTroves(listOfTroves, totalRedistributed, price);
};
