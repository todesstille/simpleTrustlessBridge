require("dotenv/config");
require("@nomiclabs/hardhat-etherscan");
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  networks: {
    hardhat: {},
    goerli: {
      url: process.env.GOERLI_PROVIDER,
      accounts: [process.env.PRIVATEKEY]
    },
    mumbai: {
      url: process.env.MUMBAI_PROVIDER,
      accounts: [process.env.PRIVATEKEY]
    },
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY
  },

};
