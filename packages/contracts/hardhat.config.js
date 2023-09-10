require("hardhat-diamond-abi");
require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");

const accounts = require("./hardhatAccountsList2k.js");
const accountsList = accounts.accountsList;

const fs = require("fs");
const getSecret = (secretKey, defaultValue = "") => {
  const SECRETS_FILE = "./secrets.js";
  let secret = defaultValue;
  if (fs.existsSync(SECRETS_FILE)) {
    const { secrets } = require(SECRETS_FILE);
    if (secrets[secretKey]) {
      secret = secrets[secretKey];
    }
  }

  return secret;
};
const alchemyUrl = () => {
  return `https://eth-mainnet.alchemyapi.io/v2/${getSecret("alchemyAPIKey")}`;
};

const alchemyUrlRinkeby = () => {
  return `https://eth-rinkeby.alchemyapi.io/v2/${getSecret("alchemyAPIKeyRinkeby")}`;
};

const alchemyUrlMumbai = () => {
  return `https://polygon-mumbai.g.alchemy.com/v2/${getSecret("alchemyAPIKeyMumbai")}`;
};

let abiMap = {};

module.exports = {
  paths: {
    // contracts: "./contracts",
    // artifacts: "./artifacts"
  },
  solidity: {
    compilers: [
      {
        version: "0.8.15",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    hardhat: {
      accounts: accountsList,
      gas: 100000000, // tx gas limit
      blockGasLimit: 150000000,
      gasPrice: 200000000000,
      initialBaseFeePerGas: 0,
      allowUnlimitedContractSize: true
    },
    mainnet: {
      url: alchemyUrl(),
      gasPrice: 15000000000,
      accounts: [
        getSecret(
          "DEPLOYER_PRIVATEKEY",
          "0x60ddfe7f579ab6867cbe7a2dc03853dc141d7a4ab6dbefc0dae2d2b1bd4e487f"
        ),
        getSecret(
          "ACCOUNT2_PRIVATEKEY",
          "0x3ec7cedbafd0cb9ec05bf9f7ccfa1e8b42b3e3a02c75addfccbfeb328d1b383b"
        )
      ]
    },
    rinkeby: {
      url: alchemyUrlRinkeby(),
      gas: 10000000, // tx gas limit
      accounts: [
        getSecret(
          "RINKEBY_DEPLOYER_PRIVATEKEY",
          "0x60ddfe7f579ab6867cbe7a2dc03853dc141d7a4ab6dbefc0dae2d2b1bd4e487f"
        )
      ]
    },
    mumbai: {
      url: alchemyUrlMumbai(),
      accounts: [
        getSecret(
          "MUMBAI_DEPLOYER_PRIVATEKEY",
          "0x60ddfe7f579ab6867cbe7a2dc03853dc141d7a4ab6dbefc0dae2d2b1bd4e487f"
        )
      ],
      gas: 2100000
    }
  },
  etherscan: {
    apiKey: getSecret("ETHERSCAN_API_KEY")
  },
  mocha: { timeout: 12000000 },
  rpc: {
    host: "localhost",
    port: 8545
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false
  },
  diamondAbi: {
    name: "TroveManager",
    include: [
      "TroveManagerFacet",
      "TroveRedemptorFacet",
      "DiamondCutFacet",
      "DiamondLoupeFacet",
      "CDPManagerTesterFacet",
      "OwnershipFacet",
      "LibTroveManager",
      "LibKumoBase"
    ],
    filter: function (abiElement, index, fullAbi, fullyQualifiedName) {
      if (abiMap[abiElement.name] == true) {
        return false;
      }

      abiMap[abiElement.name] = true;

      return true;
    },
    strict: true
  }
};
