import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, deployKumo } from "hardhat";

import {
  Decimal
} from "@kumodao/lib-base";

import { connectToDeployment, setUpInitialUserBalance } from "../testUtils"
import { mockAssetContracts } from "../testUtils/types"
import { STARTING_BALANCE } from "../testUtils/constants"

import {
  _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { _KumoDeploymentJSON } from "../src/contracts";
import { EthersKumo } from "../src/EthersKumo";


const ERC20ABI = require("../abi/ERC20Test.json")

const provider = ethers.provider;

chai.use(chaiAsPromised);
chai.use(chaiSpies);

// TODO make the testcases isolated
describe("EthersKumo", async () => {
  let deployer: Signer;
  let funder: Signer;
  let user: Signer;
  let otherUsers: Signer[];

  let deployment: _KumoDeploymentJSON;
  let kumo: EthersKumo;

  const gasLimit = BigNumber.from(2500000);
  
  before(async () => {
    [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
    deployment = await deployKumo(deployer);

    kumo = await connectToDeployment(deployment, user);

    expect(kumo).to.be.an.instanceOf(EthersKumo);

  });

  // Always setup same initial balance for user
  beforeEach(async () => {
    const targetBalance = BigNumber.from(STARTING_BALANCE.hex);

    await setUpInitialUserBalance(user, funder, gasLimit)
    expect(`${await user.getBalance()}`).to.equal(`${targetBalance}`);
  });


  describe("shouldGetPrice", () => {
    for (const mockAssetContract of mockAssetContracts) {
      it(`should get the price ${mockAssetContract.name}`, async () => {
        const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
        const price = await kumo.getPrice(mockAssetAddress);
        expect(price).to.be.an.instanceOf(Decimal);
      });
    }
  })
});

